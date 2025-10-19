import { Controller, Get, Post, Param } from '@nestjs/common';
import { OrderBookService } from '../redis/orderbook.service';

@Controller('orderbook')
export class OrderBookController {
  constructor(private readonly orderBookService: OrderBookService) {}

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
