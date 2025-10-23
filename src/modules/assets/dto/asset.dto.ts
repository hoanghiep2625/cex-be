import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumberString,
} from 'class-validator';

export class CreateAssetDto {
  @IsString({ message: 'Code must be a string' })
  @IsNotEmpty({ message: 'Code is required' })
  code: string; // 'BTC', 'ETH', 'USDT'

  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  name: string; // 'Bitcoin', 'Ethereum', 'Tether'

  @IsOptional()
  @IsNumberString({}, { message: 'Precision must be a valid number' })
  precision?: number; // 8, 18, etc.
}

export class UpdateAssetDto {
  @IsOptional()
  @IsString({ message: 'Code must be a string' })
  code?: string;

  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  name?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'Precision must be a valid number' })
  precision?: number;
}
