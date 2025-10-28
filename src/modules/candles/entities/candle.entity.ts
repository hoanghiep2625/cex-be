import {
  Entity,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Check,
  PrimaryColumn,
} from 'typeorm';
import { Symbol } from '../../symbols/entities/symbol.entity';

export type CandleTimeframe =
  | '1m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '4h'
  | '1d'
  | '1w'
  | '1M';

@Entity('candles')
@Check(`timeframe IN ('1m','5m','15m','30m','1h','4h','1d','1w','1M')`)
@Index(['symbol_id', 'timeframe', 'open_time'], { unique: true })
export class Candle {
  @PrimaryColumn({ type: 'integer' })
  symbol_id: number;

  @PrimaryColumn({ type: 'text' })
  timeframe: CandleTimeframe;

  @PrimaryColumn({ name: 'open_time', type: 'timestamptz' })
  open_time: Date;

  @Column({ name: 'close_time', type: 'timestamptz' })
  close_time: Date;

  @Column({ type: 'numeric', precision: 20, scale: 8 }) open: string;
  @Column({ type: 'numeric', precision: 20, scale: 8 }) high: string;
  @Column({ type: 'numeric', precision: 20, scale: 8 }) low: string;
  @Column({ type: 'numeric', precision: 20, scale: 8 }) close: string;

  @Column({ type: 'numeric', precision: 38, scale: 8 }) volume: string;
  @Column({ name: 'quote_volume', type: 'numeric', precision: 38, scale: 8 })
  quote_volume: string;

  @Column({ name: 'number_of_trades', type: 'integer', default: 0 })
  number_of_trades: number;

  @Column({
    name: 'taker_buy_base_volume',
    type: 'numeric',
    precision: 38,
    scale: 8,
    default: '0',
  })
  taker_buy_base_volume: string;

  @Column({
    name: 'taker_buy_quote_volume',
    type: 'numeric',
    precision: 38,
    scale: 8,
    default: '0',
  })
  taker_buy_quote_volume: string;

  @Column({ name: 'is_closed', type: 'boolean', default: false })
  is_closed: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Symbol, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'symbol_id' })
  symbol: Symbol;
}
