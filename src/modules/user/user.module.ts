import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // Import TypeOrmModule để sử dụng repository pattern
import { UserController } from './user.controller'; // Import UserController (đã sửa đường dẫn)
import { UserService } from './user.service'; // Import UserService (đã sửa đường dẫn)
import { User } from './entities/user.entity'; // Import User entity

@Module({
  imports: [
    // TypeOrmModule.forFeature: Đăng ký User entity để có thể inject UserRepository
    // vào UserService để thực hiện các operations với database
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [UserController], // Controllers xử lý HTTP requests
  providers: [UserService], // Services chứa business logic
  exports: [UserService], // Export UserService để các module khác có thể sử dụng
})
export class UserModule {}
