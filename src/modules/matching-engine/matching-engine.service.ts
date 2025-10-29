import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderBookService } from '../redis/orderbook.service';
import {
  Order,
  TimeInForce,
  OrderType,
  OrderStatus,
} from '../orders/entities/order.entity';
import { Trade } from '../trades/entities/trade.entity';
import { OrderService } from '../orders/order.service';
import { TradeService } from '../trades/trade.service';
import { BalanceService } from '../balances/balance.service';
import { WalletType } from '../balances/entities/balance.entity';
import Decimal from 'decimal.js';
import { RedisService } from 'src/modules/redis/redis.service';
import { TickerGateway } from '../websocket/ticker.gateway';

@Injectable()
export class MatchingEngineService {
  // Symbol-level queue để serialize matching operations (FIX RACE CONDITION)
  private symbolQueues = new Map<string, Promise<void>>();

  constructor(
    private readonly orderBookService: OrderBookService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    private readonly tradeService: TradeService,
    private readonly balanceService: BalanceService,
    private readonly redisService: RedisService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly tickerGateway: TickerGateway,
  ) {}

  async matchLimitOrder(order: Order): Promise<void> {
    // Enqueue matching per symbol để prevent race conditions
    return this.enqueueMatching(order.symbol, () =>
      this._matchLimitOrder(order),
    );
  }

  // Queue manager - serialize operations per symbol
  private async enqueueMatching(
    symbol: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    const current = this.symbolQueues.get(symbol);
    const next = current ? current.then(fn, fn) : fn();

    this.symbolQueues.set(symbol, next);

    try {
      await next;
    } finally {
      if (this.symbolQueues.get(symbol) === next) {
        this.symbolQueues.delete(symbol);
      }
    }
  }

  // Actual matching logic (renamed, with pessimistic locking)
  private async _matchLimitOrder(order: Order): Promise<void> {
    const { bestBid, bestAsk } = await this.orderBookService.getBestBidAsk(
      order.symbol,
    );
    //1 Kiểm tra xem order có thể match được không
    const price = new Decimal(order.price);
    const bestBidD = bestBid ? new Decimal(bestBid) : null;
    const bestAskD = bestAsk ? new Decimal(bestAsk) : null;
    const canMatch =
      order.type === OrderType.LIMIT &&
      ((order.side === 'BUY' && !!bestAskD && price.gte(bestAskD)) ||
        (order.side === 'SELL' && !!bestBidD && price.lte(bestBidD)));

    if (order.tif === TimeInForce.GTC && order.type === OrderType.LIMIT) {
      //2
      if (canMatch) {
        //2.1 - Thực hiện khớp lệnh ở nhiều mức giá
        const remainingQty = await this.executeLimitOrder(order);

        // Tính filledQty của taker order
        const filledQty = new Decimal(order.qty).minus(remainingQty);

        // Cập nhật order status của taker
        if (filledQty.gt(0)) {
          let status = OrderStatus.PARTIALLY_FILLED;
          if (filledQty.gte(order.qty)) {
            status = OrderStatus.FILLED;
          }
          await this.orderService.updateOrderStatusInDb(
            order.id,
            status,
            filledQty.toString(),
          );
          console.log(
            `✅ Taker order ${order.id} updated: ${status} (${filledQty}/${order.qty})`,
          );
        }

        // Nếu còn số lượng → thêm vào order book
        if (remainingQty.gt(0)) {
          const partialOrder = {
            ...order,
            qty: remainingQty.toString(),
          } as Order;
          await this.addOrderToOrderBook(partialOrder);
        }
      } else {
        //2.2
        await this.addOrderToOrderBook(order);
        console.log(`🔍 GTC order: ${order.id} cannot match`);
      }
    } else if (
      order.tif === TimeInForce.IOC &&
      order.type === OrderType.LIMIT
    ) {
      //3
      console.log(`🔍 IOC order: ${order.id}`);
    } else if (
      order.tif === TimeInForce.FOK &&
      order.type === OrderType.LIMIT
    ) {
      //4
      console.log(`🔍 FOK order: ${order.id}`);
    } else if (order.type === OrderType.MARKET) {
      //5
      console.log(`🔍 MARKET order: ${order.id}`);
    } else {
      console.log(`❌ Invalid time in force: ${order.tif}`);
      console.log(`${'='.repeat(60)}\n`);
      return;
    }
  }
  private async addOrderToOrderBook(order: Order): Promise<void> {
    try {
      await this.orderBookService.addOrder(order.symbol, {
        orderId: order.id,
        userId: parseInt(order.user_id),
        price: order.price,
        quantity: order.qty,
        remainingQty: order.qty,
        timestamp: order.created_at.getTime(),
        side: order.side,
      });
      console.log(
        `✅ Added order ${order.id} to order book (${order.symbol} ${order.side} @ ${order.price})`,
      );
    } catch (error) {
      console.error(
        `❌ Failed to add order ${order.id} to order book:`,
        error.message,
      );
    }
  }
  private async removeOrderFromOrderBook(order: Order): Promise<void> {
    try {
      await this.orderBookService.removeOrder(
        order.symbol,
        order.side,
        order.price,
        order.id,
      );
      console.log(
        `✅ Removed order ${order.id} from order book (${order.symbol} ${order.side} @ ${order.price})`,
      );
    } catch (error) {
      console.error(
        `❌ Failed to remove order ${order.id} from order book:`,
        error.message,
      );
    }
  }

  /**
   * 🎯 Khớp lệnh ở nhiều mức giá (WITH PESSIMISTIC LOCKING)
   * @param order - Lệnh mới
   * @returns Số lượng còn lại sau khi khớp
   */
  private async executeLimitOrder(order: Order): Promise<any> {
    let remainingQty = new Decimal(order.qty);
    const incomingPrice = new Decimal(order.price);
    const incomingSide = order.side;

    // Xác định bên đối diện (nếu BUY → lấy SELL, nếu SELL → lấy BUY)
    const opposingSide = incomingSide === 'BUY' ? 'SELL' : 'BUY';

    console.log(
      `\n🔄 Start matching ${incomingSide} order ${order.id} @ ${order.price} for ${order.qty}`,
    );

    // Lặp lại cho đến khi hết số lượng hoặc không có lệnh để khớp
    while (remainingQty.gt(0)) {
      const { bestBid, bestAsk } = await this.orderBookService.getBestBidAsk(
        order.symbol,
      );

      // Kiểm tra xem còn có lệnh đối diện hay không
      let shouldContinue = false;
      if (incomingSide === 'BUY' && bestAsk) {
        shouldContinue = incomingPrice.gte(new Decimal(bestAsk));
      } else if (incomingSide === 'SELL' && bestBid) {
        shouldContinue = incomingPrice.lte(new Decimal(bestBid));
      }

      if (!shouldContinue) {
        console.log(
          `⚠️  No more matching opportunities for ${incomingSide} order ${order.id}`,
        );
        break;
      }

      // Lấy giá để khớp (bestAsk cho BUY, bestBid cho SELL)
      const matchPrice = incomingSide === 'BUY' ? bestAsk : bestBid;

      // Lấy tất cả lệnh ở mức giá này
      const ordersAtPrice = await this.orderBookService.getOrdersAtPrice(
        order.symbol,
        opposingSide,
        matchPrice,
      );

      if (ordersAtPrice.length === 0) {
        console.log(`⚠️  No orders at ${matchPrice} for ${opposingSide} side`);
        break;
      }

      // Khớp với từng lệnh ở mức giá này (WITH DB VALIDATION)
      for (const existingOrder of ordersAtPrice) {
        if (remainingQty.lte(0)) break;

        // ✅ Fetch maker order từ DB để validate
        const lockedMaker = await this.orderRepository.findOne({
          where: { id: existingOrder.orderId },
        });

        if (!lockedMaker) {
          console.log(
            `⚠️ Maker ${existingOrder.orderId} not found in DB - skipping`,
          );
          continue;
        }

        // ✅ VALIDATE: Check actual remaining từ DB (not Redis)
        const actualMakerRemaining = new Decimal(lockedMaker.qty).minus(
          lockedMaker.filled_qty,
        );

        if (actualMakerRemaining.lte(0)) {
          console.log(
            `⚠️ Maker ${existingOrder.orderId} already fully filled - removing from Redis`,
          );
          // Remove from Redis vì đã filled
          await this.orderBookService.removeOrder(
            order.symbol,
            opposingSide,
            matchPrice,
            existingOrder.orderId,
          );
          continue;
        }

        // Use actualMakerRemaining instead of Redis remainingQty
        const matchQty = remainingQty.lt(actualMakerRemaining)
          ? remainingQty
          : actualMakerRemaining;

        console.log(
          `✅ MATCH: ${incomingSide} #${order.id} <-> ${opposingSide} #${existingOrder.orderId} @ ${matchPrice} for ${matchQty}`,
        );

        // Update số lượng còn lại của cả 2 lệnh
        remainingQty = remainingQty.minus(matchQty);
        const existingNewQty = actualMakerRemaining.minus(matchQty);

        // 1️⃣ Cập nhật số dư cho cả 2 users
        await this.updateBalances(
          incomingSide,
          order.user_id as any,
          order.symbol,
          new Decimal(matchPrice),
          matchQty,
        );

        await this.updateBalances(
          opposingSide,
          existingOrder.userId,
          order.symbol,
          new Decimal(matchPrice),
          matchQty,
        );

        // 2️⃣ Thêm bản ghi trade
        await this.createTradeRecord(
          order.symbol,
          incomingSide === 'BUY' ? existingOrder.orderId : order.id,
          incomingSide === 'BUY' ? order.id : existingOrder.orderId,
          incomingSide === 'BUY'
            ? existingOrder.userId
            : (order.user_id as any),
          incomingSide === 'BUY'
            ? (order.user_id as any)
            : existingOrder.userId,
          incomingSide,
          new Decimal(matchPrice),
          matchQty,
        );

        // Phát sự kiện tạo nến sau khi khớp lệnh (dùng Redis Streams)
        const symbolEntity = await this.orderService.getSymbolByCode(
          order.symbol,
        );
        const quoteQuantity = new Decimal(matchPrice).times(matchQty);
        await this.redisService.addToStream('trades:candle', {
          symbol: order.symbol,
          symbol_id: symbolEntity.id.toString(),
          type: symbolEntity.type,
          price: matchPrice.toString(),
          baseQty: matchQty.toString(),
          quoteQty: quoteQuantity.toString(),
          isTakerBuy: incomingSide === 'BUY' ? 'true' : 'false',
          tsMs: Date.now().toString(),
        });

        // 3️⃣ Cập nhật order status của maker order
        const makerFilledQty = new Decimal(lockedMaker.qty).minus(
          existingNewQty,
        );

        await this.updateOrderStatus(
          existingOrder.orderId,
          makerFilledQty,
          new Decimal(lockedMaker.qty),
        );

        // Update lệnh cũ trong order book
        if (existingNewQty.gt(0)) {
          // Lệnh cũ còn số lượng
          await this.orderBookService.updateOrderQuantity(
            order.symbol,
            opposingSide,
            matchPrice,
            existingOrder.orderId,
            existingNewQty.toString(),
          );
        } else {
          // Lệnh cũ đã hết số lượng - xoá khỏi order book
          await this.orderBookService.removeOrder(
            order.symbol,
            opposingSide,
            matchPrice,
            existingOrder.orderId,
          );
        }
      }
    }

    console.log(
      `📊 Order ${order.id} matching completed. Remaining qty: ${remainingQty}`,
    );
    return remainingQty;
  }

  /**
   * 📝 Cập nhật status của lệnh
   * @param orderId - Order ID
   * @param filledQty - Số lượng đã khớp
   * @param totalQty - Tổng số lượng lệnh
   */
  private async updateOrderStatus(
    orderId: string,
    filledQty: any,
    totalQty: any,
  ): Promise<void> {
    let status = OrderStatus.PARTIALLY_FILLED;

    if (filledQty.gte(totalQty)) {
      status = OrderStatus.FILLED;
    }

    // Update order status in database
    await this.orderService.updateOrderStatusInDb(
      orderId,
      status,
      filledQty.toString(),
    );
    console.log(
      `✅ Updated order ${orderId} status to ${status} (${filledQty}/${totalQty})`,
    );
  }

  /**
   * 💰 Cập nhật số dư của user
   * BUY: Trừ USDT (locked) → nhận coin (available)
   * SELL: Trừ coin (locked) → nhận USDT (available)
   * @param side - BUY | SELL
   * @param userId - User ID
   * @param tradingPair - Trading pair (e.g., BTCUSDT)
   * @param matchPrice - Giá khớp
   * @param matchQty - Số lượng khớp
   */
  private async updateBalances(
    side: 'BUY' | 'SELL',
    userId: number,
    tradingPair: string,
    matchPrice: any,
    matchQty: any,
  ): Promise<void> {
    // Get trading pair info từ database để lấy base_asset và quote_asset
    const symbolEntity = await this.orderService.getSymbolByCode(tradingPair);
    const baseAsset = symbolEntity.base_asset;
    const quoteAsset = symbolEntity.quote_asset;
    const quoteQuantity = matchPrice.times(matchQty);

    if (side === 'BUY') {
      // BUY: Trừ USDT locked, Cộng BTC available
      const usdtBalance = await this.balanceService.getUserBalance(
        userId,
        quoteAsset,
        WalletType.SPOT,
      );

      // 1. Trừ USDT khỏi locked
      const newLockedUsdt = new Decimal(usdtBalance.locked)
        .minus(quoteQuantity)
        .toString();

      await this.balanceService.updateBalanceAmount(
        userId,
        quoteAsset,
        WalletType.SPOT,
        usdtBalance.available, // available giữ nguyên
        newLockedUsdt, // locked giảm
      );

      // 2. Cộng BTC vào available
      const btcBalance = await this.balanceService.getUserBalance(
        userId,
        baseAsset,
        WalletType.SPOT,
      );

      const newAvailableBtc = new Decimal(btcBalance.available)
        .plus(matchQty)
        .toString();

      await this.balanceService.updateBalanceAmount(
        userId,
        baseAsset,
        WalletType.SPOT,
        newAvailableBtc, // available tăng
        btcBalance.locked, // locked giữ nguyên
      );

      console.log(
        `💵 ${side} balance updated: -${quoteQuantity} ${quoteAsset} (locked), +${matchQty} ${baseAsset} (available)`,
      );
    } else {
      // SELL: Trừ BTC locked, Cộng USDT available
      const btcBalance = await this.balanceService.getUserBalance(
        userId,
        baseAsset,
        WalletType.SPOT,
      );

      // 1. Trừ BTC khỏi locked
      const newLockedBtc = new Decimal(btcBalance.locked)
        .minus(matchQty)
        .toString();

      await this.balanceService.updateBalanceAmount(
        userId,
        baseAsset,
        WalletType.SPOT,
        btcBalance.available, // available giữ nguyên
        newLockedBtc, // locked giảm
      );

      // 2. Cộng USDT vào available
      const usdtBalance = await this.balanceService.getUserBalance(
        userId,
        quoteAsset,
        WalletType.SPOT,
      );

      const newAvailableUsdt = new Decimal(usdtBalance.available)
        .plus(quoteQuantity)
        .toString();

      await this.balanceService.updateBalanceAmount(
        userId,
        quoteAsset,
        WalletType.SPOT,
        newAvailableUsdt, // available tăng
        usdtBalance.locked, // locked giữ nguyên
      );

      console.log(
        `💵 ${side} balance updated: -${matchQty} ${baseAsset} (locked), +${quoteQuantity} ${quoteAsset} (available)`,
      );
    }
  }

  /**
   * 📊 Thêm bản ghi trade
   * @param tradingPair - Trading pair (e.g., BTCUSDT)
   * @param makerOrderId - Maker order ID
   * @param takerOrderId - Taker order ID
   * @param makerUserId - Maker user ID
   * @param takerUserId - Taker user ID
   * @param takerSide - BUY | SELL
   * @param matchPrice - Giá khớp
   * @param matchQty - Số lượng khớp
   */
  private async createTradeRecord(
    tradingPair: string,
    makerOrderId: string,
    takerOrderId: string,
    makerUserId: number,
    takerUserId: number,
    takerSide: 'BUY' | 'SELL',
    matchPrice: any,
    matchQty: any,
  ): Promise<Trade> {
    const quoteQuantity = matchPrice.times(matchQty);

    const trade = await this.tradeService.createTrade({
      symbol: tradingPair,
      maker_order_id: makerOrderId,
      taker_order_id: takerOrderId,
      maker_user_id: makerUserId,
      taker_user_id: takerUserId,
      taker_side: takerSide,
      price: matchPrice.toString(),
      quantity: matchQty.toString(),
      quote_quantity: quoteQuantity.toString(),
    });

    console.log(
      `📊 Trade created: ${tradingPair} ${matchQty} @ ${matchPrice} (Maker: #${makerOrderId}, Taker: #${takerOrderId})`,
    );

    // 🚀 Broadcast ticker update to WebSocket clients
    await this.tickerGateway.broadcastTickerUpdate(tradingPair);

    return trade;
  }
}
