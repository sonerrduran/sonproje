import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { User, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { CreateUserDto, UpdateUserDto } from './dto/user.dto';

const USER_SELECT = {
  id: true, email: true, role: true, firstName: true, lastName: true,
  avatarUrl: true, language: true, status: true, schoolId: true,
  createdAt: true, updatedAt: true, lastLoginAt: true,
} as const;

const PAGE_DEFAULTS = { page: 1, limit: 20 };

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly SALT_ROUNDS = 12;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── List + Filter ────────────────────────────────────────

  async findAll(
    schoolId: string,
    params: { role?: UserRole; status?: UserStatus; search?: string; page?: number; limit?: number },
  ) {
    const { role, status, search, page = PAGE_DEFAULTS.page, limit = PAGE_DEFAULTS.limit } = params;
    const skip = (page - 1) * limit;

    const where = {
      schoolId,
      ...(role && { role }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ where, select: USER_SELECT, skip, take: limit, orderBy: { firstName: 'asc' } }),
      this.prisma.user.count({ where }),
    ]);

    return { data, meta: { total, page, limit, hasNextPage: skip + limit < total } };
  }

  // ─── Get by ID ────────────────────────────────────────────

  async findById(id: string, schoolId: string) {
    const cacheKey = `user:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const user = await this.prisma.user.findFirst({
      where: { id, schoolId },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    await this.redis.set(cacheKey, user, 600);
    return user;
  }

  // ─── Create (admin) ───────────────────────────────────────

  async create(schoolId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email, schoolId },
    });
    if (existing) throw new ConflictException('Email already taken in this school');

    const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { ...dto, passwordHash, schoolId },
      select: USER_SELECT,
    });

    this.logger.log(`User created by admin: ${user.email} [${user.role}] school: ${schoolId}`);
    return user;
  }

  // ─── Update profile ───────────────────────────────────────

  async update(id: string, schoolId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id, schoolId } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    const updated = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: USER_SELECT,
    });

    await this.redis.del(`user:${id}`);
    return updated;
  }

  // ─── Soft delete ──────────────────────────────────────────

  async remove(id: string, schoolId: string, requestingUserId: string) {
    if (id === requestingUserId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    const user = await this.prisma.user.findFirst({ where: { id, schoolId } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.INACTIVE },
    });

    await this.redis.del(`user:${id}`);
    this.logger.warn(`User ${id} deactivated by ${requestingUserId}`);
    return { message: 'User deactivated successfully' };
  }

  // ─── Status update ────────────────────────────────────────

  async updateStatus(id: string, schoolId: string, status: UserStatus) {
    const user = await this.prisma.user.findFirst({ where: { id, schoolId } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    await this.prisma.user.update({ where: { id }, data: { status } });
    await this.redis.del(`user:${id}`);
    return { message: `User status set to ${status}` };
  }

  // ─── Parent ↔ Student linking ─────────────────────────────

  async linkParentToStudent(parentId: string, studentId: string, schoolId: string) {
    const [parent, student] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: parentId, schoolId, role: UserRole.PARENT } }),
      this.prisma.user.findFirst({ where: { id: studentId, schoolId, role: UserRole.STUDENT } }),
    ]);

    if (!parent) throw new NotFoundException('Parent user not found in this school');
    if (!student) throw new NotFoundException('Student user not found in this school');

    const existing = await this.prisma.parentStudentLink.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
    });
    if (existing) throw new ConflictException('Parent is already linked to this student');

    await this.prisma.parentStudentLink.create({ data: { parentId, studentId } });
    return { message: 'Parent linked to student successfully' };
  }

  async unlinkParentFromStudent(parentId: string, studentId: string, schoolId: string) {
    const link = await this.prisma.parentStudentLink.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
    });
    if (!link) throw new NotFoundException('Link not found');

    await this.prisma.parentStudentLink.delete({
      where: { parentId_studentId: { parentId, studentId } },
    });
    return { message: 'Parent unlinked from student' };
  }

  async getParentChildren(parentId: string, schoolId: string) {
    const parent = await this.prisma.user.findFirst({
      where: { id: parentId, schoolId, role: UserRole.PARENT },
    });
    if (!parent) throw new NotFoundException('Parent not found');

    const links = await this.prisma.parentStudentLink.findMany({
      where: { parentId },
      include: {
        student: { select: USER_SELECT },
      },
    });

    return links.map((l) => l.student);
  }

  // ─── Student Stats ────────────────────────────────────────

  async getStudentStats(studentId: string, schoolId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: studentId, schoolId, role: UserRole.STUDENT },
    });
    if (!user) throw new NotFoundException('Student not found');

    const [xpAgg, lessonsCompleted, gamesPlayed, practiceData, badgeCount] = await Promise.all([
      this.prisma.xpLog.aggregate({ where: { userId: studentId }, _sum: { amount: true } }),
      this.prisma.lessonProgress.count({ where: { studentId, schoolId, completed: true } }),
      this.prisma.gameProgress.count({ where: { studentId } }),
      this.prisma.practiceAttempt.aggregate({
        where: { studentId, schoolId },
        _avg: { score: true },
        _count: true,
      }),
      this.prisma.userBadge.count({ where: { userId: studentId } }),
    ]);

    const totalXp = xpAgg._sum.amount ?? 0;
    const level = Math.floor(Math.sqrt(totalXp / 100)) + 1;

    return {
      totalXp,
      level,
      lessonsCompleted,
      gamesPlayed,
      practiceAttempts: practiceData._count,
      avgPracticeScore: Math.round(practiceData._avg.score ?? 0),
      badges: badgeCount,
    };
  }

  // ─── Classroom memberships for a student ─────────────────

  async getStudentClassrooms(studentId: string, schoolId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: studentId, schoolId } });
    if (!user) throw new NotFoundException('Student not found');

    return this.prisma.classroomStudent.findMany({
      where: { studentId },
      include: { classroom: { include: { gradeLevel: true } } },
    });
  }

  // ─── Classrooms for a teacher ─────────────────────────────

  async getTeacherClassrooms(teacherId: string, schoolId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: teacherId, schoolId } });
    if (!user) throw new NotFoundException('Teacher not found');

    return this.prisma.classroomTeacher.findMany({
      where: { teacherId },
      include: {
        classroom: {
          include: {
            gradeLevel: true,
            _count: { select: { students: true } },
          },
        },
      },
    });
  }

  // ─── Count by role (for dashboard) ───────────────────────

  async getRoleCounts(schoolId: string) {
    const counts = await this.prisma.user.groupBy({
      by: ['role'],
      where: { schoolId, status: UserStatus.ACTIVE },
      _count: true,
    });
    return Object.fromEntries(counts.map((c) => [c.role, c._count]));
  }
}
