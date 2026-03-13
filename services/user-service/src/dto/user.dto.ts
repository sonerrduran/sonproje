import { IsString, IsOptional, IsInt, IsEmail, Min } from 'class-validator';

export class CreateProfileDto {
  @IsString()
  userId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsInt()
  gradeLevel?: number;

  @IsOptional()
  @IsString()
  avatar?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsInt()
  gradeLevel?: number;
}

export class CreateStudentProfileDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  gradeLevel?: number;

  @IsOptional()
  @IsString()
  schoolId?: string;
}

export class UpdateStudentProfileDto {
  @IsOptional()
  @IsInt()
  gradeLevel?: number;

  @IsOptional()
  @IsString()
  schoolId?: string;
}

export class AddStarsDto {
  @IsInt()
  @Min(1)
  stars: number;
}
