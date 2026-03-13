import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from './prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly JWT_REFRESH_SECRET: string;
  private readonly JWT_REFRESH_EXPIRES_IN: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {
    this.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
    this.JWT_REFRESH_EXPIRES_IN =
      process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  }

  async register(registerDto: RegisterDto) {
    const { email, password, name, role = 'STUDENT' } = registerDto;

    // Validate email format
    if (!this.validateEmail(email)) {
      throw new BadRequestException('Invalid email format');
    }

    // Validate password strength
    const passwordValidation = this.validatePassword(password);
    if (!passwordValidation.valid) {
      throw new BadRequestException({
        message: 'Password does not meet requirements',
        details: passwordValidation.errors,
      });
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        isActive: true,
      },
    });

    // Generate tokens
    const tokens = this.generateTokenPair({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    this.logger.log(`User registered: ${email}`);

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        ...tokens,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Verify password
    const isPasswordValid = await this.comparePassword(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastActiveDate: new Date().toISOString().split('T')[0],
      },
    });

    // Generate tokens
    const tokens = this.generateTokenPair({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    this.logger.log(`User logged in: ${email}`);

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        ...tokens,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.JWT_REFRESH_SECRET,
      }) as TokenPayload;

      // Find user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.id },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = this.generateTokenPair({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      this.logger.log(`Token refreshed for user: ${user.email}`);

      return {
        success: true,
        data: tokens,
      };
    } catch (error) {
      this.logger.error('Token refresh error:', error);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        gradeLevel: true,
        stars: true,
        xp: true,
        level: true,
        avatar: true,
        solvedProblems: true,
        streakDays: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      success: true,
      data: user,
    };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists
      return {
        success: true,
        data: { message: 'If the email exists, a reset link has been sent' },
      };
    }

    // In real implementation: Generate reset token, save to DB, send email
    this.logger.log(`Password reset requested for: ${email}`);

    return {
      success: true,
      data: { message: 'If the email exists, a reset link has been sent' },
    };
  }

  async resetPassword(token: string, newPassword: string) {
    // Validate password strength
    const passwordValidation = this.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new BadRequestException({
        message: 'Password does not meet requirements',
        details: passwordValidation.errors,
      });
    }

    // In real implementation: Verify token, update password in DB
    this.logger.log('Password reset completed');

    return {
      success: true,
      data: { message: 'Password reset successfully' },
    };
  }

  // Helper methods
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  private async comparePassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private generateTokenPair(payload: TokenPayload) {
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.JWT_REFRESH_SECRET,
      expiresIn: this.JWT_REFRESH_EXPIRES_IN,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    };
  }

  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private validatePassword(password: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*]/.test(password)) {
      errors.push(
        'Password must contain at least one special character (!@#$%^&*)',
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
