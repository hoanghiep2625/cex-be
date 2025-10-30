import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CandleService } from './candle.service';
import { CandleController } from './candle.controller';
import { Candle } from './entities/candle.entity';
import { RedisModule } from '../redis/redis.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Candle]),
    RedisModule,
    ScheduleModule.forRoot(),
    forwardRef(() => WebSocketModule),
  ],
  controllers: [CandleController],
  providers: [CandleService],
  exports: [CandleService],
})
export class CandleModule {}
