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

  // 📈 Lấy tất cả symbols (public endpoint)
  @Get()
  async getAllSymbols(@Query() filters: SymbolFilterDto) {
    return await this.symbolService.getAllSymbols(filters);
  }

  // 📈 Lấy symbols đang trading (public endpoint)
  @Get('/trading')
  async getTradingSymbols() {
    return await this.symbolService.getTradingSymbols();
  }

  // 📈 Lấy symbol theo tên (public endpoint)
  @Get('/:symbol')
  async getSymbolBySymbol(@Param('symbol') symbol: string) {
    return await this.symbolService.getSymbolBySymbol(symbol);
  }

  // 📈 Lấy symbols theo base asset (public endpoint)
  @Get('/base/:baseAsset')
  async getSymbolsByBaseAsset(@Param('baseAsset') baseAsset: string) {
    return await this.symbolService.getSymbolsByBaseAsset(baseAsset);
  }

  // 📈 Lấy symbols theo quote asset (public endpoint)
  @Get('/quote/:quoteAsset')
  async getSymbolsByQuoteAsset(@Param('quoteAsset') quoteAsset: string) {
    return await this.symbolService.getSymbolsByQuoteAsset(quoteAsset);
  }

  // 📈 Lấy symbols theo status (public endpoint)
  @Get('/status/:status')
  async getSymbolsByStatus(@Param('status') status: string) {
    return await this.symbolService.getSymbolsByStatus(status);
  }

  // 🔒 ADMIN ENDPOINTS - Cần authentication
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN) // 👑 Chỉ admin tạo symbols
  async createSymbol(@Body() createSymbolDto: CreateSymbolDto) {
    return await this.symbolService.createSymbol(createSymbolDto);
  }

  @Put('/:symbol')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN) // 👑 Chỉ admin update symbols
  async updateSymbol(
    @Param('symbol') symbol: string,
    @Body() updateSymbolDto: UpdateSymbolDto,
  ) {
    return await this.symbolService.updateSymbol(symbol, updateSymbolDto);
  }

  @Delete('/:symbol')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN) // 👑 Chỉ admin xóa symbols
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSymbol(@Param('symbol') symbol: string) {
    await this.symbolService.deleteSymbol(symbol);
  }

  @Put('/:symbol/toggle-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN) // 👑 Chỉ admin toggle status
  async toggleSymbolStatus(@Param('symbol') symbol: string) {
    return await this.symbolService.toggleSymbolStatus(symbol);
  }
}
