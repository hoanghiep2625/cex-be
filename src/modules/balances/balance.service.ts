import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Balance } from './entities/balance.entity';
import {
  CreateBalanceDto,
  TransferBalanceDto,
  LockBalanceDto,
} from './dto/balance.dto';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(Balance)
    private balanceRepository: Repository<Balance>,
    private dataSource: DataSource,
  ) {}

  // Lấy tất cả balances của user
  async getUserBalances(user_id: number): Promise<Balance[]> {
    return await this.balanceRepository.find({
      where: { user_id },
      relations: ['asset'],
      order: { currency: 'ASC' },
    });
  }

  // Lấy balance của 1 currency
  async getUserBalance(user_id: number, currency: string): Promise<Balance> {
    const balance = await this.balanceRepository.findOne({
      where: { user_id, currency },
      relations: ['asset'],
    });

    if (!balance) {
      throw new NotFoundException(`Balance not found for ${currency}`);
    }

    return balance;
  }

  // Tạo balance mới cho user
  async createBalance(
    user_id: number,
    createBalanceDto: CreateBalanceDto,
  ): Promise<Balance> {
    // Check if balance already exists
    const existingBalance = await this.balanceRepository.findOne({
      where: { user_id, currency: createBalanceDto.currency },
    });

    if (existingBalance) {
      throw new ConflictException(
        `Balance for ${createBalanceDto.currency} already exists`,
      );
    }

    const balance = this.balanceRepository.create({
      user_id,
      currency: createBalanceDto.currency,
      available: createBalanceDto.available || '0',
      locked: '0',
    });

    return await this.balanceRepository.save(balance);
  }

  // Lock balance (khi đặt lệnh)
  async lockBalance(
    user_id: number,
    lockDto: LockBalanceDto,
  ): Promise<Balance> {
    return await this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOne(Balance, {
        where: { user_id, currency: lockDto.currency },
        lock: { mode: 'pessimistic_write' },
      });

      if (!balance) {
        throw new NotFoundException(
          `Balance for ${lockDto.currency} not found`,
        );
      }

      const availableNum = parseFloat(balance.available);
      const lockAmount = parseFloat(lockDto.amount);

      if (availableNum < lockAmount) {
        throw new BadRequestException('Insufficient available balance');
      }

      // Move from available to locked
      balance.available = (availableNum - lockAmount).toString();
      balance.locked = (parseFloat(balance.locked) + lockAmount).toString();

      return await manager.save(balance);
    });
  }

  // Unlock balance (khi hủy lệnh)
  async unlockBalance(
    user_id: number,
    lockDto: LockBalanceDto,
  ): Promise<Balance> {
    return await this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOne(Balance, {
        where: { user_id, currency: lockDto.currency },
        lock: { mode: 'pessimistic_write' },
      });

      if (!balance) {
        throw new NotFoundException(
          `Balance for ${lockDto.currency} not found`,
        );
      }

      const lockedNum = parseFloat(balance.locked);
      const unlockAmount = parseFloat(lockDto.amount);

      if (lockedNum < unlockAmount) {
        throw new BadRequestException('Insufficient locked balance');
      }

      // Move from locked to available
      balance.locked = (lockedNum - unlockAmount).toString();
      balance.available = (
        parseFloat(balance.available) + unlockAmount
      ).toString();

      return await manager.save(balance);
    });
  }

}
