import { Module, forwardRef } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { TradeModule } from '../trades/trade.module';
import { SymbolModule } from '../symbols/symbol.module';
import { OrderModule } from '../orders/order.module';
import { UserModule } from '../users/user.module';
import { OrderBookGateway } from './orderbook.gateway';
import { RecentTradesGateway } from './recenttrades.gateway';
import { MarketDataGateway } from './marketdata.gateway';
import { OrderGateway } from './order.gateway';

@Module({
  imports: [
    RedisModule,
    TradeModule,
    SymbolModule,
    forwardRef(() => OrderModule),
    UserModule,
  ],
  providers: [
    OrderBookGateway,
    RecentTradesGateway,
    MarketDataGateway,
    OrderGateway,
  ],
  exports: [
    OrderBookGateway,
    RecentTradesGateway,
    MarketDataGateway,
    OrderGateway,
  ],
})
export class WebSocketModule {}
