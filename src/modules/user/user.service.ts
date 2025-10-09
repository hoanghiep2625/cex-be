import { Body, Injectable } from '@nestjs/common';
import { UserDto } from 'src/modules/user/dto/user.dto';

@Injectable()
export class UserService {
  private users = [
    { id: 1, name: 'hoanghiep', email: 'hoanghiep@example.com' },
    { id: 2, name: 'john', email: 'john@example.com' },
    { id: 3, name: 'jane', email: 'jane@example.com' },
  ];

  getAllUsers() {
    return this.users;
  }

  getUserById(id: number) {
    return this.users.find((item) => item.id === Number(id));
  }

  createUser(@Body() userDto: UserDto) {
    this.users.push({ id: this.users.length + 1, ...userDto });
    return this.users;
  }

  updateUser(@Body() userDto: UserDto, id: number) {
    const user = this.users.find((item) => item.id === Number(id));
    if (user) {
      Object.assign(user, userDto);
    }
    return this.users;
  }

  deleteUser(id: number) {
    this.users = this.users.filter((item) => item.id !== Number(id));
    return this.users;
  }
}
