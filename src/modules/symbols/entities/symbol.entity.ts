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

@Entity('symbols')
@Index(['symbol'], { unique: true })
@Index(['baseAsset'])
@Index(['quoteAsset'])
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
    name: 'base_asset',
    type: 'text',
  })
  baseAsset: string; // 'BTC', 'ETH'

  @Column({
    name: 'quote_asset',
    type: 'text',
  })
  quoteAsset: string; // 'USDT', 'BTC'

  @Column({
    name: 'tick_size',
    type: 'numeric',
    precision: 20,
    scale: 8,
  })
  tickSize: string; // '0.01' (bước nhảy giá)

  @Column({
    name: 'lot_size',
    type: 'numeric',
    precision: 20,
    scale: 8,
  })
  lotSize: string; // '0.0001' (bước nhảy khối lượng)

  @Column({
    name: 'min_notional',
    type: 'numeric',
    precision: 20,
    scale: 8,
  })
  minNotional: string; // '10' (giá trị lệnh tối thiểu)

  @Column({
    name: 'max_notional',
    type: 'numeric',
    precision: 20,
    scale: 8,
    nullable: true,
  })
  maxNotional?: string; // '1000000' (giá trị lệnh tối đa)

  @Column({
    name: 'min_qty',
    type: 'numeric',
    precision: 20,
    scale: 8,
  })
  minQty: string; // '0.001' (số lượng tối thiểu)

  @Column({
    name: 'max_qty',
    type: 'numeric',
    precision: 20,
    scale: 8,
    nullable: true,
  })
  maxQty?: string; // '9000' (số lượng tối đa)

  @Column({
    type: 'varchar',
    length: 20,
    default: 'TRADING',
  })
  status: string; // 'TRADING', 'DISABLED', 'MAINTENANCE'

  @Column({
    name: 'is_spot_trading_allowed',
    type: 'boolean',
    default: true,
  })
  isSpotTradingAllowed: boolean;

  @Column({
    name: 'is_margin_trading_allowed',
    type: 'boolean',
    default: false,
  })
  isMarginTradingAllowed: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt: Date;

  // Relations với Asset
  @ManyToOne(() => Asset)
  @JoinColumn({ name: 'base_asset', referencedColumnName: 'code' })
  baseAssetEntity: Asset;

  @ManyToOne(() => Asset)
  @JoinColumn({ name: 'quote_asset', referencedColumnName: 'code' })
  quoteAssetEntity: Asset;
}
