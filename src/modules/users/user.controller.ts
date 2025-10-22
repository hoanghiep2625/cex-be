import { UserService } from './user.service';
import {
  Controller,
  Get,
  Param,
  UseGuards,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
  Headers,
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
  async getMyProfileByToken(@Headers('authorization') authHeader: string) {
    if (!authHeader) {
      throw new BadRequestException('Authorization header is required');
    }
    // Tách "Bearer TOKEN" thành TOKEN
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new BadRequestException(
        'Invalid authorization header format. Expected: Bearer <token>',
      );
    }

    const token = parts[1];
    return await this.userService.getUserByAccessToken(token);
  }

  @Get('/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    return await this.userService.getUserById(id);
  }
}
