import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

interface JwtPayload {
  sub: string;
  schoolId: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;
  private readonly RESET_TOKEN_TTL = 60 * 60; // 1 hour
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_TTL = 15 * 60; // 15 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Register ─────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email, schoolId: dto.schoolId },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists in this school');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        schoolId: dto.schoolId,
        role: dto.role ?? 'STUDENT',
        language: dto.language ?? 'en',
      },
      select: {
        id: true, email: true, role: true,
        firstName: true, lastName: true, schoolId: true,
      },
    });

    this.logger.log(`User registered: ${user.email} [school: ${user.schoolId}]`);
    const tokens = this.issueTokens(user.id, user.schoolId, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return { user, ...tokens };
  }

  // ─── Login ────────────────────────────────────────────────

  async login(dto: LoginDto) {
    // Check account lockout
    const lockKey = `lockout:${dto.email}:${dto.schoolId}`;
    const isLocked = await this.redis.exists(lockKey);
    if (isLocked) {
      const remainingTtl = await this.redis.ttl(lockKey);
      throw new UnauthorizedException(
        `Account temporarily locked. Try again in ${Math.ceil(remainingTtl / 60)} minutes.`,
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, schoolId: dto.schoolId, status: 'ACTIVE' },
    });

    if (!user || !user.passwordHash) {
      await this.recordFailedAttempt(dto.email, dto.schoolId, lockKey);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      await this.recordFailedAttempt(dto.email, dto.schoolId, lockKey);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on success
    await this.redis.del(`attempts:${dto.email}:${dto.schoolId}`);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = this.issueTokens(user.id, user.schoolId, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`Login: ${user.email} [role: ${user.role}]`);
    return {
      user: {
        id: user.id, email: user.email, role: user.role,
        firstName: user.firstName, lastName: user.lastName,
        schoolId: user.schoolId,
      },
      ...tokens,
    };
  }

  // ─── Token Refresh ────────────────────────────────────────

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });

      const stored = await this.redis.get<string>(`refresh:${payload.sub}`);
      if (!stored || stored !== refreshToken) {
        throw new UnauthorizedException('Refresh token revoked or invalid');
      }

      const tokens = this.issueTokens(payload.sub, payload.schoolId, payload.role);
      await this.storeRefreshToken(payload.sub, tokens.refreshToken);
      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  // ─── Logout ───────────────────────────────────────────────

  async logout(refreshToken: string) {
    try {
      const payload = this.jwt.decode<JwtPayload>(refreshToken);
      if (payload?.sub) {
        await this.redis.del(`refresh:${payload.sub}`);
        this.logger.log(`Logged out user: ${payload.sub}`);
      }
    } catch {
      // Ignore malformed tokens silently
    }
  }

  // ─── Forgot Password ──────────────────────────────────────

  async forgotPassword(email: string, schoolId: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, schoolId, status: 'ACTIVE' },
      select: { id: true, email: true, firstName: true },
    });

    // Always return success to prevent user enumeration
    if (!user) return { message: 'If this email exists, a reset link has been sent.' };

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + this.RESET_TOKEN_TTL * 1000),
      },
    });

    // TODO: Inject EmailService and send reset email
    // await this.emailService.sendPasswordReset(user.email, user.firstName, rawToken);
    this.logger.log(`Password reset requested for: ${email} (token generated, email sending TODO)`);

    return { message: 'If this email exists, a reset link has been sent.' };
  }

  // ─── Reset Password ───────────────────────────────────────

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const reset = await this.prisma.passwordReset.findFirst({
      where: {
        tokenHash,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!reset) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { used: true },
      }),
    ]);

    // Revoke all sessions
    await this.redis.del(`refresh:${reset.userId}`);
    this.logger.log(`Password reset completed for userId: ${reset.userId}`);

    return { message: 'Password has been reset successfully. Please log in again.' };
  }

  // ─── Change Password (authenticated) ─────────────────────

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user?.passwordHash) throw new NotFoundException('User not found');

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Current password is incorrect');

    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Invalidate refresh token — user must log in again
    await this.redis.del(`refresh:${userId}`);

    return { message: 'Password changed successfully. Please log in again.' };
  }

  // ─── Helpers ──────────────────────────────────────────────

  private issueTokens(userId: string, schoolId: string, role: string) {
    const payload: JwtPayload = { sub: userId, schoolId, role };
    const accessToken = this.jwt.sign(payload, {
      expiresIn: this.config.get<string>('jwt.expiresIn', '15m'),
    });
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: this.config.get<string>('jwt.refreshExpiresIn', '7d'),
    });
    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, token: string) {
    await this.redis.set(`refresh:${userId}`, token, 7 * 24 * 60 * 60);
  }

  private async recordFailedAttempt(email: string, schoolId: string, lockKey: string) {
    const attemptsKey = `attempts:${email}:${schoolId}`;
    const attempts = await this.redis.incr(attemptsKey);
    await this.redis.expire(attemptsKey, this.LOCKOUT_TTL);

    if (attempts >= this.MAX_LOGIN_ATTEMPTS) {
      await this.redis.set(lockKey, '1', this.LOCKOUT_TTL);
      this.logger.warn(`Account locked after ${attempts} failed attempts: ${email}`);
    }
  }
}
