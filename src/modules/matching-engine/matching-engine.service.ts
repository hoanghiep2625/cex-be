import { Injectable } from '@nestjs/common';
import { OrderBookService } from '../redis/orderbook.service';
import { Order, TimeInForce, OrderType } from '../orders/entities/order.entity';

@Injectable()
export class MatchingEngineService {
  constructor(private readonly orderBookService: OrderBookService) {}

  /**
   * 🎯 Match limit order against order book
   * Called when new order is created - automatically tries to match
   */
  async matchLimitOrder(order: Order): Promise<void> {
    const { bestBid, bestAsk } = await this.orderBookService.getBestBidAsk(
      order.symbol,
    );
    

    if (order.tif === TimeInForce.GTC) {
    } else if (order.tif === TimeInForce.IOC) {
    } else if (order.tif === TimeInForce.FOK) {
    } else if (order.type === OrderType.MARKET) {
    } else {
      console.log(`❌ Invalid time in force: ${order.tif}`);
      console.log(`${'='.repeat(60)}\n`);
      return;
    }
  }
}
