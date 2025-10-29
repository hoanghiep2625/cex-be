import { Module, forwardRef } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { TradeModule } from '../trades/trade.module';
import { SymbolModule } from '../symbols/symbol.module';
import { OrderModule } from '../orders/order.module';
import { UserModule } from '../users/user.module';
import { CandleModule } from '../candles/candle.module';
import { OrderBookGateway } from './orderbook.gateway';
import { RecentTradesGateway } from './recenttrades.gateway';
import { MarketDataGateway } from './marketdata.gateway';
import { OrderGateway } from './order.gateway';
import { CandleGateway } from './candle.gateway';
import { TickerGateway } from './ticker.gateway';

@Module({
  imports: [
    RedisModule,
    TradeModule,
    SymbolModule,
    forwardRef(() => OrderModule),
    UserModule,
    CandleModule,
  ],
  providers: [
    OrderBookGateway,
    RecentTradesGateway,
    MarketDataGateway,
    OrderGateway,
    CandleGateway,
    TickerGateway,
  ],
  exports: [
    OrderBookGateway,
    RecentTradesGateway,
    MarketDataGateway,
    OrderGateway,
    CandleGateway,
    TickerGateway,
  ],
})
export class WebSocketModule {}
