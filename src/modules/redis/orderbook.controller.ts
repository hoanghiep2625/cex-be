import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { OrderBookService, OrderBookEntry } from '../redis/orderbook.service';

interface TestOrderDto {
  symbol: string;
  side: 'BUY' | 'SELL';
  price: string;
  quantity: string;
  userId: number;
}

@Controller('orderbook')
export class OrderBookController {
  constructor(private readonly orderBookService: OrderBookService) {}

  /**
   * 📊 Get order book snapshot
   * GET /orderbook/BTCUSDT?depth=10
   */
  @Get(':symbol')
  async getOrderBook(
    @Param('symbol') symbol: string,
    @Query('depth') depth?: string,
  ) {
    const depthNum = depth ? parseInt(depth) : 20;
    return await this.orderBookService.getOrderBook(symbol, depthNum);
  }

  /**
   * 💰 Get best bid/ask prices
   * GET /orderbook/BTCUSDT/best
   */
  @Get(':symbol/best')
  async getBestBidAsk(@Param('symbol') symbol: string) {
    return await this.orderBookService.getBestBidAsk(symbol);
  }

  /**
   * 📋 Get orders at specific price
   * GET /orderbook/BTCUSDT/price/50000/BUY
   */
  @Get(':symbol/price/:price/:side')
  async getOrdersAtPrice(
    @Param('symbol') symbol: string,
    @Param('price') price: string,
    @Param('side') side: 'BUY' | 'SELL',
  ) {
    return await this.orderBookService.getOrdersAtPrice(symbol, side, price);
  }

  /**
   * 📊 Get order book statistics
   * GET /orderbook/BTCUSDT/stats
   */
  @Get(':symbol/stats')
  async getOrderBookStats(@Param('symbol') symbol: string) {
    return await this.orderBookService.getOrderBookStats(symbol);
  }

  /**
   * 🧪 Add test order (for development only)
   * POST /orderbook/test
   */
  @Post('test')
  async addTestOrder(@Body() testOrder: TestOrderDto) {
    const orderEntry: OrderBookEntry = {
      orderId: `test-${Date.now()}-${Math.random()}`,
      userId: testOrder.userId,
      price: testOrder.price,
      quantity: testOrder.quantity,
      remainingQty: testOrder.quantity,
      timestamp: Date.now(),
      side: testOrder.side,
    };

    await this.orderBookService.addOrder(testOrder.symbol, orderEntry);

    return {
      success: true,
      message: 'Test order added to order book',
      order: orderEntry,
    };
  }

  /**
   * 🧹 Clear order book (for testing)
   * POST /orderbook/BTCUSDT/clear
   */
  @Post(':symbol/clear')
  async clearOrderBook(@Param('symbol') symbol: string) {
    await this.orderBookService.clearOrderBook(symbol);

    return {
      success: true,
      message: `Order book cleared for ${symbol}`,
    };
  }
}
