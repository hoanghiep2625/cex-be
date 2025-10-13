import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { Order } from './entities/order.entity';
import { Symbol } from '../symbols/entities/symbol.entity';
import { Balance } from '../balances/entities/balance.entity';
import { Asset } from '../assets/entities/asset.entity';
import { User } from '../users/entities/user.entity';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Symbol, Balance, Asset, User]),
    RedisModule,
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
