import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TeachersController } from './controllers/teachers.controller';
import { StudentsController } from './controllers/students.controller';
import { ParentsController } from './controllers/parents.controller';

/**
 * Users Module — User Management System
 *
 * Controllers:
 *  - UsersController    → /api/v1/users       (admin: any role)
 *  - TeachersController → /api/v1/teachers    (admin: teachers)
 *  - StudentsController → /api/v1/students    (admin/teacher: students)
 *  - ParentsController  → /api/v1/parents     (admin: parents)
 *
 * The UsersService is shared by all controllers.
 */
@Module({
  controllers: [
    UsersController,
    TeachersController,
    StudentsController,
    ParentsController,
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
