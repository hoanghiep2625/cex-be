import { Module } from '@nestjs/common';
import { TradingBotService } from './trading-bot.service';
import { OrderModule } from '../orders/order.module';
import { TradingBotController } from 'src/modules/trading-bot/trading-bot.controller';

@Module({
  imports: [OrderModule],
  controllers: [TradingBotController],
  providers: [TradingBotService],
  exports: [TradingBotService],
})
export class TradingBotModule {}
