import {
  IsEmail, IsString, IsOptional, IsEnum, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'ali.yilmaz@school.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Temp1234!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Ali' })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: 'Yılmaz' })
  @IsString()
  lastName!: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiPropertyOptional({ example: 'tr' })
  @IsOptional()
  @IsString()
  language?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'tr' })
  @IsOptional()
  @IsString()
  language?: string;
}

export class LinkParentDto {
  @ApiProperty({ description: 'Parent user ID to link' })
  @IsString()
  parentId!: string;
}
