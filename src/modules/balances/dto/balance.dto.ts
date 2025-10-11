import { IsString, IsOptional, Matches, IsNumberString } from 'class-validator';

export class CreateBalanceDto {
  @IsString({ message: 'Currency code must be a string' })
  @Matches(/^[A-Z]{2,10}$/, { message: 'Invalid currency format' })
  currency: string; // 'BTC', 'ETH', 'USDT'

  @IsOptional()
  @IsNumberString({}, { message: 'Available must be a valid number string' })
  @Matches(/^\d+(\.\d{1,18})?$/, { message: 'Invalid amount format' })
  available?: string; // Initial balance (optional, default 0)
}

export class UpdateBalanceDto {
  @IsOptional()
  @IsNumberString({}, { message: 'Available must be a valid number string' })
  @Matches(/^\d+(\.\d{1,18})?$/, { message: 'Invalid amount format' })
  available?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'Locked must be a valid number string' })
  @Matches(/^\d+(\.\d{1,18})?$/, { message: 'Invalid amount format' })
  locked?: string;
}

export class TransferBalanceDto {
  @IsString({ message: 'Currency must be specified' })
  @Matches(/^[A-Z]{2,10}$/, { message: 'Invalid currency format' })
  currency: string; // Currency to transfer

  @IsNumberString({}, { message: 'Amount must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Amount must be positive' })
  amount: string; // Amount to transfer

  @IsNumberString({}, { message: 'Recipient ID must be a number' })
  recipientId: string; // Target user ID
}

export class LockBalanceDto {
  @IsString({ message: 'Currency must be specified' })
  @Matches(/^[A-Z]{2,10}$/, { message: 'Invalid currency format' })
  currency: string;

  @IsNumberString({}, { message: 'Amount must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Amount must be positive' })
  amount: string;
}
