import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from './modules/orders/entities/order.entity';
import { Trade } from './modules/trades/entities/trade.entity';
import {
  Balance,
  WalletType,
} from './modules/balances/entities/balance.entity';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Trade)
    private tradeRepository: Repository<Trade>,
    @InjectRepository(Balance)
    private balanceRepository: Repository<Balance>,
    private dataSource: DataSource,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async resetData(): Promise<{
    message: string;
    orders_deleted: number;
    trades_deleted: number;
    balances_updated: { user_id: number; BTC: string; USDT: string }[];
  }> {
    return await this.dataSource.transaction(async (manager) => {
      try {
        // Xoá tất cả orders
        const deleteOrdersResult = await manager
          .createQueryBuilder()
          .delete()
          .from(Order)
          .execute();
        const ordersDeleted = deleteOrdersResult.affected || 0;

        // Xoá tất cả trades
        const deleteTradesResult = await manager
          .createQueryBuilder()
          .delete()
          .from(Trade)
          .execute();
        const tradesDeleted = deleteTradesResult.affected || 0;

        // Update balances cho user 1 và 2
        const balancesUpdated = [];

        for (const userId of [1, 2]) {
          // Cập nhật hoặc tạo BTC balance
          let btcBalance = await manager.findOne(Balance, {
            where: {
              user_id: userId,
              currency: 'BTC',
              wallet_type: WalletType.SPOT,
            },
          });

          if (btcBalance) {
            btcBalance.available = '10';
            btcBalance.locked = '0';
            await manager.save(btcBalance);
          } else {
            btcBalance = manager.create(Balance, {
              user_id: userId,
              currency: 'BTC',
              wallet_type: WalletType.SPOT,
              available: '10',
              locked: '0',
            });
            await manager.save(btcBalance);
          }

          // Cập nhật hoặc tạo USDT balance
          let usdtBalance = await manager.findOne(Balance, {
            where: {
              user_id: userId,
              currency: 'USDT',
              wallet_type: WalletType.SPOT,
            },
          });

          if (usdtBalance) {
            usdtBalance.available = '100000';
            usdtBalance.locked = '0';
            await manager.save(usdtBalance);
          } else {
            usdtBalance = manager.create(Balance, {
              user_id: userId,
              currency: 'USDT',
              wallet_type: WalletType.SPOT,
              available: '100000',
              locked: '0',
            });
            await manager.save(usdtBalance);
          }

          balancesUpdated.push({
            user_id: userId,
            BTC: '10',
            USDT: '100000',
          });
        }

        return {
          message: 'Data reset successfully',
          orders_deleted: ordersDeleted,
          trades_deleted: tradesDeleted,
          balances_updated: balancesUpdated,
        };
      } catch (error) {
        throw new BadRequestException(`Failed to reset data: ${error.message}`);
      }
    });
  }
}
