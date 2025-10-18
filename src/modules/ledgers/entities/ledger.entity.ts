import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum LedgerType {
  // Trading
  TRADE_BUY = 'trade_buy', // Mua hàng
  TRADE_SELL = 'trade_sell', // Bán hàng
  TRADE_FEE = 'trade_fee', // Phí giao dịch

  // Balance Management
  DEPOSIT = 'deposit', // Nạp tiền
  WITHDRAWAL = 'withdrawal', // Rút tiền
  TRANSFER_IN = 'transfer_in', // Nhận từ user khác
  TRANSFER_OUT = 'transfer_out', // Gửi cho user khác

  // Order Management
  ORDER_LOCK = 'order_lock', // Khoá balance cho lệnh
  ORDER_UNLOCK = 'order_unlock', // Mở khoá balance (hủy lệnh)
  ORDER_CANCEL_REFUND = 'order_cancel_refund', // Hoàn lại tiền hủy lệnh

  // Other
  REBATE = 'rebate', // Hoàn tiếp thị
  AIRDROP = 'airdrop', // Airdrop
  STAKING_REWARD = 'staking_reward', // Phần thưởng staking
  ADJUSTMENT = 'adjustment', // Điều chỉnh thủ công
}

export enum BalanceChangeType {
  INCREASE = 'increase', // Tăng
  DECREASE = 'decrease', // Giảm
}

@Entity('ledgers')
@Index(['user_id', 'created_at'])
@Index(['user_id', 'currency', 'created_at'])
@Index(['type', 'created_at'])
@Index(['reference_id']) // Để lookup transaction gốc
@Index(['currency', 'created_at'])
export class Ledger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'user_id',
    type: 'bigint',
  })
  user_id: number;

  @Column({
    type: 'text',
  })
  currency: string; // 'BTC', 'ETH', 'USDT'

  @Column({
    type: 'enum',
    enum: LedgerType,
  })
  type: LedgerType;

  @Column({
    type: 'enum',
    enum: BalanceChangeType,
  })
  change_type: BalanceChangeType;

  @Column({
    type: 'numeric',
    precision: 38,
    scale: 18,
  })
  amount: string; // Giá trị thay đổi (luôn dương)

  @Column({
    type: 'numeric',
    precision: 38,
    scale: 18,
  })
  balance_before: string; // Số dư trước

  @Column({
    type: 'numeric',
    precision: 38,
    scale: 18,
  })
  balance_after: string; // Số dư sau

  @Column({
    type: 'text',
    nullable: true,
  })
  reference_type?: string; // 'trade', 'order', 'deposit', 'withdrawal', 'transfer'

  @Column({
    type: 'text',
    nullable: true,
  })
  reference_id?: string; // ID của trade/order/deposit/withdrawal

  @Column({
    type: 'text',
    nullable: true,
  })
  description?: string; // Mô tả thêm

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  metadata?: Record<string, any>; // Lưu thông tin thêm (symbol, pair, fee_rate, v.v.)

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  created_at: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
