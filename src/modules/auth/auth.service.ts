import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../user/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  // Generate access token (1 hour)
  generateAccessToken(user: User): string {
    const payload = {
      email: user.email,
      sub: user.id,
      username: user.username,
    };
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: '1h',
    });
  }

  // Generate refresh token (30 days)
  generateRefreshToken(user: User): string {
    const payload = { sub: user.id };
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '30d',
    });
  }

  async register(
    registerDto: RegisterDto,
  ): Promise<{ message: string; user: Partial<User> }> {
    try {
      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(
        registerDto.password,
        saltRounds,
      );

      // Tạo user mới
      const user = this.userRepository.create({
        ...registerDto,
        password: hashedPassword,
      });

      const savedUser = await this.userRepository.save(user);

      // Trả về user không có password
      const { password, ...userWithoutPassword } = savedUser;

      return {
        message: 'Đăng ký thành công',
        user: userWithoutPassword,
      };
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException(`Email '${registerDto.email}' đã tồn tại`);
      }
      throw error;
    }
  }

  async login(loginDto: LoginDto): Promise<{
    message: string;
    user: Partial<User>;
    accessToken: string;
    refreshToken: string;
  }> {
    // Tìm user theo email
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // Kiểm tra password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Trả về user không có password
    const { password, ...userWithoutPassword } = user;

    return {
      message: 'Đăng nhập thành công',
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  // Verify refresh token và tạo access token mới
  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Refresh token không hợp lệ');
      }

      const newAccessToken = this.generateAccessToken(user);

      return { accessToken: newAccessToken };
    } catch (error) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }
  }
}
