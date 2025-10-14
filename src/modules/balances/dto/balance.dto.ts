import {
  IsString,
  IsOptional,
  Matches,
  IsNumberString,
  IsEnum,
} from 'class-validator';
import { WalletType } from '../entities/balance.entity';

export class CreateBalanceDto {
  @IsString({ message: 'Currency code must be a string' })
  @Matches(/^[A-Z]{2,10}$/, { message: 'Invalid currency format' })
  currency: string; // 'BTC', 'ETH', 'USDT'

  @IsOptional()
  @IsNumberString({}, { message: 'Available must be a valid number string' })
  @Matches(/^\d+(\.\d{1,18})?$/, { message: 'Invalid amount format' })
  available?: string; // Initial balance (optional, default 0)

  @IsOptional()
  @IsEnum(WalletType, {
    message: 'Wallet type must be spot, future, or funding',
  })
  wallet_type?: WalletType; // Default 'funding'
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

  @IsOptional()
  @IsEnum(WalletType, {
    message: 'Wallet type must be spot, future, or funding',
  })
  wallet_type?: WalletType; // Default 'funding'

  @IsNumberString({}, { message: 'Amount must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Amount must be positive' })
  amount: string; // Amount to transfer

  @IsNumberString({}, { message: 'Recipient ID must be a number' })
  recipient_id: string; // Target user ID
}

export class LockBalanceDto {
  @IsString({ message: 'Currency must be specified' })
  @Matches(/^[A-Z]{2,10}$/, { message: 'Invalid currency format' })
  currency: string;

  @IsOptional()
  @IsEnum(WalletType, {
    message: 'Wallet type must be spot, future, or funding',
  })
  wallet_type?: WalletType; // Default 'funding'

  @IsNumberString({}, { message: 'Amount must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Amount must be positive' })
  amount: string;
}

export class TransferBetweenWalletsDto {
  @IsString({ message: 'Currency must be specified' })
  @Matches(/^[A-Z]{2,10}$/, { message: 'Invalid currency format' })
  currency: string;

  @IsNumberString({}, { message: 'Amount must be a valid number string' })
  @Matches(/^\d*\.?\d+$/, { message: 'Amount must be positive' })
  amount: string;

  @IsEnum(WalletType, {
    message: 'From wallet type must be spot, future, or funding',
  })
  from_wallet_type: WalletType;

  @IsEnum(WalletType, {
    message: 'To wallet type must be spot, future, or funding',
  })
  to_wallet_type: WalletType;
}
