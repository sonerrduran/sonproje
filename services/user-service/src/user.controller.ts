import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from './user.service';
import {
  CreateProfileDto,
  UpdateProfileDto,
  CreateStudentProfileDto,
  UpdateStudentProfileDto,
  AddStarsDto,
} from './dto/user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ═══════════════════════════════════════════════════════════
  // USER PROFILE ENDPOINTS
  // ═══════════════════════════════════════════════════════════

  @Post('profiles')
  @HttpCode(HttpStatus.CREATED)
  async createProfile(@Body() createProfileDto: CreateProfileDto) {
    return this.userService.createProfile(createProfileDto);
  }

  @Get('profiles/:userId')
  async getProfile(@Param('userId') userId: string) {
    const profile = await this.userService.getProfile(userId);
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return {
      success: true,
      data: profile,
    };
  }

  @Put('profiles/:userId')
  async updateProfile(
    @Param('userId') userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    const profile = await this.userService.updateProfile(
      userId,
      updateProfileDto,
    );
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return {
      success: true,
      data: profile,
    };
  }

  @Delete('profiles/:userId')
  async deleteProfile(@Param('userId') userId: string) {
    const deleted = await this.userService.deleteProfile(userId);
    if (!deleted) {
      throw new NotFoundException('Profile not found');
    }
    return {
      success: true,
      data: { message: 'Profile deleted successfully' },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // STUDENT PROFILE ENDPOINTS
  // ═══════════════════════════════════════════════════════════

  @Post('students')
  @HttpCode(HttpStatus.CREATED)
  async createStudentProfile(
    @Body() createStudentProfileDto: CreateStudentProfileDto,
  ) {
    return this.userService.createStudentProfile(createStudentProfileDto);
  }

  @Get('students/:userId')
  async getStudentProfile(@Param('userId') userId: string) {
    const studentProfile = await this.userService.getStudentProfile(userId);
    if (!studentProfile) {
      throw new NotFoundException('Student profile not found');
    }
    return {
      success: true,
      data: studentProfile,
    };
  }

  @Put('students/:userId')
  async updateStudentProfile(
    @Param('userId') userId: string,
    @Body() updateStudentProfileDto: UpdateStudentProfileDto,
  ) {
    const studentProfile = await this.userService.updateStudentProfile(
      userId,
      updateStudentProfileDto,
    );
    if (!studentProfile) {
      throw new NotFoundException('Student profile not found');
    }
    return {
      success: true,
      data: studentProfile,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // STUDENT ACTIONS
  // ═══════════════════════════════════════════════════════════

  @Post('students/:userId/stars')
  async addStars(
    @Param('userId') userId: string,
    @Body() addStarsDto: AddStarsDto,
  ) {
    const studentProfile = await this.userService.addStars(
      userId,
      addStarsDto.stars,
    );
    if (!studentProfile) {
      throw new NotFoundException('Student profile not found');
    }
    return {
      success: true,
      data: studentProfile,
    };
  }

  @Post('students/:userId/xp')
  async addXp(
    @Param('userId') userId: string,
    @Body() body: { xp: number },
  ) {
    const studentProfile = await this.userService.addXp(userId, body.xp);
    if (!studentProfile) {
      throw new NotFoundException('Student profile not found');
    }
    return {
      success: true,
      data: studentProfile,
    };
  }

  @Post('students/:userId/streak')
  async updateStreak(@Param('userId') userId: string) {
    const studentProfile = await this.userService.updateStreak(userId);
    if (!studentProfile) {
      throw new NotFoundException('Student profile not found');
    }
    return {
      success: true,
      data: studentProfile,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // LEADERBOARD
  // ═══════════════════════════════════════════════════════════

  @Get('leaderboard')
  async getLeaderboard(@Query('limit') limit?: string) {
    const leaderboard = await this.userService.getLeaderboard(
      limit ? parseInt(limit) : 10,
    );
    return {
      success: true,
      data: leaderboard,
    };
  }

  @Get('leaderboard/school/:schoolId')
  async getSchoolLeaderboard(
    @Param('schoolId') schoolId: string,
    @Query('limit') limit?: string,
  ) {
    const leaderboard = await this.userService.getSchoolLeaderboard(
      schoolId,
      limit ? parseInt(limit) : 10,
    );
    return {
      success: true,
      data: leaderboard,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════

  @Get('stats/:userId')
  async getUserStats(@Param('userId') userId: string) {
    const stats = await this.userService.getUserStats(userId);
    if (!stats) {
      throw new NotFoundException('User not found');
    }
    return {
      success: true,
      data: stats,
    };
  }
}
