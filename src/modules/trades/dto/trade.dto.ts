import { IsString, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTradeDto {
  @IsString()
  symbol: string; // e.g., 'BTCUSDT'

  @IsString()
  maker_order_id: string;

  @IsString()
  taker_order_id: string;

  @IsNumber()
  maker_user_id: number;

  @IsNumber()
  taker_user_id: number;

  @IsString()
  taker_side: string; // 'BUY' | 'SELL' (aggressor side) - maker side = opposite

  @IsString()
  price: string; // Decimal as string (execution price)

  @IsString()
  quantity: string; // Decimal as string (filled quantity)

  @IsString()
  quote_quantity: string; // price * quantity (notional value)

  @IsOptional()
  @IsString()
  maker_fee?: string; // Default '0'

  @IsOptional()
  @IsString()
  maker_fee_asset?: string; // Fee currency for maker

  @IsOptional()
  @IsString()
  taker_fee?: string; // Default '0'

  @IsOptional()
  @IsString()
  taker_fee_asset?: string; // Fee currency for taker
}

/**
 * 📋 DTO for querying trades with filters
 */
export class TradeQueryDto {
  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  user_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offset?: number;

  @IsOptional()
  @IsString()
  sort?: string; // 'ASC' | 'DESC'
}
