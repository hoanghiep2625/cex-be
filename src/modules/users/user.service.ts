import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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

  // 👑 Admin: Update user role
  async updateUserRole(id: number, role: UserRole): Promise<User> {
    const user = await this.getUserById(id);

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Cannot change role of super admin');
    }

    await this.userRepository.update(id, { role });
    return await this.getUserById(id);
  }

  // 👑 Admin: Toggle user active status
  async toggleUserActive(id: number): Promise<User> {
    const user = await this.getUserById(id);

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Cannot disable super admin');
    }

    await this.userRepository.update(id, { isActive: !user.isActive });
    return await this.getUserById(id);
  }

  // 📊 Admin: Get user statistics
  async getUserStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    admins: number;
    users: number;
  }> {
    const [total, active, admins] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { isActive: true } }),
      this.userRepository.count({ where: { role: UserRole.ADMIN } }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
      admins,
      users: total - admins,
    };
  }
}
