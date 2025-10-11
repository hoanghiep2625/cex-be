import {
  IsString,
  IsOptional,
  Matches,
  IsNumberString,
  IsBoolean,
  IsIn,
  IsNotEmpty,
} from 'class-validator';

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
  baseAsset: string; // 'BTC'

  @IsString({ message: 'Quote asset must be a string' })
  @IsNotEmpty({ message: 'Quote asset is required' })
  @Matches(/^[A-Z]{2,10}$/, { message: 'Invalid quote asset format' })
  quoteAsset: string; // 'USDT'

  @IsNumberString({}, { message: 'Tick size must be a valid number string' })
  @IsNotEmpty({ message: 'Tick size is required' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid tick size format' })
  tickSize: string; // '0.01'

  @IsNumberString({}, { message: 'Lot size must be a valid number string' })
  @IsNotEmpty({ message: 'Lot size is required' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid lot size format' })
  lotSize: string; // '0.0001'

  @IsNumberString({}, { message: 'Min notional must be a valid number string' })
  @IsNotEmpty({ message: 'Min notional is required' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid min notional format' })
  minNotional: string; // '10'

  @IsOptional()
  @IsNumberString({}, { message: 'Max notional must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid max notional format' })
  maxNotional?: string;

  @IsNumberString({}, { message: 'Min qty must be a valid number string' })
  @IsNotEmpty({ message: 'Min qty is required' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid min qty format' })
  minQty: string; // '0.001'

  @IsOptional()
  @IsNumberString({}, { message: 'Max qty must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid max qty format' })
  maxQty?: string;

  @IsOptional()
  @IsString()
  @IsIn(['TRADING', 'DISABLED', 'MAINTENANCE'], { message: 'Invalid status' })
  status?: string;

  @IsOptional()
  @IsBoolean()
  isSpotTradingAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  isMarginTradingAllowed?: boolean;
}

export class UpdateSymbolDto {
  @IsOptional()
  @IsNumberString({}, { message: 'Tick size must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid tick size format' })
  tickSize?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'Lot size must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid lot size format' })
  lotSize?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'Min notional must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid min notional format' })
  minNotional?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'Max notional must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid max notional format' })
  maxNotional?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'Min qty must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid min qty format' })
  minQty?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'Max qty must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Invalid max qty format' })
  maxQty?: string;

  @IsOptional()
  @IsString()
  @IsIn(['TRADING', 'DISABLED', 'MAINTENANCE'], { message: 'Invalid status' })
  status?: string;

  @IsOptional()
  @IsBoolean()
  isSpotTradingAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  isMarginTradingAllowed?: boolean;
}

export class SymbolFilterDto {
  @IsOptional()
  @IsString()
  baseAsset?: string;

  @IsOptional()
  @IsString()
  quoteAsset?: string;

  @IsOptional()
  @IsString()
  @IsIn(['TRADING', 'DISABLED', 'MAINTENANCE'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  isSpotTradingAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  isMarginTradingAllowed?: boolean;
}
