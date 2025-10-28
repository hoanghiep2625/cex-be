import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from './modules/orders/entities/order.entity';
import { Trade } from './modules/trades/entities/trade.entity';
import {
  Balance,
  WalletType,
} from './modules/balances/entities/balance.entity';
import { RedisService } from './modules/redis/redis.service';

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
    private redisService: RedisService,
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
    redis_orderbook_cleared: boolean;
  }> {
    // Retry logic để handle deadlock
    let retries = 3;
    while (retries > 0) {
      try {
        return await this._resetDataTransaction(currencies, userIds);
      } catch (error) {
        if (error.message.includes('deadlock') && retries > 1) {
          console.log(
            `⚠️ Deadlock detected, retrying... (${retries - 1} left)`,
          );
          retries--;
          await this.sleep(100); // Wait 100ms before retry
          continue;
        }
        throw new BadRequestException(`Failed to reset data: ${error.message}`);
      }
    }
  }

  private async _resetDataTransaction(
    currencies: { currency: string; amount: string }[],
    userIds: number[],
  ): Promise<{
    message: string;
    orders_deleted: number;
    trades_deleted: number;
    balances_updated: any[];
    redis_orderbook_cleared: boolean;
  }> {
    return await this.dataSource.transaction(
      'READ COMMITTED', // Lower isolation level to reduce deadlocks
      async (manager) => {
        // Step 1: Xoá orders và trades (không lock balances)
        const deleteOrdersResult = await manager
          .createQueryBuilder()
          .delete()
          .from(Order)
          .execute();
        const ordersDeleted = deleteOrdersResult.affected || 0;

        const deleteTradesResult = await manager
          .createQueryBuilder()
          .delete()
          .from(Trade)
          .execute();
        const tradesDeleted = deleteTradesResult.affected || 0;

        // Step 2: Clear Redis orderbook (all symbols)
        let redisCleared = false;
        try {
          const client = this.redisService.getClient();
          const orderbookKeys = await client.keys('orderbook:*');

          if (orderbookKeys.length > 0) {
            await client.del(...orderbookKeys);
            console.log(
              `🧹 Cleared ${orderbookKeys.length} orderbook keys from Redis`,
            );
          }

          redisCleared = true;
        } catch (error) {
          console.error(`❌ Failed to clear Redis orderbook: ${error.message}`);
          // Continue anyway - don't fail entire reset
        }

        // Step 3: Update balances - xử lý tuần tự từng user để tránh deadlock
        const balancesUpdated = [];

        for (const userId of userIds) {
          const userBalances: any = { user_id: userId };

          // Loop qua từng currency
          for (const { currency, amount } of currencies) {
            // Use UPSERT to avoid deadlock
            await manager.query(
              `
              INSERT INTO balances (user_id, currency, wallet_type, available, locked, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
              ON CONFLICT (user_id, currency, wallet_type)
              DO UPDATE SET
                available = $4,
                locked = $5,
                updated_at = NOW()
            `,
              [userId, currency, WalletType.SPOT, amount, '0'],
            );

            userBalances[currency] = amount;
          }

          balancesUpdated.push(userBalances);
        }

        return {
          message: 'Data reset successfully',
          orders_deleted: ordersDeleted,
          trades_deleted: tradesDeleted,
          balances_updated: balancesUpdated,
          redis_orderbook_cleared: redisCleared,
        };
      },
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
