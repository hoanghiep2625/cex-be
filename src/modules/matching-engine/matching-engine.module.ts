import { Module, forwardRef } from '@nestjs/common';
import { MatchingEngineService } from './matching-engine.service';
import { RedisModule } from '../redis/redis.module';
import { TradeModule } from '../trades/trade.module';
import { OrderModule } from '../orders/order.module';
import { BalanceModule } from '../balances/balance.module';

@Module({
  imports: [
    RedisModule,
    TradeModule,
    forwardRef(() => OrderModule),
    BalanceModule,
  ],
  providers: [MatchingEngineService],
  exports: [MatchingEngineService],
})
export class MatchingEngineModule {}
