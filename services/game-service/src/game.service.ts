import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  CreateGameSessionDto,
  CompleteGameSessionDto,
  GameFilters,
} from './dto/game.dto';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════
  // GAME CATEGORIES
  // ═══════════════════════════════════════════════════════════

  async getCategories() {
    return this.prisma.gameCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { games: true },
        },
      },
    });
  }

  async getCategoryById(id: string) {
    return this.prisma.gameCategory.findUnique({
      where: { id },
      include: {
        games: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════
  // GAMES
  // ═══════════════════════════════════════════════════════════

  async getGames(filters: GameFilters) {
    const where: any = { isActive: true };

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.gradeLevel) {
      where.gradeMin = { lte: filters.gradeLevel };
      where.gradeMax = { gte: filters.gradeLevel };
    }

    if (filters.difficulty) {
      where.difficulty = filters.difficulty;
    }

    return this.prisma.game.findMany({
      where,
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
      include: {
        category: true,
      },
    });
  }

  async getGameById(id: string) {
    return this.prisma.game.findUnique({
      where: { id },
      include: {
        category: true,
        contents: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async getGameContent(gameId: string) {
    return this.prisma.gameContent.findMany({
      where: {
        gameId,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ═══════════════════════════════════════════════════════════
  // GAME SESSIONS
  // ═══════════════════════════════════════════════════════════

  async createSession(data: CreateGameSessionDto) {
    const session = await this.prisma.gameSession.create({
      data: {
        userId: data.userId,
        gameMode: data.gameMode,
        difficulty: data.difficulty,
        grade: data.grade,
        subjectId: data.subjectId,
        topicId: data.topicId,
      },
    });

    this.logger.log(`Game session created: ${session.id} for user ${data.userId}`);

    return {
      success: true,
      data: session,
    };
  }

  async completeSession(id: string, data: CompleteGameSessionDto) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id },
    });

    if (!session) {
      return null;
    }

    // Update session
    const updated = await this.prisma.gameSession.update({
      where: { id },
      data: {
        score: data.score,
        starsEarned: data.starsEarned,
        xpEarned: data.xpEarned,
        correctAnswers: data.correctAnswers,
        totalQuestions: data.totalQuestions,
        durationSec: data.durationSec,
        completedAt: new Date(),
      },
    });

    // Update user stats
    await this.prisma.user.update({
      where: { id: session.userId },
      data: {
        stars: { increment: data.starsEarned },
        xp: { increment: data.xpEarned },
        solvedProblems: { increment: data.correctAnswers },
      },
    });

    // Calculate new level
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (user) {
      const newLevel = Math.floor(user.xp / 1000) + 1;
      if (newLevel > user.level) {
        await this.prisma.user.update({
          where: { id: session.userId },
          data: { level: newLevel },
        });
        this.logger.log(`User ${session.userId} leveled up to ${newLevel}`);
      }
    }

    this.logger.log(`Game session completed: ${id}`);

    return updated;
  }

  async getUserSessions(userId: string, limit: number = 10) {
    return this.prisma.gameSession.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: limit,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // LEADERBOARD
  // ═══════════════════════════════════════════════════════════

  async getGlobalLeaderboard(limit: number = 10) {
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
      orderBy: { stars: 'desc' },
      take: limit,
    });
  }

  async getGameLeaderboard(gameMode: string, limit: number = 10) {
    const sessions = await this.prisma.gameSession.findMany({
      where: { gameMode },
      orderBy: { score: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            gradeLevel: true,
          },
        },
      },
    });

    return sessions.map((session) => ({
      userId: session.user.id,
      name: session.user.name,
      avatar: session.user.avatar,
      gradeLevel: session.user.gradeLevel,
      score: session.score,
      starsEarned: session.starsEarned,
      completedAt: session.completedAt,
    }));
  }

  // ═══════════════════════════════════════════════════════════
  // DAILY CHALLENGE
  // ═══════════════════════════════════════════════════════════

  async getDailyChallenge() {
    const today = new Date().toISOString().split('T')[0];

    let challenge = await this.prisma.dailyChallenge.findUnique({
      where: { date: today },
    });

    // If no challenge for today, create one
    if (!challenge) {
      challenge = await this.createDailyChallenge(today);
    }

    return challenge;
  }

  private async createDailyChallenge(date: string) {
    const gameModes = ['MATH_BASIC', 'TURKISH_WORDS', 'LOGIC_PUZZLE'];
    const difficulties = ['EASY', 'MEDIUM', 'HARD'];
    const grades = [1, 2, 3, 4, 5, 6, 7, 8];

    const randomGameMode = gameModes[Math.floor(Math.random() * gameModes.length)];
    const randomDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
    const randomGrade = grades[Math.floor(Math.random() * grades.length)];

    return this.prisma.dailyChallenge.create({
      data: {
        date,
        gameMode: randomGameMode,
        difficulty: randomDifficulty,
        grade: randomGrade,
        title: `Günün Meydan Okuması - ${randomGameMode}`,
        description: `${randomDifficulty} seviyesinde ${randomGrade}. sınıf oyunu`,
        bonusStars: 5,
        bonusXp: 20,
      },
    });
  }

  async completeDailyChallenge(challengeId: string, userId: string) {
    // Check if already completed
    const existing = await this.prisma.dailyChallengeCompletion.findUnique({
      where: {
        userId_challengeId: {
          userId,
          challengeId,
        },
      },
    });

    if (existing) {
      return {
        success: false,
        message: 'Challenge already completed',
      };
    }

    // Create completion
    const completion = await this.prisma.dailyChallengeCompletion.create({
      data: {
        userId,
        challengeId,
      },
    });

    // Get challenge details
    const challenge = await this.prisma.dailyChallenge.findUnique({
      where: { id: challengeId },
    });

    if (challenge) {
      // Award bonus
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          stars: { increment: challenge.bonusStars },
          xp: { increment: challenge.bonusXp },
        },
      });

      this.logger.log(
        `User ${userId} completed daily challenge ${challengeId} - Bonus: ${challenge.bonusStars} stars, ${challenge.bonusXp} XP`,
      );
    }

    return {
      success: true,
      data: completion,
    };
  }
}
