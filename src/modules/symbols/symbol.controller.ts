import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SymbolService } from './symbol.service';
import {
  CreateSymbolDto,
  UpdateSymbolDto,
  SymbolFilterDto,
} from './dto/symbol.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { UserRole } from 'src/modules/users/entities/user.entity';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';

@Controller('symbols')
export class SymbolController {
  constructor(private readonly symbolService: SymbolService) {}

  @Get()
  async getAllSymbols(@Query() filters: SymbolFilterDto) {
    return await this.symbolService.getAllSymbols(filters);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN) // 👑 Chỉ admin tạo symbols
  async createSymbol(@Body() createSymbolDto: CreateSymbolDto) {
    return await this.symbolService.createSymbol(createSymbolDto);
  }
}
