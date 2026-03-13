import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  CreateProfileDto,
  UpdateProfileDto,
  CreateStudentProfileDto,
  UpdateStudentProfileDto,
} from './dto/user.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════
  // USER PROFILE METHODS
  // ═══════════════════════════════════════════════════════════

  async createProfile(data: CreateProfileDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (existingUser) {
      throw new ConflictException('Profile already exists');
    }

    // Create user profile
    const user = await this.prisma.user.create({
      data: {
        id: data.userId,
        email: data.email || `user_${data.userId}@example.com`,
        password: '', // Password managed by auth service
        name: data.name,
        role: data.role || 'STUDENT',
        gradeLevel: data.gradeLevel || 1,
        avatar: data.avatar || '👨‍🚀',
        isActive: true,
      },
    });

    this.logger.log(`Profile created for user: ${user.id}`);

    return {
      success: true,
      data: user,
    };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
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
        lastActiveDate: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        avatar: data.avatar,
        gradeLevel: data.gradeLevel,
      },
    });

    this.logger.log(`Profile updated for user: ${userId}`);
    return updated;
  }

  async deleteProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return false;
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    this.logger.log(`Profile deleted for user: ${userId}`);
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // STUDENT PROFILE METHODS
  // ═══════════════════════════════════════════════════════════

  async createStudentProfile(data: CreateStudentProfileDto) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      // Create user if doesn't exist
      await this.prisma.user.create({
        data: {
          id: data.userId,
          email: `student_${data.userId}@example.com`,
          password: '',
          name: data.name || 'Student',
          role: 'STUDENT',
          gradeLevel: data.gradeLevel || 1,
          schoolId: data.schoolId,
          isActive: true,
        },
      });
    } else {
      // Update existing user
      await this.prisma.user.update({
        where: { id: data.userId },
        data: {
          gradeLevel: data.gradeLevel,
          schoolId: data.schoolId,
        },
      });
    }

    const studentProfile = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });

    this.logger.log(`Student profile created: ${data.userId}`);

    return {
      success: true,
      data: studentProfile,
    };
  }

  async getStudentProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId, role: 'STUDENT' },
      select: {
        id: true,
        name: true,
        email: true,
        gradeLevel: true,
        schoolId: true,
        stars: true,
        xp: true,
        level: true,
        avatar: true,
        solvedProblems: true,
        streakDays: true,
        lastActiveDate: true,
        createdAt: true,
      },
    });
  }

  async updateStudentProfile(userId: string, data: UpdateStudentProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        gradeLevel: data.gradeLevel,
        schoolId: data.schoolId,
      },
    });

    this.logger.log(`Student profile updated: ${userId}`);
    return updated;
  }

  // ═══════════════════════════════════════════════════════════
  // STUDENT ACTIONS
  // ═══════════════════════════════════════════════════════════

  async addStars(userId: string, stars: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    const newStars = user.stars + stars;
    const newXp = user.xp + stars * 10;
    const newLevel = Math.floor(newXp / 1000) + 1;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        stars: newStars,
        xp: newXp,
        level: newLevel,
      },
    });

    if (newLevel > user.level) {
      this.logger.log(`Student leveled up to ${newLevel}: ${userId}`);
    }

    return updated;
  }

  async addXp(userId: string, xp: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    const newXp = user.xp + xp;
    const newLevel = Math.floor(newXp / 1000) + 1;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        xp: newXp,
        level: newLevel,
      },
    });

    if (newLevel > user.level) {
      this.logger.log(`Student leveled up to ${newLevel}: ${userId}`);
    }

    return updated;
  }

  async updateStreak(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    const today = new Date().toISOString().split('T')[0];
    const lastActive = user.lastActiveDate;

    let newStreakDays = user.streakDays;

    if (lastActive !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastActive === yesterdayStr) {
        newStreakDays += 1;
      } else {
        newStreakDays = 1;
      }

      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          streakDays: newStreakDays,
          lastActiveDate: today,
        },
      });

      this.logger.log(
        `Streak updated for student: ${userId} (${newStreakDays} days)`,
      );

      return updated;
    }

    return user;
  }

  // ═══════════════════════════════════════════════════════════
  // LEADERBOARD
  // ═══════════════════════════════════════════════════════════

  async getLeaderboard(limit: number = 10) {
    return this.prisma.user.findMany({
      where: {
        role: 'STUDENT',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        stars: true,
        xp: true,
        level: true,
        gradeLevel: true,
      },
      orderBy: {
        stars: 'desc',
      },
      take: limit,
    });
  }

  async getSchoolLeaderboard(schoolId: string, limit: number = 10) {
    return this.prisma.user.findMany({
      where: {
        schoolId,
        role: 'STUDENT',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        stars: true,
        xp: true,
        level: true,
        gradeLevel: true,
      },
      orderBy: {
        stars: 'desc',
      },
      take: limit,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════

  async getUserStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        avatar: true,
        stars: true,
        xp: true,
        level: true,
        solvedProblems: true,
        streakDays: true,
        gradeLevel: true,
        createdAt: true,
      },
    });

    if (!user) {
      return null;
    }

    // Calculate rank
    const higherRanked = await this.prisma.user.count({
      where: {
        stars: {
          gt: user.stars,
        },
        role: 'STUDENT',
        isActive: true,
      },
    });

    return {
      ...user,
      rank: higherRanked + 1,
    };
  }
}
