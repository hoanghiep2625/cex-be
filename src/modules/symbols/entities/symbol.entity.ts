import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Asset } from '../../assets/entities/asset.entity';
import { SymbolType } from '../enums/symbol-type.enum';

@Entity('symbols')
@Index(['symbol'], { unique: true })
@Index(['base_asset'])
@Index(['quote_asset'])
@Index(['status'])
export class Symbol {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'text',
    unique: true,
  })
  symbol: string; // 'BTCUSDT', 'ETHUSDT'

  @Column({
    type: 'text',
  })
  base_asset: string; // 'BTC', 'ETH'

  @Column({
    type: 'text',
  })
  quote_asset: string; // 'USDT', 'BTC'

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 8,
  })
  tick_size: string; // '0.01' (bước nhảy giá)

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 8,
  })
  lot_size: string; // '0.0001' (bước nhảy khối lượng)

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 8,
  })
  min_notional: string; // '10' (giá trị lệnh tối thiểu)

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 8,
    nullable: true,
  })
  max_notional?: string; // '1000000' (giá trị lệnh tối đa)

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 8,
  })
  min_qty: string; // '0.001' (số lượng tối thiểu)

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 8,
    nullable: true,
  })
  max_qty?: string; // '9000' (số lượng tối đa)

  @Column({
    type: 'varchar',
    length: 20,
    default: 'TRADING',
  })
  status: string; // 'TRADING', 'DISABLED', 'MAINTENANCE'

  @Column({
    type: 'enum',
    enum: SymbolType,
    default: SymbolType.SPOT,
  })
  type: SymbolType; // SPOT, FUTURES, MARGIN, ISOLATED

  @Column({
    type: 'boolean',
    default: true,
  })
  is_spot_trading_allowed: boolean;

  @Column({
    type: 'boolean',
    default: false,
  })
  is_margin_trading_allowed: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  created_at: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updated_at: Date;

  // Relations với Asset
  @ManyToOne(() => Asset)
  @JoinColumn({ name: 'base_asset', referencedColumnName: 'code' })
  base_asset_entity: Asset;

  @ManyToOne(() => Asset)
  @JoinColumn({ name: 'quote_asset', referencedColumnName: 'code' })
  quote_asset_entity: Asset;
}
