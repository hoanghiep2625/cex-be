import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async getAllUsers(
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: User[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [data, total] = await this.userRepository.findAndCount({
      skip,
      take: limit,
      order: { id: 'DESC' },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getUserById(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Remove password từ response
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  /**
   * 🔐 Verify access token và lấy user dựa trên id trong token
   * @param accessToken - Access token từ client
   * @returns User info (email, username, created_at, updated_at)
   */
  async getUserByAccessToken(accessToken: string): Promise<{
    email: string;
    username: string;
    created_at: Date;
    updated_at: Date;
  }> {
    try {
      console.log('🔍 Verifying token:', accessToken.substring(0, 20) + '...');

      // Verify token
      const payload = this.jwtService.verify(accessToken, {
        secret: process.env.JWT_ACCESS_SECRET,
      });

      console.log('✅ Token verified, user id:', payload.sub);

      // Lấy user dựa trên id trong token
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        console.error('❌ User not found with id:', payload.sub);
        throw new NotFoundException('User not found');
      }

      console.log('✅ User found and returning:', user.email);

      // Chỉ trả về fields cần thiết
      return {
        email: user.email,
        username: user.username,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };
    } catch (error) {
      console.error('❌ Error in getUserByAccessToken:', error.message);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
