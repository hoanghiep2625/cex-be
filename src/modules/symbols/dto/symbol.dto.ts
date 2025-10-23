import {
  IsString,
  IsOptional,
  Matches,
  IsNumberString,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsEnum,
} from 'class-validator';
import { SymbolType } from '../enums/symbol-type.enum';

export class CreateSymbolDto {
  @IsString({ message: 'Symbol must be a string' })
  @IsNotEmpty({ message: 'Symbol is required' })
  @Matches(/^[A-Z]{2,10}[A-Z]{2,10}$/, {
    message: 'Invalid symbol format. Use format like BTCUSDT',
  })
  symbol: string; // 'BTCUSDT'

  @IsString({ message: 'Base asset must be a string' })
  @IsNotEmpty({ message: 'Base asset is required' })
  @Matches(/^[A-Z]{2,10}$/, { message: 'Invalid base asset format' })
  base_asset: string; // 'BTC'

  @IsString({ message: 'Quote asset must be a string' })
  @IsNotEmpty({ message: 'Quote asset is required' })
  @Matches(/^[A-Z]{2,10}$/, { message: 'Invalid quote asset format' })
  quote_asset: string; // 'USDT'

  @IsNumberString({}, { message: 'Tick size must be a valid number string' })
  @IsNotEmpty({ message: 'Tick size is required' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid tick size format' })
  tick_size: string; // '0.01'

  @IsNumberString({}, { message: 'Lot size must be a valid number string' })
  @IsNotEmpty({ message: 'Lot size is required' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid lot size format' })
  lot_size: string; // '0.0001'

  @IsNumberString({}, { message: 'Min notional must be a valid number string' })
  @IsNotEmpty({ message: 'Min notional is required' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid min notional format' })
  min_notional: string; // '10'

  @IsOptional()
  @IsNumberString({}, { message: 'Max notional must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid max notional format' })
  max_notional?: string;

  @IsNumberString({}, { message: 'Min qty must be a valid number string' })
  @IsNotEmpty({ message: 'Min qty is required' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid min qty format' })
  min_qty: string; // '0.001'

  @IsOptional()
  @IsNumberString({}, { message: 'Max qty must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid max qty format' })
  max_qty?: string;

  @IsOptional()
  @IsString()
  @IsIn(['TRADING', 'DISABLED', 'MAINTENANCE'], { message: 'Invalid status' })
  status?: string;

  @IsOptional()
  @IsEnum(SymbolType, {
    message: 'Invalid type. Must be: spot, futures, margin, isolated',
  })
  type?: SymbolType;

  @IsOptional()
  @IsBoolean()
  is_spot_trading_allowed?: boolean;

  @IsOptional()
  @IsBoolean()
  is_margin_trading_allowed?: boolean;
}

export class UpdateSymbolDto {
  @IsOptional()
  @IsNumberString({}, { message: 'Tick size must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid tick size format' })
  tick_size?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'Lot size must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid lot size format' })
  lot_size?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'Min notional must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid min notional format' })
  min_notional?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'Max notional must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid max notional format' })
  max_notional?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'Min qty must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid min qty format' })
  min_qty?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'Max qty must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid max qty format' })
  max_qty?: string;

  @IsOptional()
  @IsString()
  @IsIn(['TRADING', 'DISABLED', 'MAINTENANCE'], { message: 'Invalid status' })
  status?: string;

  @IsOptional()
  @IsEnum(SymbolType, {
    message: 'Invalid type. Must be: spot, futures, margin, isolated',
  })
  type?: SymbolType;

  @IsOptional()
  @IsBoolean()
  is_spot_trading_allowed?: boolean;

  @IsOptional()
  @IsBoolean()
  is_margin_trading_allowed?: boolean;
}

export class SymbolFilterDto {
  @IsOptional()
  @IsString()
  base_asset?: string;

  @IsOptional()
  @IsString()
  quote_asset?: string;

  @IsOptional()
  @IsString()
  @IsIn(['TRADING', 'DISABLED', 'MAINTENANCE'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  is_spot_trading_allowed?: boolean;

  @IsOptional()
  @IsBoolean()
  is_margin_trading_allowed?: boolean;

  @IsOptional()
  @IsString()
  from?: string; // 'markets'

  @IsOptional()
  @IsEnum(SymbolType)
  type?: SymbolType;
}
