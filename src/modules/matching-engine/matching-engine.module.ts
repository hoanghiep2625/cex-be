import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchingEngineService } from './matching-engine.service';
import { RedisModule } from '../redis/redis.module';
import { TradeModule } from '../trades/trade.module';
import { OrderModule } from '../orders/order.module';
import { BalanceModule } from '../balances/balance.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { Order } from '../orders/entities/order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    RedisModule,
    TradeModule,
    forwardRef(() => OrderModule),
    BalanceModule,
    WebSocketModule,
  ],
  providers: [MatchingEngineService],
  exports: [MatchingEngineService],
})
export class MatchingEngineModule {}
