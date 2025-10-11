import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Balance } from '../../balances/entities/balance.entity';

@Entity('assets')
export class Asset {
  @PrimaryColumn({
    type: 'text',
  })
  code: string; // 'BTC', 'ETH', 'USDT'

  @Column({
    type: 'integer',
    default: 8,
  })
  precision: number; // Số lẻ tối đa cho qty/balance

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;

  @OneToMany(() => Balance, (balance) => balance.asset)
  balances: Balance[];
}
