import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Check,
} from 'typeorm';
import { Symbol } from '../../symbols/entities/symbol.entity';

/**
 * Timeframe cho candle
 * Sử dụng text thay vì enum để dễ thêm mới mà không cần migration
 */
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

/**
 * Candle Entity - Dữ liệu nến cho từng symbol
 * Lưu OHLCV (Open, High, Low, Close, Volume)
 *
 * Tối ưu cho TimescaleDB:
 * - open_time: timestamptz (có thể tạo hypertable)
 * - Composite index (symbol_id, timeframe, open_time) cover hết query pattern
 */
@Entity('candles')
@Index(['symbol_id', 'timeframe', 'open_time'], { unique: true }) // Composite index: 1 candle/symbol/timeframe/time
@Check(`timeframe IN ('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M')`)
export class Candle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'symbol_id',
    type: 'integer',
  })
  symbol_id: number; // Foreign key to symbols.id (khớp kiểu với Symbol.id)

  @Column({
    type: 'text',
  })
  timeframe: CandleTimeframe; // '1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'

  @Column({
    name: 'open_time',
    type: 'timestamptz',
  })
  open_time: Date; // Thời gian mở nến (UTC) - tối ưu cho TimescaleDB

  @Column({
    name: 'close_time',
    type: 'timestamptz',
  })
  close_time: Date; // Thời gian đóng nến (UTC)

  // OHLCV data
  @Column({
    type: 'numeric',
    precision: 20,
    scale: 8,
  })
  open: string; // Giá mở

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 8,
  })
  high: string; // Giá cao nhất

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 8,
  })
  low: string; // Giá thấp nhất

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 8,
  })
  close: string; // Giá đóng

  @Column({
    type: 'numeric',
    precision: 38,
    scale: 8,
  })
  volume: string; // Khối lượng giao dịch (trong base asset)

  @Column({
    name: 'quote_volume',
    type: 'numeric',
    precision: 38,
    scale: 8,
  })
  quote_volume: string; // Khối lượng giao dịch (trong quote asset) - đồng bộ chuẩn công nghiệp

  @Column({
    name: 'number_of_trades',
    type: 'integer',
    default: 0,
  })
  number_of_trades: number; // Số lượng giao dịch

  @Column({
    name: 'taker_buy_base_volume',
    type: 'numeric',
    precision: 38,
    scale: 8,
    default: '0',
  })
  taker_buy_base_volume: string; // Taker buy volume (base asset)

  @Column({
    name: 'taker_buy_quote_volume',
    type: 'numeric',
    precision: 38,
    scale: 8,
    default: '0',
  })
  taker_buy_quote_volume: string; // Taker buy volume (quote asset)

  @Column({
    name: 'is_closed',
    type: 'boolean',
    default: false,
  })
  is_closed: boolean; // Nến đã đóng chưa?

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  created_at: Date;

  // Relations
  @ManyToOne(() => Symbol, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'symbol_id' })
  symbol: Symbol;
}
