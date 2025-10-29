import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { OrderBookService } from '../redis/orderbook.service';

interface OrderBookClient {
  ws: any;
  symbol: string;
  type: string;
}

@Injectable()
export class OrderBookGateway implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('OrderBookGateway');
  private clients = new Map<string, OrderBookClient>();

  constructor(private readonly orderBookService: OrderBookService) {}

  onModuleInit() {
    this.logger.log('✅ OrderBookGateway initialized (ready for WebSocket)');
  }

  onModuleDestroy() {
    this.clients.clear();
    this.logger.log('🧹 OrderBookGateway destroyed');
  }

  // Called by gateway middleware
  async handleConnection(ws: any, symbol: string, type: string = 'spot') {
    const id = Math.random().toString(36);
    this.clients.set(id, { ws, symbol, type });
    this.logger.log(`🔗 Client connected: ${id} (${symbol}, ${type})`);

    // Send initial data
    const orderBook = await this.orderBookService.getOrderBookDepth(symbol);
    ws.send(JSON.stringify({ symbol, type, orderBook }));

    // No polling - updates pushed when orders are added/removed/matched via broadcastOrderBookUpdate()

    ws.on('close', () => {
      this.clients.delete(id);
      this.logger.log(`🔌 Client disconnected: ${id}`);
    });

    ws.on('error', (err: any) => {
      this.logger.error(`❌ Client error: ${err.message}`);
    });
  }

  /**
   * Broadcast orderbook update to all connected clients for a symbol
   * Called when orders are added/removed/matched
   */
  async broadcastOrderBookUpdate(symbol: string): Promise<void> {
    try {
      // Find all clients subscribed to this symbol
      for (const [id, client] of this.clients) {
        if (client.symbol === symbol && client.ws.readyState === 1) {
          const orderBook = await this.orderBookService.getOrderBookDepth(
            client.symbol,
          );

          client.ws.send(
            JSON.stringify({
              symbol: client.symbol,
              type: client.type,
              orderBook,
              action: 'update',
              timestamp: Date.now(),
            }),
          );
        }
      }

      if (this.clients.size > 0) {
        this.logger.log(
          `📊 Broadcasted orderbook update for ${symbol} to ${this.clients.size} clients`,
        );
      }
    } catch (err) {
      this.logger.error(`❌ Broadcast orderbook update error:`, err);
    }
  }
}
