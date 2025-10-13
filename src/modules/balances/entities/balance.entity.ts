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

@Entity('balances')
@Check(`available >= 0`) // available không âm
@Check(`locked >= 0`) // locked không âm
@Index('idx_balances_user', ['user_id']) // Index cho query performance
@Index(['user_id', 'currency'], { unique: true }) // 1 user = 1 balance per currency
export class Balance {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string; // BIGSERIAL -> string để tránh overflow

  @Column({
    name: 'user_id',
    type: 'bigint',
  })
  user_id: number; // Foreign key

  @Column({
    type: 'text',
  })
  currency: string; // 'BTC', 'ETH', 'USDT' - references assets(code)

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
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Asset, (asset) => asset.balances)
  @JoinColumn({ name: 'currency', referencedColumnName: 'code' })
  asset: Asset;
}
