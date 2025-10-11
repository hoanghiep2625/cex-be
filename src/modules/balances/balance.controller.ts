import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BalanceService } from './balance.service';
import {
  CreateBalanceDto,
  TransferBalanceDto,
  LockBalanceDto,
} from './dto/balance.dto';

@Controller('balance')
@UseGuards(JwtAuthGuard) // Require authentication for all routes
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get()
  async getMyBalances(@Request() req) {
    // Lấy tất cả balances của user hiện tại
    return await this.balanceService.getUserBalances(req.user.id);
  }

  @Get('/:currency')
  async getMyBalance(@Request() req, @Param('currency') currency: string) {
    // Lấy balance của 1 currency cụ thể
    return await this.balanceService.getUserBalance(
      req.user.id,
      currency.toUpperCase(),
    );
  }

  @Post()
  async createBalance(
    @Request() req,
    @Body() createBalanceDto: CreateBalanceDto,
  ) {
    // Tạo balance mới cho currency
    return await this.balanceService.createBalance(
      req.user.id,
      createBalanceDto,
    );
  }

  @Post('/lock')
  async lockBalance(@Request() req, @Body() lockDto: LockBalanceDto) {
    // Lock balance (cho trading)
    return await this.balanceService.lockBalance(req.user.id, lockDto);
  }

  @Post('/unlock')
  async unlockBalance(@Request() req, @Body() lockDto: LockBalanceDto) {
    // Unlock balance (hủy lệnh)
    return await this.balanceService.unlockBalance(req.user.id, lockDto);
  }

  @Post('/transfer')
  async transferBalance(
    @Request() req,
    @Body() transferDto: TransferBalanceDto,
  ) {
    // Transfer balance cho user khác
    return await this.balanceService.transferBalance(req.user.id, transferDto);
  }
}
