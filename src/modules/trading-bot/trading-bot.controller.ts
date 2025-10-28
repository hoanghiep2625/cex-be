import { Controller, Get, Post, Body, Patch } from '@nestjs/common';
import { TradingBotService } from './trading-bot.service';

@Controller('trading-bot')
export class TradingBotController {
  constructor(private readonly tradingBotService: TradingBotService) {}

  @Get('status')
  getStatus() {
    return this.tradingBotService.getStatus();
  }

  @Post('start')
  async start() {
    await this.tradingBotService.start();
    return { message: 'Bot started' };
  }

  @Post('stop')
  async stop() {
    await this.tradingBotService.stop();
    return { message: 'Bot stopped' };
  }

  @Patch('config')
  async updateConfig(@Body() config: any) {
    await this.tradingBotService.updateConfig(config);
    return { message: 'Config updated', config };
  }
}
