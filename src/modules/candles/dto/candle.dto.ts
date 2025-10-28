import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CandleTimeframe } from '../entities/candle.entity';
import { SymbolType } from '../../symbols/enums/symbol-type.enum';

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
 * DTO cho query candles theo symbol và type
 */
export class QueryCandlesDto {
  @IsString()
  symbol: string; // BTCUSDT, ETHUSDT

  @IsOptional()
  @IsEnum(SymbolType)
  type?: SymbolType; // spot, futures, margin

  @IsEnum(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'])
  interval: CandleTimeframe; // 1m, 5m, 1h, etc

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number; // Max số nến trả về (default: 500)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  startTime?: number; // Epoch ms - thời điểm bắt đầu

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  endTime?: number; // Epoch ms - thời điểm kết thúc
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
