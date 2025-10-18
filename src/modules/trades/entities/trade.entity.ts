import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Symbol } from '../../symbols/entities/symbol.entity';

export enum OrderSide { BUY = 'BUY', SELL = 'SELL' }
export enum LiquidityFlag { MAKER = 'M', TAKER = 'T' }

@Entity('trades')
@Index(['symbol', 'created_at'])
@Index(['maker_user_id', 'created_at'])
@Index(['taker_user_id', 'created_at'])
@Index(['maker_order_id'])
@Index(['taker_order_id'])
@Index(['taker_side', 'symbol', 'created_at'])
export class Trade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  symbol: string;

  @Column({ name: 'maker_order_id' })
  maker_order_id: string;

  @Column({ name: 'taker_order_id' })
  taker_order_id: string;

  @Column({ name: 'maker_user_id', type: 'integer' })
  maker_user_id: number;

  @Column({ name: 'taker_user_id', type: 'integer' })
  taker_user_id: number;

  // Chỉ cần lưu taker_side (aggressor). Maker side = opposite.
  @Column({ name: 'taker_side', type: 'enum', enum: OrderSide })
  taker_side: OrderSide;

  @Column({ type: 'enum', enum: LiquidityFlag, name: 'liquidity' })
  liquidity: LiquidityFlag; // 'T' cho bản ghi này (nếu bạn lưu 1 record/khớp); có thể bỏ nếu luôn hiểu ngầm.

  @Column({ type: 'decimal', precision: 38, scale: 18, name: 'price' })
  price: string;

  @Column({ type: 'decimal', precision: 38, scale: 18, name: 'quantity' })
  quantity: string;

  // Notional (quote amount) = price * quantity (lưu để report/query nhanh)
  @Column({ type: 'decimal', precision: 38, scale: 18, name: 'quote_quantity' })
  quote_quantity: string;

  // Phí hai bên tách riêng
  @Column({ type: 'decimal', precision: 38, scale: 18, name: 'maker_fee', default: '0' })
  maker_fee: string;

  @Column({ type: 'text', name: 'maker_fee_asset', nullable: true })
  maker_fee_asset?: string;

  @Column({ type: 'decimal', precision: 38, scale: 18, name: 'taker_fee', default: '0' })
  taker_fee: string;

  @Column({ type: 'text', name: 'taker_fee_asset', nullable: true })
  taker_fee_asset?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'maker_user_id' })
  maker_user: User;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'taker_user_id' })
  taker_user: User;

  @ManyToOne(() => Symbol, { eager: false })
  @JoinColumn({ name: 'symbol', referencedColumnName: 'symbol' })
  symbol_entity: Symbol;
}
