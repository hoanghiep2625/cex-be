import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import Decimal from 'decimal.js';

export interface OrderBookEntry {
  orderId: string;
  userId: number;
  price: string;
  quantity: string;
  remainingQty: string;
  timestamp: number;
  side: 'BUY' | 'SELL';
}

export interface OrderBookLevel {
  price: string;
  quantity: string;
  count: number;
}

export interface OrderBookSnapshot {
  symbol: string;
  bids: OrderBookLevel[]; // Sorted DESC (highest first)
  asks: OrderBookLevel[]; // Sorted ASC (lowest first)
  timestamp: number;
}

/**
 * 📊 Order Book Service - Quản lý Order Book L2 với Redis
 *
 * Structure:
 * - orderbook:{symbol}:bids → ZSet (score = price, value = totalQty)
 * - orderbook:{symbol}:asks → ZSet (score = price, value = totalQty)
 * - orderbook:{symbol}:bids:{price} → Hash (orderId → orderData)
 * - orderbook:{symbol}:asks:{price} → Hash (orderId → orderData)
 */
@Injectable()
export class OrderBookService {
  constructor(private readonly redisService: RedisService) {}

  /**
   * 📝 Add order to order book
   *
   * @param symbol - Trading pair (BTCUSDT)
   * @param order - Order details
   */
  async addOrder(symbol: string, order: OrderBookEntry): Promise<void> {
    const client = this.redisService.getClient();
    const side = order.side === 'BUY' ? 'bids' : 'asks'; // Map BUY->bids, SELL->asks
    const price = order.price;

    // Validate price is not null/undefined
    if (!price || price === 'null' || price === 'undefined') {
      throw new Error(`Invalid price: ${price} for order ${order.orderId}`);
    }

    // Keys
    const priceListKey = `orderbook:${symbol}:${side}`; // ZSet cho price levels
    const orderHashKey = `orderbook:${symbol}:${side}:${price}`; // Hash cho orders tại price

    // 1. Add order vào hash tại price level
    await client.hset(
      orderHashKey,
      order.orderId,
      JSON.stringify({
        orderId: order.orderId,
        userId: order.userId,
        quantity: order.quantity,
        remainingQty: order.remainingQty,
        timestamp: order.timestamp,
      }),
    );

    // 2. Update total quantity tại price level (ZSet)
    const totalQty = await this.getTotalQuantityAtPrice(symbol, side, price);
    const priceDecimal = new Decimal(price);
    if (priceDecimal.isNaN()) {
      throw new Error(
        `Invalid price format: ${price} for order ${order.orderId}`,
      );
    }
    await client.zadd(priceListKey, priceDecimal.toNumber(), price);

    console.log(
      `📊 Added ${side} order ${order.orderId} at ${price} for ${symbol}`,
    );
  }

  /**
   * 🗑️ Remove order from order book
   *
   * @param symbol - Trading pair
   * @param side - BUY | SELL
   * @param price - Price level
   * @param orderId - Order ID to remove
   */
  async removeOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    price: string,
    orderId: string,
  ): Promise<void> {
    const client = this.redisService.getClient();
    const sideKey = side === 'BUY' ? 'bids' : 'asks'; // Map BUY->bids, SELL->asks

    const priceListKey = `orderbook:${symbol}:${sideKey}`;
    const orderHashKey = `orderbook:${symbol}:${sideKey}:${price}`;

    // 1. Remove order từ hash
    await client.hdel(orderHashKey, orderId);

    // 2. Update total quantity tại price level
    const totalQty = await this.getTotalQuantityAtPrice(symbol, sideKey, price);

    if (totalQty === 0) {
      // Nếu không còn orders, remove price level khỏi ZSet
      await client.zrem(priceListKey, `${price}:0`);
      await client.del(orderHashKey); // Cleanup empty hash
    } else {
      // Update quantity trong ZSet
      const priceDecimal = new Decimal(price);
      if (priceDecimal.isNaN()) {
        throw new Error(`Invalid price format: ${price} for order ${orderId}`);
      }
      await client.zadd(
        priceListKey,
        priceDecimal.toNumber(),
        `${price}:${totalQty}`,
      );
    }

    console.log(
      `🗑️ Removed ${sideKey} order ${orderId} at ${price} for ${symbol}`,
    );
  }

  /**
   * 📊 Get order book snapshot (L2 data)
   *
   * @param symbol - Trading pair
   * @param depth - Number of price levels (default: 20)
   */
  async getOrderBook(
    symbol: string,
    depth: number = 20,
  ): Promise<OrderBookSnapshot> {
    const client = this.redisService.getClient();

    // Get top bids (highest prices first) - ZREVRANGE for DESC
    const bidData = await client.zrevrange(
      `orderbook:${symbol}:bids`,
      0,
      depth - 1,
    );

    // Get top asks (lowest prices first) - ZRANGE for ASC
    const askData = await client.zrange(
      `orderbook:${symbol}:asks`,
      0,
      depth - 1,
    );

    // Parse bids - get quantities from hash
    const bids: OrderBookLevel[] = await Promise.all(
      bidData.map(async (price) => {
        const totalQty = await this.getTotalQuantityAtPrice(
          symbol,
          'bids',
          price,
        );
        const orderCount = await this.getOrderCountAtPrice(
          symbol,
          'bids',
          price,
        );
        return {
          price,
          quantity: totalQty.toString(),
          count: orderCount,
        };
      }),
    );

    // Parse asks - get quantities from hash
    const asks: OrderBookLevel[] = await Promise.all(
      askData.map(async (price) => {
        const totalQty = await this.getTotalQuantityAtPrice(
          symbol,
          'asks',
          price,
        );
        const orderCount = await this.getOrderCountAtPrice(
          symbol,
          'asks',
          price,
        );
        return {
          price,
          quantity: totalQty.toString(),
          count: orderCount,
        };
      }),
    );

    return {
      symbol,
      bids,
      asks,
      timestamp: Date.now(),
    };
  }

  /**
   * 💰 Get best bid and ask prices
   *
   * @param symbol - Trading pair
   */
  async getBestBidAsk(
    symbol: string,
  ): Promise<{ bestBid: string | null; bestAsk: string | null }> {
    const client = this.redisService.getClient();

    // Best bid = highest price in bids ZSet
    const bestBidData = await client.zrevrange(
      `orderbook:${symbol}:bids`,
      0,
      0,
    );
    const bestBid =
      bestBidData.length > 0 ? bestBidData[0].split(':')[0] : null;

    // Best ask = lowest price in asks ZSet
    const bestAskData = await client.zrange(`orderbook:${symbol}:asks`, 0, 0);
    const bestAsk =
      bestAskData.length > 0 ? bestAskData[0].split(':')[0] : null;

    return { bestBid, bestAsk };
  }

  /**
   * 📋 Get all orders at specific price level
   *
   * @param symbol - Trading pair
   * @param side - BUY | SELL
   * @param price - Price level
   */
  async getOrdersAtPrice(
    symbol: string,
    side: 'BUY' | 'SELL',
    price: string,
  ): Promise<OrderBookEntry[]> {
    const client = this.redisService.getClient();
    const sideKey = side === 'BUY' ? 'bids' : 'asks';
    const orderHashKey = `orderbook:${symbol}:${sideKey}:${price}`;

    const orderData = await client.hgetall(orderHashKey);

    return Object.entries(orderData).map(([orderId, data]) => {
      const parsed = JSON.parse(data);
      return {
        ...parsed,
        side,
        price,
      };
    });
  }

  /**
   * 🔄 Update order quantity (partial fill)
   *
   * @param symbol - Trading pair
   * @param side - BUY | SELL
   * @param price - Price level
   * @param orderId - Order ID
   * @param newRemainingQty - New remaining quantity
   */
  async updateOrderQuantity(
    symbol: string,
    side: 'BUY' | 'SELL',
    price: string,
    orderId: string,
    newRemainingQty: string,
  ): Promise<void> {
    const client = this.redisService.getClient();
    const sideKey = side === 'BUY' ? 'bids' : 'asks';
    const orderHashKey = `orderbook:${symbol}:${sideKey}:${price}`;

    // Get current order data
    const orderDataStr = await client.hget(orderHashKey, orderId);
    if (!orderDataStr) return;

    const orderData = JSON.parse(orderDataStr);
    orderData.remainingQty = newRemainingQty;

    // Update order in hash
    await client.hset(orderHashKey, orderId, JSON.stringify(orderData));

    // Update total quantity at price level
    const totalQty = await this.getTotalQuantityAtPrice(symbol, sideKey, price);
    const priceDecimal = new Decimal(price);
    if (priceDecimal.isNaN()) {
      throw new Error(`Invalid price format: ${price} for order ${orderId}`);
    }
    await client.zadd(
      `orderbook:${symbol}:${sideKey}`,
      priceDecimal.toNumber(),
      `${price}:${totalQty}`,
    );

    console.log(
      `🔄 Updated order ${orderId} remaining qty to ${newRemainingQty}`,
    );
  }

  /**
   * 🧮 Calculate total quantity at price level
   *
   * @param symbol - Trading pair
   * @param side - bids | asks
   * @param price - Price level
   */
  private async getTotalQuantityAtPrice(
    symbol: string,
    side: string,
    price: string,
  ): Promise<number> {
    const client = this.redisService.getClient();
    const orderHashKey = `orderbook:${symbol}:${side}:${price}`;

    const orderData = await client.hgetall(orderHashKey);

    let totalQty = new Decimal(0);
    for (const data of Object.values(orderData)) {
      const parsed = JSON.parse(data);
      totalQty = totalQty.plus(new Decimal(parsed.remainingQty));
    }

    return totalQty.toNumber();
  }

  private async getOrderCountAtPrice(
    symbol: string,
    side: string,
    price: string,
  ): Promise<number> {
    const client = this.redisService.getClient();
    const orderHashKey = `orderbook:${symbol}:${side}:${price}`;

    return await client.hlen(orderHashKey);
  }

  /**
   * 🧹 Clear entire order book for symbol
   *
   * @param symbol - Trading pair
   */
  async clearOrderBook(symbol: string): Promise<void> {
    const client = this.redisService.getClient();

    // Get all keys related to this symbol
    const keys = await client.keys(`orderbook:${symbol}:*`);

    if (keys.length > 0) {
      await client.del(...keys);
      console.log(`🧹 Cleared order book for ${symbol} (${keys.length} keys)`);
    }
  }

  /**
   * 📊 Get order book statistics
   *
   * @param symbol - Trading pair
   */
  async getOrderBookStats(symbol: string): Promise<{
    bidLevels: number;
    askLevels: number;
    totalBidVolume: number;
    totalAskVolume: number;
    spread: number | null;
  }> {
    const client = this.redisService.getClient();

    // Count price levels
    const bidLevels = await client.zcard(`orderbook:${symbol}:bids`);
    const askLevels = await client.zcard(`orderbook:${symbol}:asks`);

    // Get all levels to calculate volume
    const bidData = await client.zrange(`orderbook:${symbol}:bids`, 0, -1);
    const askData = await client.zrange(`orderbook:${symbol}:asks`, 0, -1);

    let totalBidVolume = new Decimal(0);
    let totalAskVolume = new Decimal(0);

    bidData.forEach((item) => {
      const [, quantity] = item.split(':');
      totalBidVolume = totalBidVolume.plus(new Decimal(quantity));
    });

    askData.forEach((item) => {
      const [, quantity] = item.split(':');
      totalAskVolume = totalAskVolume.plus(new Decimal(quantity));
    });

    // Calculate spread
    const { bestBid, bestAsk } = await this.getBestBidAsk(symbol);
    let spread = null;
    if (bestBid && bestAsk) {
      spread = new Decimal(bestAsk).minus(new Decimal(bestBid)).toNumber();
    }

    return {
      bidLevels,
      askLevels,
      totalBidVolume: totalBidVolume.toNumber(),
      totalAskVolume: totalAskVolume.toNumber(),
      spread,
    };
  }
}
