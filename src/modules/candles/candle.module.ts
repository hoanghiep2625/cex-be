import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandleService } from './candle.service';
import { Candle } from './entities/candle.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Candle])],
  providers: [CandleService],
  exports: [CandleService],
})
export class CandleModule {}
