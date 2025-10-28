import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './modules/users/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { typeOrmConfig } from './config/typeorm.config';
import { BalanceModule } from 'src/modules/balances/balance.module';
import { AssetModule } from 'src/modules/assets/asset.module';
import { SymbolModule } from 'src/modules/symbols/symbol.module';
import { OrderModule } from 'src/modules/orders/order.module';
import { RedisModule } from 'src/modules/redis/redis.module';
import { WebSocketModule } from 'src/modules/websocket/websocket.module';
import { TradeModule } from 'src/modules/trades/trade.module';
import { MatchingEngineModule } from 'src/modules/matching-engine/matching-engine.module';
import { LedgerModule } from 'src/modules/ledgers/ledger.module';
import { CandleModule } from 'src/modules/candles/candle.module';
import { TradingBotModule } from 'src/modules/trading-bot/trading-bot.module';
import { Order } from './modules/orders/entities/order.entity';
import { Trade } from './modules/trades/entities/trade.entity';
import { Balance } from './modules/balances/entities/balance.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(typeOrmConfig),
    TypeOrmModule.forFeature([Order, Trade, Balance]),
    RedisModule,
    WebSocketModule,
    AuthModule,
    UserModule,
    BalanceModule,
    AssetModule,
    SymbolModule,
    OrderModule,
    TradeModule,
    MatchingEngineModule,
    LedgerModule,
    CandleModule,
    TradingBotModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
