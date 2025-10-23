import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './redis.service';
import { OrderBookService } from './orderbook.service';
import { OrderBookController } from './orderbook.controller';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [OrderBookController],
  providers: [RedisService, OrderBookService],
  exports: [RedisService, OrderBookService],
})
export class RedisModule {}
