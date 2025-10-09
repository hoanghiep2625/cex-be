import { UserService } from 'src/modules/user/user.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { UserDto } from 'src/modules/user/dto/user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  getAllUsers() {
    return this.userService.getAllUsers();
  }

  @Get('/:id')
  getUserById(@Param('id') id: number) {
    return this.userService.getUserById(id);
  }

  @Post()
  createUser(@Body() userDto: UserDto) {
    return this.userService.createUser(userDto);
  }

  @Put('/:id')
  updateUser(@Body() userDto: UserDto, @Param('id') id: number) {
    return this.userService.updateUser(userDto, id);
  }

  @Delete('/:id')
  deleteUser(@Param('id') id: number) {
    return this.userService.deleteUser(id);
  }
}
