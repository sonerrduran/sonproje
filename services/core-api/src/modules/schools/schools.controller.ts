import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { SchoolsService } from './schools.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentSchool } from '../../common/decorators/current-user.decorator';

@ApiTags('schools')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schools')
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current school details' })
  findMySchool(@CurrentSchool() schoolId: string) {
    return this.schoolsService.findById(schoolId);
  }

  @Get('me/stats')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get school usage statistics' })
  getStats(@CurrentSchool() schoolId: string) {
    return this.schoolsService.getStats(schoolId);
  }

  @Patch('me')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update school information' })
  update(
    @CurrentSchool() schoolId: string,
    @Body() data: { name?: string; email?: string; phone?: string; country?: string },
  ) {
    return this.schoolsService.update(schoolId, data);
  }

  @Patch('me/branding')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update school branding (logo, colors)' })
  updateBranding(
    @CurrentSchool() schoolId: string,
    @Body() branding: Record<string, unknown>,
  ) {
    return this.schoolsService.updateBranding(schoolId, branding);
  }

  @Patch('me/config')
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update school configuration settings' })
  updateConfig(
    @CurrentSchool() schoolId: string,
    @Body() config: Record<string, unknown>,
  ) {
    return this.schoolsService.updateConfig(schoolId, config);
  }

  // Super admin: access any school by ID
  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: '[Super Admin] Get any school by ID' })
  findOne(@Param('id') id: string) {
    return this.schoolsService.findById(id);
  }
}
