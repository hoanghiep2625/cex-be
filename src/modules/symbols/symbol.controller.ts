import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { SymbolService } from './symbol.service';
import { CreateSymbolDto, SymbolFilterDto } from './dto/symbol.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { UserRole } from 'src/modules/users/entities/user.entity';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';

@Controller('symbols')
export class SymbolController {
  constructor(private readonly symbolService: SymbolService) {}

  @Get()
  async getAllSymbols(@Query() filters: SymbolFilterDto) {
    const result = await this.symbolService.getAllSymbols(filters);

    // Trả về kèm theo query parameters
    return {
      data: result,
      from: filters.from || null,
      type: filters.type || 'spot',
    };
  }

  /**
   * 📊 Lấy market data cho một symbol
   * GET /symbols/market-data/BTCUSDT?type=spot
   */
  @Get('market-data/:symbol')
  async getMarketData(
    @Param('symbol') symbol: string,
    @Query('type') type: string = 'spot',
  ) {
    return await this.symbolService.getMarketData(symbol, type);
  }

  @Get('code/:code')
  async getSymbolByCode(
    @Param('code') code: string,
    @Query('type') type: string = 'spot',
  ) {
    return await this.symbolService.getSymbolBySymbolAndType(code, type);
  }

  @Get(':symbol/:type')
  async getSymbolBySymbolAndType(
    @Param('symbol') symbol: string,
    @Param('type') type: string,
  ) {
    return await this.symbolService.getSymbolBySymbolAndType(symbol, type);
  }

  @Get(':id')
  async getSymbolById(@Param('id', ParseIntPipe) id: number) {
    return await this.symbolService.getSymbolById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async createSymbol(@Body() createSymbolDto: CreateSymbolDto) {
    return await this.symbolService.createSymbol(createSymbolDto);
  }
}
