import { CandleTimeframe } from '../entities/candle.entity';

/**
 * DTO cho việc tạo hoặc cập nhật candle
 */
export class CreateCandleDto {
  symbol_id: number;
  timeframe: CandleTimeframe;
  open_time: Date | string;
  close_time: Date | string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  quote_volume: string;
  number_of_trades?: number;
  taker_buy_base_volume?: string;
  taker_buy_quote_volume?: string;
  is_closed?: boolean;
}

/**
 * DTO cho việc query candles
 */
export class GetCandlesDto {
  symbol_id: number;
  timeframe: CandleTimeframe;
  start_time?: Date | string;
  end_time?: Date | string;
  limit?: number;
}

/**
 * DTO cho response (frontend nhận epoch ms)
 */
export class CandleResponseDto {
  id: string;
  symbol_id: number;
  timeframe: CandleTimeframe;
  open_time: number; // epoch ms
  close_time: number; // epoch ms
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  quote_volume: string;
  number_of_trades: number;
  taker_buy_base_volume: string;
  taker_buy_quote_volume: string;
  is_closed: boolean;
}
