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

  async resetData(
    currencies: { currency: string; amount: string }[] = [
      { currency: 'BTC', amount: '100' },
      { currency: 'USDT', amount: '1000000' },
      { currency: 'ETH', amount: '1000' },
    ],
    userIds: number[] = [1, 2, 3],
  ): Promise<{
    message: string;
    orders_deleted: number;
    trades_deleted: number;
    balances_updated: any[];
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

        // Update balances cho users
        const balancesUpdated = [];

        for (const userId of userIds) {
          const userBalances: any = { user_id: userId };

          // Loop qua từng currency
          for (const { currency, amount } of currencies) {
            let balance = await manager.findOne(Balance, {
              where: {
                user_id: userId,
                currency: currency,
                wallet_type: WalletType.SPOT,
              },
            });

            if (balance) {
              balance.available = amount;
              balance.locked = '0';
              await manager.save(balance);
            } else {
              balance = manager.create(Balance, {
                user_id: userId,
                currency: currency,
                wallet_type: WalletType.SPOT,
                available: amount,
                locked: '0',
              });
              await manager.save(balance);
            }

            userBalances[currency] = amount;
          }

          balancesUpdated.push(userBalances);
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
