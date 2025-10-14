import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Balance, WalletType } from './entities/balance.entity';
import {
  CreateBalanceDto,
  LockBalanceDto,
  TransferBetweenWalletsDto,
} from './dto/balance.dto';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(Balance)
    private balanceRepository: Repository<Balance>,
    private dataSource: DataSource,
  ) {}

  // Lấy tất cả balances của user
  async getUserBalances(
    user_id: number,
    wallet_type?: WalletType,
  ): Promise<Balance[]> {
    const where: any = { user_id };
    if (wallet_type) {
      where.wallet_type = wallet_type;
    }

    return await this.balanceRepository.find({
      where,
      relations: ['asset'],
      order: { currency: 'ASC' },
    });
  }

  // Lấy balance của 1 currency
  async getUserBalance(
    user_id: number,
    currency: string,
    wallet_type: WalletType = WalletType.FUNDING,
  ): Promise<Balance> {
    const balance = await this.balanceRepository.findOne({
      where: { user_id, currency, wallet_type },
      relations: ['asset'],
    });

    if (!balance) {
      throw new NotFoundException(
        `Balance not found for ${currency} in ${wallet_type} wallet`,
      );
    }

    return balance;
  }

  // Tạo balance mới cho user
  async createBalance(
    user_id: number,
    createBalanceDto: CreateBalanceDto,
  ): Promise<Balance> {
    const wallet_type = createBalanceDto.wallet_type || WalletType.FUNDING;

    // Check if balance already exists
    const existingBalance = await this.balanceRepository.findOne({
      where: { user_id, currency: createBalanceDto.currency, wallet_type },
    });

    if (existingBalance) {
      throw new ConflictException(
        `Balance for ${createBalanceDto.currency} in ${wallet_type} wallet already exists`,
      );
    }

    const balance = this.balanceRepository.create({
      user_id,
      currency: createBalanceDto.currency,
      wallet_type,
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
    const wallet_type = lockDto.wallet_type || WalletType.FUNDING;

    return await this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOne(Balance, {
        where: { user_id, currency: lockDto.currency, wallet_type },
        lock: { mode: 'pessimistic_write' },
      });

      if (!balance) {
        throw new NotFoundException(
          `Balance for ${lockDto.currency} in ${wallet_type} wallet not found`,
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
    const wallet_type = lockDto.wallet_type || WalletType.FUNDING;

    return await this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOne(Balance, {
        where: { user_id, currency: lockDto.currency, wallet_type },
        lock: { mode: 'pessimistic_write' },
      });

      if (!balance) {
        throw new NotFoundException(
          `Balance for ${lockDto.currency} in ${wallet_type} wallet not found`,
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

  // Chuyển balance từ ví này sang ví khác
  async transferBetweenWallets(
    user_id: number,
    transferDto: TransferBetweenWalletsDto,
  ): Promise<{ from_balance: Balance; to_balance: Balance }> {
    return await this.dataSource.transaction(async (manager) => {
      const { currency, amount, from_wallet_type, to_wallet_type } =
        transferDto;

      // Validate same wallet type
      if (from_wallet_type === to_wallet_type) {
        throw new BadRequestException(
          'Cannot transfer to the same wallet type',
        );
      }

      // Get source balance with lock
      const fromBalance = await manager.findOne(Balance, {
        where: { user_id, currency, wallet_type: from_wallet_type },
        lock: { mode: 'pessimistic_write' },
      });

      if (!fromBalance) {
        throw new NotFoundException(
          `No ${currency} balance found in ${from_wallet_type} wallet`,
        );
      }

      const availableAmount = parseFloat(fromBalance.available);
      const transferAmount = parseFloat(amount);

      if (availableAmount < transferAmount) {
        throw new BadRequestException(
          `Insufficient ${currency} balance in ${from_wallet_type} wallet`,
        );
      }

      // Get or create destination balance
      let toBalance = await manager.findOne(Balance, {
        where: { user_id, currency, wallet_type: to_wallet_type },
        lock: { mode: 'pessimistic_write' },
      });

      if (!toBalance) {
        // Create new balance for destination wallet
        toBalance = manager.create(Balance, {
          user_id,
          currency,
          wallet_type: to_wallet_type,
          available: '0',
          locked: '0',
        });
        toBalance = await manager.save(toBalance);
      }

      // Update balances
      await manager.update(Balance, fromBalance.id, {
        available: (availableAmount - transferAmount).toString(),
      });

      await manager.update(Balance, toBalance.id, {
        available: (
          parseFloat(toBalance.available) + transferAmount
        ).toString(),
      });

      // Return updated balances
      const updatedFromBalance = await manager.findOne(Balance, {
        where: { id: fromBalance.id },
        relations: ['asset'],
      });

      const updatedToBalance = await manager.findOne(Balance, {
        where: { id: toBalance.id },
        relations: ['asset'],
      });

      return {
        from_balance: updatedFromBalance,
        to_balance: updatedToBalance,
      };
    });
  }
}
