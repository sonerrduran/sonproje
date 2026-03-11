import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class ClassroomsService {
  private readonly logger = new Logger(ClassroomsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── CRUD ─────────────────────────────────────────────────

  async findAll(
    schoolId: string,
    params: { page?: number; limit?: number; archived?: boolean },
  ) {
    const { page = 1, limit = 20, archived = false } = params;
    const skip = (page - 1) * limit;
    const where = { schoolId, isArchived: archived };

    const [data, total] = await Promise.all([
      this.prisma.classroom.findMany({
        where,
        include: {
          gradeLevel: true,
          academicYear: true,
          _count: { select: { students: true, teachers: true } },
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.classroom.count({ where }),
    ]);

    return { data, meta: { total, page, limit, hasNextPage: skip + limit < total } };
  }

  async findById(id: string, schoolId: string) {
    const classroom = await this.prisma.classroom.findFirst({
      where: { id, schoolId },
      include: {
        gradeLevel: true,
        academicYear: true,
        teachers: {
          include: {
            teacher: {
              select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
            },
          },
        },
        students: {
          include: {
            student: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
        _count: { select: { students: true, teachers: true } },
      },
    });
    if (!classroom) throw new NotFoundException(`Classroom ${id} not found`);
    return classroom;
  }

  async create(
    schoolId: string,
    teacherId: string,
    data: { name: string; section?: string; gradeLevelId?: string; academicYearId?: string },
  ) {
    const classroom = await this.prisma.classroom.create({
      data: {
        ...data,
        schoolId,
        teachers: { create: { teacherId, isPrimary: true } },
      },
      include: { _count: { select: { students: true, teachers: true } } },
    });
    this.logger.log(`Classroom created: "${classroom.name}" [school: ${schoolId}]`);
    return classroom;
  }

  async update(id: string, schoolId: string, data: { name?: string; section?: string }) {
    await this.assertExists(id, schoolId);
    const updated = await this.prisma.classroom.update({ where: { id }, data });
    return updated;
  }

  async archive(id: string, schoolId: string) {
    await this.assertExists(id, schoolId);
    return this.prisma.classroom.update({ where: { id }, data: { isArchived: true } });
  }

  async restore(id: string, schoolId: string) {
    await this.assertExists(id, schoolId);
    return this.prisma.classroom.update({ where: { id }, data: { isArchived: false } });
  }

  // ─── Student Membership ───────────────────────────────────

  async listStudents(classroomId: string, schoolId: string) {
    await this.assertExists(classroomId, schoolId);
    return this.prisma.classroomStudent.findMany({
      where: { classroomId },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true, status: true },
        },
      },
      orderBy: { enrolledAt: 'asc' },
    });
  }

  async addStudent(classroomId: string, studentId: string, schoolId: string) {
    await this.assertExists(classroomId, schoolId);

    // Make sure student belongs to the same school
    const student = await this.prisma.user.findFirst({
      where: { id: studentId, schoolId, role: 'STUDENT' },
    });
    if (!student) throw new NotFoundException('Student not found in this school');

    const already = await this.prisma.classroomStudent.findUnique({
      where: { classroomId_studentId: { classroomId, studentId } },
    });
    if (already) throw new ConflictException('Student already enrolled in this classroom');

    return this.prisma.classroomStudent.create({ data: { classroomId, studentId } });
  }

  async removeStudent(classroomId: string, studentId: string, schoolId: string) {
    await this.assertExists(classroomId, schoolId);
    await this.prisma.classroomStudent.delete({
      where: { classroomId_studentId: { classroomId, studentId } },
    });
    return { message: 'Student removed from classroom' };
  }

  async bulkAddStudents(classroomId: string, studentIds: string[], schoolId: string) {
    await this.assertExists(classroomId, schoolId);

    const students = await this.prisma.user.findMany({
      where: { id: { in: studentIds }, schoolId, role: 'STUDENT' },
      select: { id: true },
    });

    const found = students.map((s) => s.id);
    const notFound = studentIds.filter((id) => !found.includes(id));

    const existing = await this.prisma.classroomStudent.findMany({
      where: { classroomId, studentId: { in: found } },
      select: { studentId: true },
    });
    const existingIds = new Set(existing.map((e) => e.studentId));
    const toCreate = found.filter((id) => !existingIds.has(id));

    if (toCreate.length > 0) {
      await this.prisma.classroomStudent.createMany({
        data: toCreate.map((studentId) => ({ classroomId, studentId })),
      });
    }

    return { added: toCreate.length, skipped: existingIds.size, notFound };
  }

  // ─── Teacher Membership ───────────────────────────────────

  async listTeachers(classroomId: string, schoolId: string) {
    await this.assertExists(classroomId, schoolId);
    return this.prisma.classroomTeacher.findMany({
      where: { classroomId },
      include: {
        teacher: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  async addTeacher(
    classroomId: string,
    teacherId: string,
    schoolId: string,
    isPrimary = false,
  ) {
    await this.assertExists(classroomId, schoolId);

    const teacher = await this.prisma.user.findFirst({
      where: { id: teacherId, schoolId, role: 'TEACHER' },
    });
    if (!teacher) throw new NotFoundException('Teacher not found in this school');

    const already = await this.prisma.classroomTeacher.findUnique({
      where: { classroomId_teacherId: { classroomId, teacherId } },
    });
    if (already) throw new ConflictException('Teacher already assigned to this classroom');

    // If setting as primary, clear existing primary
    if (isPrimary) {
      await this.prisma.classroomTeacher.updateMany({
        where: { classroomId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return this.prisma.classroomTeacher.create({ data: { classroomId, teacherId, isPrimary } });
  }

  async removeTeacher(classroomId: string, teacherId: string, schoolId: string) {
    await this.assertExists(classroomId, schoolId);

    // Ensure at least 1 teacher remains
    const count = await this.prisma.classroomTeacher.count({ where: { classroomId } });
    if (count <= 1) {
      throw new ForbiddenException('Cannot remove the last teacher from a classroom');
    }

    await this.prisma.classroomTeacher.delete({
      where: { classroomId_teacherId: { classroomId, teacherId } },
    });
    return { message: 'Teacher removed from classroom' };
  }

  async setPrimaryTeacher(classroomId: string, teacherId: string, schoolId: string) {
    await this.assertExists(classroomId, schoolId);
    await this.prisma.classroomTeacher.updateMany({
      where: { classroomId, isPrimary: true },
      data: { isPrimary: false },
    });
    await this.prisma.classroomTeacher.update({
      where: { classroomId_teacherId: { classroomId, teacherId } },
      data: { isPrimary: true },
    });
    return { message: 'Primary teacher updated' };
  }

  // ─── Lesson Assignments ───────────────────────────────────

  async assignLesson(
    classroomId: string,
    schoolId: string,
    teacherId: string,
    data: { lessonId: string; dueDate?: string },
  ) {
    await this.assertExists(classroomId, schoolId);

    const lesson = await this.prisma.lesson.findFirst({
      where: { id: data.lessonId, schoolId, status: 'PUBLISHED' },
    });
    if (!lesson) throw new NotFoundException('Published lesson not found in this school');

    const already = await this.prisma.lessonAssignment.findFirst({
      where: { lessonId: data.lessonId, classroomId, status: 'ACTIVE' },
    });
    if (already) throw new ConflictException('This lesson is already assigned to this classroom');

    return this.prisma.lessonAssignment.create({
      data: {
        lessonId: data.lessonId,
        classroomId,
        schoolId,
        teacherId,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
      include: { lesson: { select: { id: true, title: true, subject: true, estimatedMinutes: true } } },
    });
  }

  async listAssignedLessons(classroomId: string, schoolId: string) {
    await this.assertExists(classroomId, schoolId);

    const assignments = await this.prisma.lessonAssignment.findMany({
      where: { classroomId, schoolId },
      include: {
        lesson: {
          select: {
            id: true, title: true, subject: true, gradeLevel: true,
            estimatedMinutes: true, tags: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Attach completion percentages for each lesson
    return Promise.all(
      assignments.map(async (a) => {
        const total = await this.prisma.classroomStudent.count({ where: { classroomId } });
        const done = await this.prisma.lessonProgress.count({
          where: { lessonId: a.lessonId, schoolId, completed: true },
        });
        return { ...a, completionRate: total > 0 ? Math.round((done / total) * 100) : 0 };
      }),
    );
  }

  async removeAssignedLesson(assignmentId: string, classroomId: string, schoolId: string) {
    await this.assertExists(classroomId, schoolId);
    const lesson = await this.prisma.lessonAssignment.findFirst({
      where: { id: assignmentId, classroomId },
    });
    if (!lesson) throw new NotFoundException('Assignment not found');
    await this.prisma.lessonAssignment.delete({ where: { id: assignmentId } });
    return { message: 'Lesson assignment removed' };
  }

  // ─── Game Assignments ─────────────────────────────────────

  async assignGame(
    classroomId: string,
    schoolId: string,
    teacherId: string,
    data: { gameId: string; minLevel?: number; dueDate?: string },
  ) {
    await this.assertExists(classroomId, schoolId);

    const game = await this.prisma.game.findFirst({
      where: { id: data.gameId, status: 'PUBLISHED' },
    });
    if (!game) throw new NotFoundException('Published game not found');

    const already = await this.prisma.gameAssignment.findFirst({
      where: { gameId: data.gameId, classroomId, status: 'ACTIVE' },
    });
    if (already) throw new ConflictException('This game is already assigned to this classroom');

    return this.prisma.gameAssignment.create({
      data: {
        gameId: data.gameId,
        classroomId,
        schoolId,
        teacherId,
        minLevel: data.minLevel ?? 1,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
      include: { game: { select: { id: true, title: true, subject: true, thumbnailUrl: true } } },
    });
  }

  async listAssignedGames(classroomId: string, schoolId: string) {
    await this.assertExists(classroomId, schoolId);

    const assignments = await this.prisma.gameAssignment.findMany({
      where: { classroomId, schoolId },
      include: {
        game: {
          select: { id: true, title: true, subject: true, thumbnailUrl: true, templateId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return assignments;
  }

  async removeAssignedGame(assignmentId: string, classroomId: string, schoolId: string) {
    await this.assertExists(classroomId, schoolId);
    const game = await this.prisma.gameAssignment.findFirst({
      where: { id: assignmentId, classroomId },
    });
    if (!game) throw new NotFoundException('Game assignment not found');
    await this.prisma.gameAssignment.delete({ where: { id: assignmentId } });
    return { message: 'Game assignment removed' };
  }

  // ─── Announcements ────────────────────────────────────────

  async createAnnouncement(
    classroomId: string,
    schoolId: string,
    teacherId: string,
    data: { title: string; body: string },
  ) {
    await this.assertExists(classroomId, schoolId);
    return this.prisma.announcement.create({
      data: { classroomId, teacherId, ...data },
    });
  }

  async listAnnouncements(classroomId: string, schoolId: string) {
    await this.assertExists(classroomId, schoolId);
    return this.prisma.announcement.findMany({
      where: { classroomId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  // ─── Class Dashboard ──────────────────────────────────────

  async getDashboard(classroomId: string, schoolId: string) {
    await this.assertExists(classroomId, schoolId);

    const cacheKey = `dashboard:classroom:${classroomId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const studentIds = (
      await this.prisma.classroomStudent.findMany({
        where: { classroomId },
        select: { studentId: true },
      })
    ).map((s) => s.studentId);

    const totalStudents = studentIds.length;

    // Lesson stats
    const [assignedLessons, completedLessons, assignedGames, gameProgress] = await Promise.all([
      this.prisma.lessonAssignment.count({ where: { classroomId } }),
      this.prisma.lessonProgress.count({
        where: { studentId: { in: studentIds }, completed: true },
      }),
      this.prisma.gameAssignment.count({ where: { classroomId } }),
      this.prisma.gameProgress.count({
        where: { studentId: { in: studentIds } },
      }),
    ]);

    // XP leaderboard (top 5)
    const topStudents = await this.prisma.xpLog.groupBy({
      by: ['userId'],
      where: { userId: { in: studentIds } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    });

    const topWithNames = await Promise.all(
      topStudents.map(async (ts) => {
        const user = await this.prisma.user.findUnique({
          where: { id: ts.userId },
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        });
        return { ...user, totalXp: ts._sum.amount ?? 0 };
      }),
    );

    const result = {
      totalStudents,
      assignedLessons,
      completedLessons,
      lessonCompletionRate: assignedLessons > 0 ? Math.round((completedLessons / (assignedLessons * totalStudents)) * 100) : 0,
      assignedGames,
      gameSessions: gameProgress,
      topStudents: topWithNames,
    };

    await this.redis.set(cacheKey, result, 120); // 2-minute cache
    return result;
  }

  // ─── Helpers ──────────────────────────────────────────────

  private async assertExists(id: string, schoolId: string) {
    const classroom = await this.prisma.classroom.findFirst({ where: { id, schoolId } });
    if (!classroom) throw new NotFoundException(`Classroom ${id} not found`);
    return classroom;
  }
}
