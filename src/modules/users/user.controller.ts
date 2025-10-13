import { UserService } from './user.service';
import {
  Controller,
  Get,
  Param,
  UseGuards,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Put,
  Body,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './entities/user.entity';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getAllUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return await this.userService.getAllUsers(page, limit);
  }

  @Get('/me')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@Request() req) {
    return await this.userService.getUserById(req.user.id);
  }

  @Get('/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    return await this.userService.getUserById(id);
  }
}
