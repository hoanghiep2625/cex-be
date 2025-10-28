import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { CandleService } from './candle.service';
import { QueryCandlesDto } from './dto/candle.dto';

@Controller('candles')
export class CandleController {
  constructor(private readonly candleService: CandleService) {}

  /**
   * GET /candles?symbol=BTCUSDT&interval=1m&limit=100
   * Get candles cho một symbol và interval
   */
  @Get()
  async getCandles(@Query(ValidationPipe) query: QueryCandlesDto) {
    return this.candleService.getCandles(query);
  }
}
