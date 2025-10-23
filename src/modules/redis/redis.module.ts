import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './redis.service';
import { OrderBookService } from './orderbook.service';
import { OrderBookController } from './orderbook.controller';
import { OrderBookGateway } from './orderbook.gateway';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [OrderBookController],
  providers: [RedisService, OrderBookService, OrderBookGateway],
  exports: [RedisService, OrderBookService],
})
export class RedisModule {}
