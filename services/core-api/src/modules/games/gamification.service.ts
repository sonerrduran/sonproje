import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';

// XP required to reach each level: level N requires N² × 100 XP total
const LEVEL_THRESHOLDS = Array.from({ length: 50 }, (_, i) => (i + 1) * (i + 1) * 100);

// Badge definitions
const BADGE_RULES: { key: string; title: string; description: string; icon: string; check: (stats: PlayerStats) => boolean }[] = [
  { key: 'first_lesson', title: 'First Steps', description: 'Complete your first lesson', icon: '📚', check: (s) => s.lessonsCompleted >= 1 },
  { key: 'lesson_streak_5', title: 'On Fire', description: 'Complete 5 lessons', icon: '🔥', check: (s) => s.lessonsCompleted >= 5 },
  { key: 'lesson_master', title: 'Lesson Master', description: 'Complete 50 lessons', icon: '🎓', check: (s) => s.lessonsCompleted >= 50 },
  { key: 'first_game', title: 'Player One', description: 'Play your first game', icon: '🎮', check: (s) => s.gamesPlayed >= 1 },
  { key: 'gamer_10', title: 'Gamer', description: 'Play 10 games', icon: '🕹️', check: (s) => s.gamesPlayed >= 10 },
  { key: 'perfect_score', title: 'Perfectionist', description: 'Get 100% in a practice set', icon: '⭐', check: (s) => s.hasPerfectScore },
  { key: 'xp_1000', title: 'Rising Star', description: 'Earn 1000 XP', icon: '✨', check: (s) => s.totalXp >= 1000 },
  { key: 'xp_5000', title: 'Scholar', description: 'Earn 5000 XP', icon: '🏆', check: (s) => s.totalXp >= 5000 },
  { key: 'xp_25000', title: 'Legend', description: 'Earn 25000 XP', icon: '👑', check: (s) => s.totalXp >= 25000 },
];

interface PlayerStats {
  totalXp: number;
  lessonsCompleted: number;
  gamesPlayed: number;
  hasPerfectScore: boolean;
}

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── XP & Level ───────────────────────────────────────────

  static xpToLevel(xp: number): { level: number; currentLevelXp: number; nextLevelXp: number; progressPct: number } {
    let level = 1;
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
      if (xp >= LEVEL_THRESHOLDS[i]) {
        level = i + 2;
      } else {
        const prevThreshold = i === 0 ? 0 : LEVEL_THRESHOLDS[i - 1];
        const nextThreshold = LEVEL_THRESHOLDS[i];
        const currentLevelXp = xp - prevThreshold;
        const nextLevelXp = nextThreshold - prevThreshold;
        return {
          level: i + 1,
          currentLevelXp,
          nextLevelXp,
          progressPct: Math.round((currentLevelXp / nextLevelXp) * 100),
        };
      }
    }
    return { level, currentLevelXp: 0, nextLevelXp: 0, progressPct: 100 };
  }

  async addXp(
    userId: string,
    schoolId: string,
    amount: number,
    reason: string,
    entityId?: string,
  ) {
    await this.prisma.xpLog.create({
      data: { userId, schoolId, amount, reason, entityId },
    });

    // Check if new badges were unlocked
    await this.checkAndAwardBadges(userId, schoolId);
    this.logger.debug(`+${amount} XP to ${userId} (reason: ${reason})`);
  }

  async getXpSummary(userId: string) {
    const agg = await this.prisma.xpLog.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    const totalXp = agg._sum.amount ?? 0;
    const levelInfo = GamificationService.xpToLevel(totalXp);

    return { totalXp, ...levelInfo };
  }

  // ─── Badges ───────────────────────────────────────────────

  async checkAndAwardBadges(userId: string, schoolId: string) {
    const stats = await this.getPlayerStats(userId, schoolId);
    const existing = await this.prisma.userBadge.findMany({
      where: { userId },
      select: { badge: { select: { key: true } } },
    });
    const earnedKeys = new Set(existing.map((b) => b.badge.key));

    const newBadges: string[] = [];

    for (const rule of BADGE_RULES) {
      if (!earnedKeys.has(rule.key) && rule.check(stats)) {
        // Upsert badge definition
        const badge = await this.prisma.badge.upsert({
          where: { key: rule.key },
          create: { key: rule.key, title: rule.title, description: rule.description, iconUrl: rule.icon },
          update: {},
        });

        await this.prisma.userBadge.create({ data: { userId, badgeId: badge.id } });
        newBadges.push(rule.title);
        this.logger.log(`Badge unlocked: "${rule.title}" for user ${userId}`);
      }
    }

    return newBadges;
  }

  async getUserBadges(userId: string) {
    return this.prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { earnedAt: 'desc' },
    });
  }

  // ─── Leaderboards ─────────────────────────────────────────

  async getSchoolLeaderboard(schoolId: string, limit = 10) {
    const cacheKey = `lb:school:${schoolId}:xp`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const topUsers = await this.prisma.xpLog.groupBy({
      by: ['userId'],
      where: { schoolId },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: limit,
    });

    const leaderboard = await Promise.all(
      topUsers.map(async (u, i) => {
        const user = await this.prisma.user.findUnique({
          where: { id: u.userId },
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        });
        const totalXp = u._sum.amount ?? 0;
        const { level } = GamificationService.xpToLevel(totalXp);
        return { rank: i + 1, user, totalXp, level };
      }),
    );

    await this.redis.set(cacheKey, leaderboard, 300); // 5-min cache
    return leaderboard;
  }

  async getClassroomLeaderboard(classroomId: string, schoolId: string, limit = 10) {
    const students = await this.prisma.classroomStudent.findMany({
      where: { classroomId },
      select: { studentId: true },
    });
    const ids = students.map((s) => s.studentId);

    const topStudents = await this.prisma.xpLog.groupBy({
      by: ['userId'],
      where: { userId: { in: ids }, schoolId },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: limit,
    });

    return Promise.all(
      topStudents.map(async (u, i) => {
        const user = await this.prisma.user.findUnique({
          where: { id: u.userId },
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        });
        const totalXp = u._sum.amount ?? 0;
        const { level } = GamificationService.xpToLevel(totalXp);
        return { rank: i + 1, user, totalXp, level };
      }),
    );
  }

  async getXpHistory(userId: string, limit = 20) {
    return this.prisma.xpLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ─── Helpers ──────────────────────────────────────────────

  private async getPlayerStats(userId: string, schoolId: string): Promise<PlayerStats> {
    const [xpAgg, lessonsCompleted, gamesPlayed, perfectAttempt] = await Promise.all([
      this.prisma.xpLog.aggregate({ where: { userId }, _sum: { amount: true } }),
      this.prisma.lessonProgress.count({ where: { studentId: userId, schoolId, completed: true } }),
      this.prisma.gameProgress.count({ where: { studentId: userId } }),
      this.prisma.practiceAttempt.findFirst({
        where: { studentId: userId, schoolId, completedAt: { not: null } },
        orderBy: { score: 'desc' },
        select: { score: true, maxScore: true },
      }),
    ]);

    return {
      totalXp: xpAgg._sum.amount ?? 0,
      lessonsCompleted,
      gamesPlayed,
      hasPerfectScore: perfectAttempt ? perfectAttempt.score === perfectAttempt.maxScore : false,
    };
  }
}
