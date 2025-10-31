import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Asset } from '../../assets/entities/asset.entity';

export enum WalletType {
  SPOT = 'spot',
  FUTURE = 'future',
  FUNDING = 'funding',
}

@Entity('balances')
@Check(`available >= 0`) // available không âm
@Check(`locked >= 0`) // locked không âm
@Index('idx_balances_user', ['user_id']) // Index cho query performance
@Index(['user_id', 'currency', 'wallet_type'], { unique: true }) // 1 user = 1 balance per currency per wallet type
export class Balance {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string; // BIGSERIAL -> string để tránh overflow (JavaScript number max safe integer)

  /**
   * Foreign Key to users.id
   * Type: integer to match users.id
   */
  @Column({
    name: 'user_id',
    type: 'integer',
  })
  user_id: number; // Foreign key to users.id

  @Column({
    type: 'text',
  })
  currency: string; // 'BTC', 'ETH', 'USDT' - references assets(code)

  @Column({
    name: 'wallet_type',
    type: 'text',
    default: WalletType.FUNDING,
  })
  wallet_type: WalletType; // 'spot', 'future', 'funding'

  @Column({
    type: 'numeric',
    precision: 38,
    scale: 18,
    default: '0',
  })
  available: string; // Số dư khả dụng

  @Column({
    type: 'numeric',
    precision: 38,
    scale: 18,
    default: '0',
  })
  locked: string; // số dư bị khoá do đang treo lệnh

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  created_at: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updated_at: Date; // Auto trigger trong DB

  // Relations
  /**
   * Foreign Key: balances.user_id → users.id
   * Constraint: ON DELETE CASCADE (delete balances when user is deleted)
   */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
  })
  user: User;

  /**
   * Foreign Key: balances.currency → assets.code
   * Constraint: ON DELETE RESTRICT (prevent asset deletion if balances exist)
   */
  @ManyToOne(() => Asset, (asset) => asset.balances, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'currency',
    referencedColumnName: 'code',
  })
  asset: Asset;
}
