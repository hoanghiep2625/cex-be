import { OrderService } from './../orders/order.service';
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { UserSessionService } from '../users/user-session.service';

@Injectable()
export class OrderGateway implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('OrderGateway');
  private clients = new Map<string, any>();

  constructor(
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    private readonly userSessionService: UserSessionService,
  ) {}

  onModuleInit() {
    this.logger.log('✅ OrderGateway initialized (ready for WebSocket)');
  }

  onModuleDestroy() {
    this.clients.clear();
    this.logger.log('🧹 OrderGateway destroyed');
  }

  /**
   * Handle WebSocket connection to /ws/orders
   * Using listenKey (Binance-style authentication)
   */
  async handleConnection(
    ws: any,
    symbol: string,
    listenKey?: string,
    type: string = 'spot',
  ) {
    const id = Math.random().toString(36);

    // Verify listenKey
    if (!listenKey) {
      ws.send(JSON.stringify({ error: 'ListenKey required' }));
      ws.close();
      return;
    }

    const session = await this.userSessionService.validateListenKey(listenKey);
    if (!session) {
      ws.send(JSON.stringify({ error: 'Invalid or expired listenKey' }));
      ws.close();
      return;
    }

    const userId = session.user_id;

    this.clients.set(id, { ws, userId, symbol, listenKey });
    this.logger.log(
      `🔗 Client connected: ${id} (User: ${userId}, Symbol: ${symbol}, Type: ${type})`,
    );

    // Send initial data
    try {
      const ordersPending = await this.orderService.getPendingOrders(
        userId,
        symbol,
      );
      ws.send(
        JSON.stringify({
          action: 'pending_orders',
          symbol,
          orders: ordersPending,
          timestamp: Date.now(),
        }),
      );
    } catch (err) {
      this.logger.error('Failed to fetch initial orders:', err);
    }

    // No polling - updates pushed when orders change via broadcastPendingOrdersUpdate()

    ws.on('close', () => {
      this.clients.delete(id);
      this.logger.log(`🔌 Client disconnected: ${id}`);
    });

    ws.on('error', (err: any) => {
      this.logger.error(`❌ Client error: ${err.message}`);
    });
  }

  /**
   * Broadcast pending orders update to all subscribers of a user
   */
  async broadcastPendingOrdersUpdate(
    userId: number,
    symbol?: string,
  ): Promise<void> {
    const subscribers = Array.from(this.clients.values()).filter(
      (client) => client.userId === userId,
    );

    if (subscribers.length === 0) {
      return;
    }

    try {
      const orders = await this.orderService.getPendingOrders(userId, symbol);
      const message = JSON.stringify({
        action: 'pending_orders',
        symbol: symbol || 'all',
        orders,
        timestamp: Date.now(),
      });

      subscribers.forEach((client) => {
        if (client.ws.readyState === 1) {
          client.ws.send(message);
        }
      });

      this.logger.debug(
        `📤 Broadcast to user ${userId} (${subscribers.length} subscribers)`,
      );
    } catch (err) {
      this.logger.error('Failed to broadcast pending orders:', err);
    }
  }
}
