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
  LockBalanceDto,
  TransferBetweenWalletsDto,
} from './dto/balance.dto';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { UserRole } from 'src/modules/users/entities/user.entity';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';

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
  @UseGuards(JwtAuthGuard, RolesGuard) // TODO: Add admin role guard
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
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
  async transferBetweenWallets(
    @Request() req,
    @Body() transferDto: TransferBetweenWalletsDto,
  ) {
    // Chuyển balance từ ví này sang ví khác
    return await this.balanceService.transferBetweenWallets(
      req.user.id,
      transferDto,
    );
  }
}
