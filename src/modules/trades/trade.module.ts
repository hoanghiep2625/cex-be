import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeService } from './trade.service';
import { Trade } from './entities/trade.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Trade])],
  providers: [TradeService],
  controllers: [],
  exports: [TradeService],
})
export class TradeModule {}
