import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'student@school.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SecurePass123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Ali' })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: 'Yılmaz' })
  @IsString()
  lastName!: string;

  @ApiProperty({ example: 'school-uuid-here' })
  @IsString()
  schoolId!: string;

  @ApiProperty({ enum: UserRole, required: false, default: UserRole.STUDENT })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({ required: false, example: 'tr' })
  @IsOptional()
  @IsString()
  language?: string;
}
