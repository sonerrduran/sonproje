import { Module } from '@nestjs/common';
import { ClassroomsService } from './classrooms.service';
import { ClassroomsController } from './classrooms.controller';
import { ClassroomMembersController } from './controllers/classroom-members.controller';
import { ClassroomContentController } from './controllers/classroom-content.controller';
import { ClassroomDashboardController } from './controllers/classroom-dashboard.controller';

/**
 * Classrooms Module — Classroom Management System
 *
 * Controllers mounted under /api/v1/classrooms:
 *  - ClassroomsController          → CRUD, archive, restore
 *  - ClassroomMembersController    → /:id/students, /:id/teachers
 *  - ClassroomContentController    → /:id/lessons, /:id/games
 *  - ClassroomDashboardController  → /:id/dashboard, /:id/announcements
 */
@Module({
  controllers: [
    ClassroomsController,
    ClassroomMembersController,
    ClassroomContentController,
    ClassroomDashboardController,
  ],
  providers: [ClassroomsService],
  exports: [ClassroomsService],
})
export class ClassroomsModule {}
