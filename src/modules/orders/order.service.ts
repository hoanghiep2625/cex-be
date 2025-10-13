import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
    // @InjectRepository(Balance)
    // private readonly balanceRepository: Repository<Balance>,
    // @InjectRepository(Asset)
    // private readonly assetRepository: Repository<Asset>,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
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

      // 📡 Publish order event to Redis
      await this.publishOrderEvent('order.created', fullOrder);

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

  /**
   * 📋 Get user's orders with filters
   *
   * @param user_id - User ID
   * @param filters - Query filters (status, symbol, side, etc.)
   */
  async getUserOrders(
    user_id: number,
    filters: {
      status?: OrderStatus[];
      symbol?: string;
      side?: OrderSide;
      type?: OrderType;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ orders: Order[]; total: number }> {
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.symbol_entity', 'symbol_entity')
      .where('order.user_id = :user_id', { user_id: user_id.toString() });

    // 🔍 Apply filters
    if (filters.status?.length) {
      queryBuilder.andWhere('order.status IN (:...statuses)', {
        statuses: filters.status,
      });
    }

    if (filters.symbol) {
      queryBuilder.andWhere('order.symbol = :symbol', {
        symbol: filters.symbol,
      });
    }

    if (filters.side) {
      queryBuilder.andWhere('order.side = :side', { side: filters.side });
    }

    if (filters.type) {
      queryBuilder.andWhere('order.type = :type', { type: filters.type });
    }

    // 📊 Count total before pagination
    const total = await queryBuilder.getCount();

    // 📄 Apply pagination
    if (filters.offset) {
      queryBuilder.skip(filters.offset);
    }

    queryBuilder.take(filters.limit || 50); // Default 50 orders per page

    // 📅 Order by creation time (newest first)
    queryBuilder.orderBy('order.created_at', 'DESC');

    const orders = await queryBuilder.getMany();

    return { orders, total };
  }

  /**
   * 🔍 Get user's order by ID (with permission check)
   *
   * @param user_id - User ID
   * @param order_id - Order UUID
   */
  async getUserOrderById(user_id: number, order_id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: {
        id: order_id,
        user_id: user_id.toString(),
      },
      relations: ['user', 'symbol_entity'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * ❌ Cancel user's order
   *
   * @param user_id - User ID
   * @param order_id - Order UUID
   */
  async cancelOrder(user_id: number, order_id: string): Promise<Order> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1️⃣ Find and validate order
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

      // 2️⃣ Check if order can be canceled
      if (
        ![OrderStatus.NEW, OrderStatus.PARTIALLY_FILLED].includes(order.status)
      ) {
        throw new BadRequestException(
          `Cannot cancel order with status: ${order.status}`,
        );
      }

      // 3️⃣ Calculate locked amount to release
      const { asset, lockedAmount } = await this.calculateLockedAmount(order);

      // 4️⃣ Release locked balance
      await this.releaseLockedBalance(
        queryRunner,
        user_id,
        asset.code,
        lockedAmount,
      );

      // 5️⃣ Update order status
      await queryRunner.manager.update(Order, order.id, {
        status: OrderStatus.CANCELED,
        updated_at: new Date(),
      });

      await queryRunner.commitTransaction();

      // 6️⃣ Get updated order with relations
      const canceledOrder = await this.findOrderById(order.id);

      // 📡 Publish cancel event
      await this.publishOrderEvent('order.canceled', canceledOrder);

      return canceledOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 📊 Get order history (filled + canceled)
   *
   * @param user_id - User ID
   * @param filters - Query filters
   */
  async getUserOrderHistory(
    user_id: number,
    filters: {
      symbol?: string;
      side?: OrderSide;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ orders: Order[]; total: number }> {
    return this.getUserOrders(user_id, {
      ...filters,
      status: [OrderStatus.FILLED, OrderStatus.CANCELED, OrderStatus.REJECTED],
    });
  }

  /**
   * 🔄 Get active orders (NEW + PARTIALLY_FILLED)
   *
   * @param user_id - User ID
   * @param filters - Query filters
   */
  async getUserActiveOrders(
    user_id: number,
    filters: {
      symbol?: string;
      side?: OrderSide;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ orders: Order[]; total: number }> {
    return this.getUserOrders(user_id, {
      ...filters,
      status: [OrderStatus.NEW, OrderStatus.PARTIALLY_FILLED],
    });
  }

  private validateOrderParameters(
    orderDto: CreateOrderDto,
    symbol: Symbol,
  ): void {
    const qty = parseFloat(orderDto.qty);
    const price = orderDto.price ? parseFloat(orderDto.price) : null;

    // Validate quantity
    if (qty <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    if (qty < parseFloat(symbol.min_qty)) {
      throw new BadRequestException(
        `Quantity must be at least ${symbol.min_qty}`,
      );
    }

    if (symbol.max_qty && qty > parseFloat(symbol.max_qty)) {
      throw new BadRequestException(`Quantity cannot exceed ${symbol.max_qty}`);
    }

    // Validate lot size
    const lotSize = parseFloat(symbol.lot_size);
    if ((qty * Math.pow(10, 8)) % (lotSize * Math.pow(10, 8)) !== 0) {
      throw new BadRequestException(
        `Quantity must be multiple of ${symbol.lot_size}`,
      );
    }

    // Validate price for LIMIT orders
    if (orderDto.type === OrderType.LIMIT) {
      if (!price || price <= 0) {
        throw new BadRequestException('Price is required for LIMIT orders');
      }

      // Validate tick size
      const tickSize = parseFloat(symbol.tick_size);
      if ((price * Math.pow(10, 8)) % (tickSize * Math.pow(10, 8)) !== 0) {
        throw new BadRequestException(
          `Price must be multiple of ${symbol.tick_size}`,
        );
      }

      // Validate notional value
      const notional = qty * price;
      if (notional < parseFloat(symbol.min_notional)) {
        throw new BadRequestException(
          `Order value must be at least ${symbol.min_notional}`,
        );
      }

      if (symbol.max_notional && notional > parseFloat(symbol.max_notional)) {
        throw new BadRequestException(
          `Order value cannot exceed ${symbol.max_notional}`,
        );
      }
    }
  }

  private calculateRequiredBalance(
    orderDto: CreateOrderDto,
    symbol: Symbol,
  ): { asset: Asset; requiredAmount: string } {
    const qty = parseFloat(orderDto.qty);

    if (orderDto.side === OrderSide.BUY) {
      // For BUY orders, need quote asset (e.g., USDT for BTCUSDT)
      const price =
        orderDto.type === OrderType.MARKET
          ? parseFloat(symbol.max_notional || '100000') / qty // Estimate using max notional
          : parseFloat(orderDto.price);

      return {
        asset: symbol.quote_asset_entity,
        requiredAmount: (qty * price).toString(),
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
    const balance = await queryRunner.manager.findOne(Balance, {
      where: { user_id, currency: assetCode },
    });

    if (!balance) {
      throw new BadRequestException(`No ${assetCode} balance found`);
    }

    const available = parseFloat(balance.available);
    const required = parseFloat(requiredAmount);

    if (available < required) {
      throw new BadRequestException(`Insufficient ${assetCode} balance`);
    }

    // Reserve the balance
    await queryRunner.manager.update(Balance, balance.id, {
      available: (available - required).toString(),
      locked: (parseFloat(balance.locked) + required).toString(),
    });
  }

  /**
   * 📡 Publish order event to Redis
   *
   * @param eventType - Loại event: 'order.created', 'order.filled', 'order.canceled'
   * @param order - Order object đầy đủ
   *
   * 🎯 Events sẽ được consume bởi:
   * - Matching Engine: Xử lý match orders
   * - WebSocket Service: Real-time notifications
   * - Risk Management: Monitor positions
   * - Audit Service: Compliance tracking
   * - Notification Service: Email/SMS alerts
   */
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

      console.log(`✅ Published ${eventType} for order ${order.id}`);
    } catch (error) {
      // ⚠️ Không throw error để không ảnh hưởng order creation
      // Chỉ log để debug
      console.error(`❌ Failed to publish ${eventType}:`, error);
    }
  }

  /**
   * 💰 Calculate locked amount for order cancellation
   *
   * @param order - Order to calculate locked amount
   */
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

    const remainingQty = parseFloat(order.qty) - parseFloat(order.filled_qty);

    if (order.side === OrderSide.BUY) {
      // For BUY orders, locked quote asset (e.g., USDT)
      const lockedAmount = remainingQty * parseFloat(order.price);
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

  /**
   * 🔓 Release locked balance back to available
   *
   * @param queryRunner - Database transaction
   * @param user_id - User ID
   * @param assetCode - Asset code to release
   * @param amount - Amount to release
   */
  private async releaseLockedBalance(
    queryRunner: any,
    user_id: number,
    assetCode: string,
    amount: string,
  ): Promise<void> {
    const balance = await queryRunner.manager.findOne(Balance, {
      where: { user_id, currency: assetCode },
    });

    if (!balance) {
      throw new BadRequestException(`No ${assetCode} balance found`);
    }

    const releaseAmount = parseFloat(amount);
    const currentLocked = parseFloat(balance.locked);
    const currentAvailable = parseFloat(balance.available);

    // Validate we have enough locked balance
    if (currentLocked < releaseAmount) {
      throw new BadRequestException(`Insufficient locked ${assetCode} balance`);
    }

    // Release the balance
    await queryRunner.manager.update(Balance, balance.id, {
      available: (currentAvailable + releaseAmount).toString(),
      locked: (currentLocked - releaseAmount).toString(),
    });
  }

  // ================================
  // 🔐 ADMIN METHODS
  // ================================

  /**
   * 📋 Admin: Get all orders in system
   *
   * @param filters - Query filters
   */
  async getAllSystemOrders(
    filters: {
      status?: OrderStatus[];
      symbol?: string;
      side?: OrderSide;
      type?: OrderType;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ orders: Order[]; total: number }> {
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.symbol_entity', 'symbol_entity');

    // 🔍 Apply filters
    if (filters.status?.length) {
      queryBuilder.andWhere('order.status IN (:...statuses)', {
        statuses: filters.status,
      });
    }

    if (filters.symbol) {
      queryBuilder.andWhere('order.symbol = :symbol', {
        symbol: filters.symbol,
      });
    }

    if (filters.side) {
      queryBuilder.andWhere('order.side = :side', { side: filters.side });
    }

    if (filters.type) {
      queryBuilder.andWhere('order.type = :type', { type: filters.type });
    }

    // 📊 Count total before pagination
    const total = await queryBuilder.getCount();

    // 📄 Apply pagination
    if (filters.offset) {
      queryBuilder.skip(filters.offset);
    }

    queryBuilder.take(filters.limit || 50);

    // 📅 Order by creation time (newest first)
    queryBuilder.orderBy('order.created_at', 'DESC');

    const orders = await queryBuilder.getMany();

    return { orders, total };
  }

  /**
   * ❌ Admin: Force cancel any order
   *
   * @param order_id - Order UUID
   * @param admin_user_id - Admin user ID for audit
   */
  async adminCancelOrder(
    order_id: string,
    admin_user_id: number,
  ): Promise<Order> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1️⃣ Find order (any user's order)
      const order = await queryRunner.manager.findOne(Order, {
        where: { id: order_id },
        relations: ['symbol_entity', 'user'],
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // 2️⃣ Check if order can be canceled
      if (
        ![OrderStatus.NEW, OrderStatus.PARTIALLY_FILLED].includes(order.status)
      ) {
        throw new BadRequestException(
          `Cannot cancel order with status: ${order.status}`,
        );
      }

      // 3️⃣ Calculate locked amount to release
      const { asset, lockedAmount } = await this.calculateLockedAmount(order);

      // 4️⃣ Release locked balance
      await this.releaseLockedBalance(
        queryRunner,
        parseInt(order.user_id),
        asset.code,
        lockedAmount,
      );

      // 5️⃣ Update order status
      await queryRunner.manager.update(Order, order.id, {
        status: OrderStatus.CANCELED,
        updated_at: new Date(),
      });

      await queryRunner.commitTransaction();

      // 6️⃣ Get updated order
      const canceledOrder = await this.findOrderById(order.id);

      // 📡 Publish admin cancel event
      await this.publishOrderEvent('order.admin_canceled', {
        ...canceledOrder,
        admin_user_id, // Add admin info to event
      } as any);

      console.log(`🛡️ Admin ${admin_user_id} canceled order ${order_id}`);

      return canceledOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 📊 Admin: Get system order statistics
   *
   * @param symbol - Optional symbol filter
   * @param timeframe - Time period for stats
   */
  async getSystemOrderStats(
    symbol?: string,
    timeframe: '1h' | '24h' | '7d' | '30d' = '24h',
  ): Promise<{
    total_orders: number;
    active_orders: number;
    filled_orders: number;
    canceled_orders: number;
    total_volume: string;
    by_status: Record<OrderStatus, number>;
    by_side: Record<OrderSide, number>;
  }> {
    // 📅 Calculate time range
    const now = new Date();
    const timeRanges = {
      '1h': new Date(now.getTime() - 60 * 60 * 1000),
      '24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
      '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    };
    const fromDate = timeRanges[timeframe];

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .where('order.created_at >= :fromDate', { fromDate });

    if (symbol) {
      queryBuilder.andWhere('order.symbol = :symbol', { symbol });
    }

    // 📊 Get all orders for calculations
    const orders = await queryBuilder.getMany();

    // 🧮 Calculate stats
    const stats = {
      total_orders: orders.length,
      active_orders: orders.filter((o) =>
        [OrderStatus.NEW, OrderStatus.PARTIALLY_FILLED].includes(o.status),
      ).length,
      filled_orders: orders.filter((o) => o.status === OrderStatus.FILLED)
        .length,
      canceled_orders: orders.filter((o) => o.status === OrderStatus.CANCELED)
        .length,
      total_volume: orders
        .filter((o) => o.status === OrderStatus.FILLED)
        .reduce(
          (sum, o) =>
            sum + parseFloat(o.filled_qty) * parseFloat(o.price || '0'),
          0,
        )
        .toString(),
      by_status: {} as Record<OrderStatus, number>,
      by_side: {} as Record<OrderSide, number>,
    };

    // 📈 Count by status
    Object.values(OrderStatus).forEach((status) => {
      stats.by_status[status] = orders.filter(
        (o) => o.status === status,
      ).length;
    });

    // 📈 Count by side
    Object.values(OrderSide).forEach((side) => {
      stats.by_side[side] = orders.filter((o) => o.side === side).length;
    });

    return stats;
  }
}
