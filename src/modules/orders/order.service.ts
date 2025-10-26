import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import {
  Order,
  OrderStatus,
  OrderType,
  OrderSide,
} from './entities/order.entity';
import { CreateOrderDto } from './dto/order.dto';
import { Symbol } from '../symbols/entities/symbol.entity';
import { Balance } from '../balances/entities/balance.entity';
import { Asset } from '../assets/entities/asset.entity';
import { RedisService } from '../redis/redis.service';
import { OrderBookService } from '../redis/orderbook.service';
import { MatchingEngineService } from '../matching-engine/matching-engine.service';
import { WalletType } from '../balances/entities/balance.entity';
import Decimal from 'decimal.js';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly orderBookService: OrderBookService,
    @Inject(forwardRef(() => MatchingEngineService))
    private readonly matchingEngineService: MatchingEngineService,
  ) {}

  async createOrder(
    user_id: number,
    createOrderDto: CreateOrderDto,
  ): Promise<Order> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validate symbol exists and is active
      const symbol = await this.symbolRepository.findOne({
        where: { symbol: createOrderDto.symbol },
        relations: ['base_asset_entity', 'quote_asset_entity'],
      });

      if (!symbol) {
        throw new BadRequestException(
          `Symbol ${createOrderDto.symbol} not found`,
        );
      }

      if (symbol.status !== 'TRADING' || !symbol.is_spot_trading_allowed) {
        throw new BadRequestException(
          `Symbol ${createOrderDto.symbol} is not available for trading`,
        );
      }

      // 2. Validate order parameters
      this.validateOrderParameters(createOrderDto, symbol);

      // 3. Check if client order ID already exists for this user
      if (createOrderDto.client_order_id) {
        const existingOrder = await this.orderRepository.findOne({
          where: {
            user_id: user_id.toString(),
            client_order_id: createOrderDto.client_order_id,
          },
        });

        if (existingOrder) {
          throw new BadRequestException('Client order ID already exists');
        }
      }

      // 4. Calculate required balance and validate
      const { asset, requiredAmount } = this.calculateRequiredBalance(
        createOrderDto,
        symbol,
      );

      await this.validateAndReserveBalance(
        queryRunner,
        user_id,
        asset.code,
        requiredAmount,
      );

      // 5. Create order (UUID sẽ tự sinh)
      const order = this.orderRepository.create({
        user_id: user_id.toString(),
        symbol: createOrderDto.symbol,
        side: createOrderDto.side,
        type: createOrderDto.type,
        price: createOrderDto.price,
        qty: createOrderDto.qty,
        filled_qty: '0',
        status: OrderStatus.NEW,
        tif: createOrderDto.tif,
        client_order_id: createOrderDto.client_order_id,
      });

      const savedOrder = await queryRunner.manager.save(Order, order);
      await queryRunner.commitTransaction();

      // 🎯 Get full order with relations để return & publish
      const fullOrder = await this.findOrderById(savedOrder.id);

      // 🎯 Trigger matching engine & publish event in parallel (fire-and-forget)
      if (fullOrder.type === OrderType.LIMIT && fullOrder.price) {
        this.matchingEngineService
          .matchLimitOrder(fullOrder)
          .catch((err) => console.error('❌ Matching engine error:', err));
      }

      this.publishOrderEvent('order.created', fullOrder).catch((err) =>
        console.error('❌ Publish event error:', err),
      );

      return fullOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findOrderById(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['user', 'symbol_entity'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async getSymbolByCode(code: string): Promise<Symbol> {
    const symbol = await this.symbolRepository.findOne({
      where: { symbol: code },
      relations: ['base_asset_entity', 'quote_asset_entity'],
    });

    if (!symbol) {
      throw new NotFoundException(`Symbol ${code} not found`);
    }

    return symbol;
  }

  async cancelOrder(user_id: number, order_id: string): Promise<Order> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await queryRunner.manager.findOne(Order, {
        where: {
          id: order_id,
          user_id: user_id.toString(),
        },
        relations: ['symbol_entity'],
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (
        ![OrderStatus.NEW, OrderStatus.PARTIALLY_FILLED].includes(order.status)
      ) {
        throw new BadRequestException(
          `Cannot cancel order with status: ${order.status}`,
        );
      }

      const { asset, lockedAmount } = await this.calculateLockedAmount(order);

      await this.releaseLockedBalance(
        queryRunner,
        user_id,
        asset.code,
        lockedAmount,
      );

      await queryRunner.manager.update(Order, order.id, {
        status: OrderStatus.CANCELED,
        updated_at: new Date(),
      });

      await queryRunner.commitTransaction();

      const canceledOrder = await this.findOrderById(order.id);

      // 🗑️ Remove order from order book L2
      await this.orderBookService.removeOrder(
        canceledOrder.symbol,
        canceledOrder.side,
        canceledOrder.price,
        canceledOrder.id,
      );

      await this.publishOrderEvent('order.canceled', canceledOrder);

      return canceledOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private validateOrderParameters(
    orderDto: CreateOrderDto,
    symbol: Symbol,
  ): void {
    const qty = new Decimal(orderDto.qty);
    const price = orderDto.price ? new Decimal(orderDto.price) : null;

    // Validate quantity
    if (qty.lte(0)) {
      throw new BadRequestException('Quantity must be positive');
    }

    const minQty = new Decimal(symbol.min_qty);
    if (qty.lt(minQty)) {
      throw new BadRequestException(
        `Quantity must be at least ${symbol.min_qty}`,
      );
    }

    if (symbol.max_qty) {
      const maxQty = new Decimal(symbol.max_qty);
      if (qty.gt(maxQty)) {
        throw new BadRequestException(
          `Quantity cannot exceed ${symbol.max_qty}`,
        );
      }
    }

    // Validate lot size
    const lotSize = new Decimal(symbol.lot_size);
    const remainder = qty.mod(lotSize);
    if (!remainder.eq(0)) {
      throw new BadRequestException(
        `Quantity must be multiple of ${symbol.lot_size}`,
      );
    }

    // Validate price for LIMIT orders
    if (orderDto.type === OrderType.LIMIT) {
      if (!price || price.lte(0)) {
        throw new BadRequestException('Price is required for LIMIT orders');
      }

      // Validate tick size
      const tickSize = new Decimal(symbol.tick_size);
      const priceRemainder = price.mod(tickSize);
      if (!priceRemainder.eq(0)) {
        throw new BadRequestException(
          `Price must be multiple of ${symbol.tick_size}`,
        );
      }

      // Validate notional value
      const notional = qty.times(price);
      const minNotional = new Decimal(symbol.min_notional);
      if (notional.lt(minNotional)) {
        throw new BadRequestException(
          `Order value must be at least ${symbol.min_notional}`,
        );
      }

      if (symbol.max_notional) {
        const maxNotional = new Decimal(symbol.max_notional);
        if (notional.gt(maxNotional)) {
          throw new BadRequestException(
            `Order value cannot exceed ${symbol.max_notional}`,
          );
        }
      }
    }
  }

  private calculateRequiredBalance(
    orderDto: CreateOrderDto,
    symbol: Symbol,
  ): { asset: Asset; requiredAmount: string } {
    const qty = new Decimal(orderDto.qty);

    if (orderDto.side === OrderSide.BUY) {
      // For BUY orders, need quote asset (e.g., USDT for BTCUSDT)
      const price =
        orderDto.type === OrderType.MARKET
          ? new Decimal(symbol.max_notional || '100000').div(qty) // Estimate using max notional
          : new Decimal(orderDto.price);

      return {
        asset: symbol.quote_asset_entity,
        requiredAmount: qty.times(price).toString(),
      };
    } else {
      // For SELL orders, need base asset (e.g., BTC for BTCUSDT)
      return {
        asset: symbol.base_asset_entity,
        requiredAmount: qty.toString(),
      };
    }
  }

  private async validateAndReserveBalance(
    queryRunner: any,
    user_id: number,
    assetCode: string,
    requiredAmount: string,
  ): Promise<void> {
    // Chỉ sử dụng ví spot cho lệnh GTC
    const balance = await queryRunner.manager.findOne(Balance, {
      where: { user_id, currency: assetCode, wallet_type: WalletType.SPOT },
    });

    if (!balance) {
      throw new BadRequestException(
        `No ${assetCode} balance found in spot wallet`,
      );
    }

    const available = new Decimal(balance.available);
    const required = new Decimal(requiredAmount);

    if (available.lt(required)) {
      throw new BadRequestException(
        `Insufficient ${assetCode} balance in spot wallet`,
      );
    }

    // Reserve the balance
    await queryRunner.manager.update(Balance, balance.id, {
      available: available.minus(required).toString(),
      locked: new Decimal(balance.locked).plus(required).toString(),
    });
  }

  private async publishOrderEvent(
    eventType: string,
    order: Order,
  ): Promise<void> {
    try {
      // 📊 Chuẩn bị event data
      const eventData = {
        // 🆔 Event metadata
        event_type: eventType,
        timestamp: new Date().toISOString(),
        source: 'order-service',

        // 📋 Order data
        order_id: order.id,
        user_id: order.user_id,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        price: order.price,
        qty: order.qty,
        filled_qty: order.filled_qty,
        status: order.status,
        tif: order.tif,
        client_order_id: order.client_order_id,
        created_at: order.created_at,

        // 💰 Trading pair info (nếu có relations)
        base_asset: order.symbol_entity?.base_asset || null,
        quote_asset: order.symbol_entity?.quote_asset || null,

        // 👤 User info (ẩn sensitive data)
        user_email: order.user?.email || null, // Có thể bỏ for privacy
      };

      // 🚀 Publish to multiple channels

      // 1️⃣ General orders channel (tất cả services quan tâm)
      await this.redisService.publish('orders', eventData);

      // 2️⃣ Symbol-specific channel (matching engine theo symbol)
      await this.redisService.publish(`orders:${order.symbol}`, eventData);

      // 3️⃣ User-specific channel (personal notifications)
      await this.redisService.publish(
        `user:${order.user_id}:orders`,
        eventData,
      );
    } catch (error) {
      // ⚠️ Không throw error để không ảnh hưởng order creation
      // Chỉ log để debug
      console.error(`❌ Failed to publish ${eventType}:`, error);
    }
  }

  async syncOrdersToRedis(): Promise<{ synced: number; errors: number }> {
    console.log('🔄 Starting sync of database orders to Redis...');

    let synced = 0;
    let errors = 0;

    try {
      // Get all active orders from database
      const activeOrders = await this.orderRepository.find({
        where: {
          status: In([OrderStatus.NEW, OrderStatus.PARTIALLY_FILLED]),
        },
        relations: ['symbol_entity'],
      });

      console.log(`📊 Found ${activeOrders.length} active orders to sync`);

      for (const order of activeOrders) {
        try {
          // Calculate remaining quantity (qty - filled_qty)
          const remainingQty = new Decimal(order.qty).minus(
            new Decimal(order.filled_qty),
          );

          // Skip orders with no remaining quantity
          if (remainingQty.lte(0)) {
            continue;
          }

          // Add to order book
          await this.orderBookService.addOrder(order.symbol, {
            orderId: order.id,
            userId: parseInt(order.user_id),
            price: order.price,
            quantity: order.qty,
            remainingQty: remainingQty.toString(),
            timestamp: order.created_at.getTime(),
            side: order.side,
          });

          synced++;
          console.log(
            `✅ Synced order ${order.id} (${order.symbol} ${order.side} ${order.price})`,
          );
        } catch (error) {
          errors++;
          console.error(`❌ Failed to sync order ${order.id}:`, error.message);
        }
      }

      console.log(`🎉 Sync completed: ${synced} synced, ${errors} errors`);
      return { synced, errors };
    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw error;
    }
  }

  private async calculateLockedAmount(
    order: Order,
  ): Promise<{ asset: Asset; lockedAmount: string }> {
    // Get symbol with asset relations
    const symbol = await this.symbolRepository.findOne({
      where: { symbol: order.symbol },
      relations: ['base_asset_entity', 'quote_asset_entity'],
    });

    if (!symbol) {
      throw new BadRequestException(`Symbol ${order.symbol} not found`);
    }

    const remainingQty = new Decimal(order.qty).minus(
      new Decimal(order.filled_qty),
    );

    if (order.side === OrderSide.BUY) {
      // For BUY orders, locked quote asset (e.g., USDT)
      const lockedAmount = remainingQty.times(new Decimal(order.price));
      return {
        asset: symbol.quote_asset_entity,
        lockedAmount: lockedAmount.toString(),
      };
    } else {
      // For SELL orders, locked base asset (e.g., BTC)
      return {
        asset: symbol.base_asset_entity,
        lockedAmount: remainingQty.toString(),
      };
    }
  }

  private async releaseLockedBalance(
    queryRunner: any,
    user_id: number,
    assetCode: string,
    amount: string,
  ): Promise<void> {
    // Chỉ sử dụng ví spot cho lệnh GTC
    const balance = await queryRunner.manager.findOne(Balance, {
      where: { user_id, currency: assetCode, wallet_type: WalletType.SPOT },
    });

    if (!balance) {
      throw new BadRequestException(
        `No ${assetCode} balance found in spot wallet`,
      );
    }

    const releaseAmount = new Decimal(amount);
    const currentLocked = new Decimal(balance.locked);
    const currentAvailable = new Decimal(balance.available);

    // Validate we have enough locked balance
    if (currentLocked.lt(releaseAmount)) {
      throw new BadRequestException(
        `Insufficient locked ${assetCode} balance in spot wallet`,
      );
    }

    // Release the balance
    await queryRunner.manager.update(Balance, balance.id, {
      available: currentAvailable.plus(releaseAmount).toString(),
      locked: currentLocked.minus(releaseAmount).toString(),
    });
  }

  /**
   * 📝 Update order status and filled quantity in database
   * @param orderId - Order ID
   * @param status - New status
   * @param filledQty - Filled quantity
   */
  async updateOrderStatusInDb(
    orderId: string,
    status: OrderStatus,
    filledQty: string,
  ): Promise<void> {
    await this.orderRepository.update(
      { id: orderId },
      {
        status,
        filled_qty: filledQty,
      },
    );
  }

  /**
   * 📋 Get pending orders waiting for matching (NEW or PARTIALLY_FILLED)
   * @param user_id - User ID
   * @param symbol - Optional: filter by trading pair
   */
  async getPendingOrders(user_id: number, symbol?: string) {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .where('order.user_id = :user_id', { user_id: user_id.toString() })
      .andWhere('order.status IN (:...statuses)', {
        statuses: [OrderStatus.NEW, OrderStatus.PARTIALLY_FILLED],
      })
      .orderBy('order.created_at', 'DESC');

    if (symbol) {
      query.andWhere('order.symbol = :symbol', { symbol });
    }

    const orders = await query.getMany();

    return orders.map((order) => ({
      id: order.id,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      price: order.price,
      qty: order.qty,
      filled_qty: order.filled_qty,
      remaining_qty: new Decimal(order.qty).minus(order.filled_qty).toString(),
      status: order.status,
      tif: order.tif,
      client_order_id: order.client_order_id,
      created_at: order.created_at,
      updated_at: order.updated_at,
    }));
  }
}
