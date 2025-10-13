import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET || 'your_secret_key',
    });
  }

  async validate(payload: any) {
    const { sub: user_id } = payload;
    const user = await this.userRepository.findOne({ where: { id: user_id } });

    if (!user) {
      throw new UnauthorizedException('Token không hợp lệ');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa');
    }

    // Trả về user (không có password) - sẽ được inject vào @Req() user
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
