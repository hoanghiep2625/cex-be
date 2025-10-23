import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { TradeModule } from '../trades/trade.module';
import { SymbolModule } from '../symbols/symbol.module';
import { OrderBookGateway } from './orderbook.gateway';
import { RecentTradesGateway } from './recenttrades.gateway';
import { MarketDataGateway } from './marketdata.gateway';

@Module({
  imports: [RedisModule, TradeModule, SymbolModule],
  providers: [OrderBookGateway, RecentTradesGateway, MarketDataGateway],
  exports: [OrderBookGateway, RecentTradesGateway, MarketDataGateway],
})
export class WebSocketModule {}
