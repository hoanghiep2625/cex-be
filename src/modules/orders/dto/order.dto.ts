import {
  IsString,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { OrderSide, OrderType, TimeInForce } from '../entities/order.entity';

const POSITIVE_DECIMAL = /^(?!0+(?:\.0+)?$)\d+(?:\.\d+)?$/; // > 0

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'Symbol must contain only uppercase letters and numbers',
  })
  @Transform(({ value }) => value?.toString().trim())
  symbol: string;

  @IsEnum(OrderSide)
  @Transform(({ value }) => value?.toString().toUpperCase())
  side: OrderSide;

  @IsEnum(OrderType)
  @Transform(({ value }) => value?.toString().toUpperCase())
  type: OrderType;

  // price bắt buộc nếu LIMIT; cấm nếu MARKET
  @ValidateIf((o) => o.type === OrderType.LIMIT)
  @IsString()
  @Matches(POSITIVE_DECIMAL, { message: 'Price must be a positive number' })
  @Transform(({ value }) =>
    value === '' || value == null ? undefined : value.toString(),
  )
  price?: string;

  @IsString()
  @Matches(POSITIVE_DECIMAL, { message: 'Quantity must be a positive number' })
  @Transform(({ value }) => value?.toString())
  qty: string;

  @IsOptional()
  @IsEnum(TimeInForce)
  @Transform(({ value }) =>
    value ? value.toString().toUpperCase() : TimeInForce.GTC,
  )
  tif?: TimeInForce;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Transform(({ value }) => value?.toString().trim())
  client_order_id?: string;
}

export class UpdateOrderDto {
  @IsOptional()
  @Matches(POSITIVE_DECIMAL, { message: 'Price must be a positive number' })
  @Transform(({ value }) =>
    value === '' || value == null ? undefined : value.toString(),
  )
  price?: string;

  @IsOptional()
  @Matches(POSITIVE_DECIMAL, { message: 'Quantity must be a positive number' })
  @Transform(({ value }) => value?.toString())
  qty?: string;

  @IsOptional()
  @IsEnum(TimeInForce)
  @Transform(({ value }) => value?.toString().toUpperCase())
  tif?: TimeInForce;
}

export class OrderQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toString())
  status?: string; // Comma-separated status values: "NEW,FILLED"

  @IsOptional()
  @IsString()
  @Length(1, 20)
  @Transform(({ value }) => value?.toString().toUpperCase())
  symbol?: string;

  @IsOptional()
  @IsEnum(OrderSide)
  @Transform(({ value }) => value?.toString().toUpperCase())
  side?: OrderSide;

  @IsOptional()
  @IsEnum(OrderType)
  @Transform(({ value }) => value?.toString().toUpperCase())
  type?: OrderType;

  @IsOptional()
  @Transform(({ value }) => {
    const n = parseInt(value);
    return Number.isFinite(n) && n >= 1 && n <= 100 ? n : 50;
  })
  limit?: number = 50;

  @IsOptional()
  @Transform(({ value }) => {
    const n = parseInt(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  })
  offset?: number = 0;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @Length(1, 64)
  client_order_id?: string;
}
