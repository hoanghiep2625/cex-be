import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './modules/users/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { typeOrmConfig } from './config/typeorm.config'; // Import config chung
import { BalanceModule } from 'src/modules/balances/balance.module';
import { AssetModule } from 'src/modules/assets/asset.module';
import { SymbolModule } from 'src/modules/symbols/symbol.module';
import { OrderModule } from 'src/modules/orders/order.module';
import { RedisModule } from 'src/modules/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(typeOrmConfig),
    RedisModule, // 🔴 Global Redis module
    AuthModule,
    UserModule,
    BalanceModule,
    AssetModule,
    SymbolModule,
    OrderModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
