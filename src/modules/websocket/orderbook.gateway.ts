import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { OrderBookService } from '../redis/orderbook.service';

@Injectable()
export class OrderBookGateway implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('OrderBookGateway');
  private clients = new Map<string, any>();

  constructor(private readonly orderBookService: OrderBookService) {}

  onModuleInit() {
    this.logger.log('✅ OrderBookGateway initialized (ready for WebSocket)');
  }

  onModuleDestroy() {
    this.clients.clear();
    this.logger.log('🧹 OrderBookGateway destroyed');
  }

  // Called by gateway middleware
  async handleConnection(ws: any, symbol: string) {
    const id = Math.random().toString(36);
    this.clients.set(id, ws);
    this.logger.log(`🔗 Client connected: ${id}`);

    // Send initial data
    const orderBook = await this.orderBookService.getOrderBookDepth(symbol);
    ws.send(JSON.stringify({ symbol, orderBook }));

    // Stream updates every 1 second
    const interval = setInterval(async () => {
      try {
        const orderBook = await this.orderBookService.getOrderBookDepth(symbol);
        if (ws.readyState === 1) {
          // 1 = OPEN
          ws.send(JSON.stringify({ symbol, orderBook }));
        }
      } catch (err) {
        this.logger.error('Stream error:', err);
      }
    }, 1000);

    ws.on('close', () => {
      clearInterval(interval);
      this.clients.delete(id);
      this.logger.log(`🔌 Client disconnected: ${id}`);
    });

    ws.on('error', (err: any) => {
      this.logger.error(`❌ Client error: ${err.message}`);
    });
  }
}
