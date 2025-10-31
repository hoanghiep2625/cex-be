import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Check,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Symbol } from '../../symbols/entities/symbol.entity';

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}
export enum OrderType {
  LIMIT = 'LIMIT',
  MARKET = 'MARKET',
}
export enum OrderStatus {
  NEW = 'NEW',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELED = 'CANCELED',
  REJECTED = 'REJECTED',
}
export enum TimeInForce {
  GTC = 'GTC',
  IOC = 'IOC',
  FOK = 'FOK',
}

@Check(`(type <> 'LIMIT') OR (price IS NOT NULL AND price > 0)`)
@Check(`(type <> 'MARKET') OR (price IS NULL)`)
@Check(`qty > 0`)
@Check(`filled_qty >= 0 AND filled_qty <= qty`)
@Index(['symbol', 'status', 'created_at'])
@Index(['user_id', 'created_at'])
@Index(['symbol', 'side', 'price'])
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Foreign Key to users.id
   * Type: integer to match users.id
   */
  @Column({
    name: 'user_id',
    type: 'integer',
  })
  user_id: number; // Foreign key to users.id

  /**
   * Foreign Key to symbols.symbol
   * Type: text to match symbols.symbol
   */
  @Column()
  symbol: string; // Foreign key to symbols.symbol

  @Column({ type: 'enum', enum: OrderSide })
  side: OrderSide;

  @Column({ type: 'enum', enum: OrderType })
  type: OrderType;

  @Column({ type: 'decimal', precision: 38, scale: 18, nullable: true })
  price: string | null;

  @Column({ type: 'decimal', precision: 38, scale: 18 })
  qty: string;

  @Column({
    type: 'decimal',
    precision: 38,
    scale: 18,
    default: '0',
    name: 'filled_qty',
  })
  filled_qty: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.NEW })
  status: OrderStatus;

  @Column({ type: 'enum', enum: TimeInForce, default: TimeInForce.GTC })
  tif: TimeInForce;

  // KHÔNG unique đơn cột – sẽ tạo unique (user_id, client_order_id) ở migration
  @Column({ nullable: true, name: 'client_order_id' })
  client_order_id?: string | null;

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

  // Relations
  /**
   * Foreign Key: orders.user_id → users.id
   * Constraint: ON DELETE RESTRICT (prevent user deletion if orders exist)
   */
  @ManyToOne(() => User, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
  })
  user: User;

  /**
   * Foreign Key: orders.symbol → symbols.symbol
   * Constraint: ON DELETE RESTRICT (prevent symbol deletion if orders exist)
   */
  @ManyToOne(() => Symbol, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'symbol',
    referencedColumnName: 'symbol',
  })
  symbol_entity: Symbol;

  get is_active(): boolean {
    return (
      this.status === OrderStatus.NEW ||
      this.status === OrderStatus.PARTIALLY_FILLED
    );
  }
}
