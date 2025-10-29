import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { TradeService } from '../trades/trade.service';
import { Trade } from '../trades/entities/trade.entity';

export interface RecentTradeData {
  id: string;
  symbol: string;
  price: string;
  quantity: string;
  time: number; // timestamp in milliseconds
  takerSide: 'BUY' | 'SELL';
}

interface RecentTradesClient {
  ws: any;
  symbol: string;
}

@Injectable()
export class RecentTradesGateway implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('RecentTradesGateway');
  private clients = new Map<string, RecentTradesClient>();

  constructor(private readonly tradeService: TradeService) {}

  onModuleInit() {
    this.logger.log('✅ RecentTradesGateway initialized (ready for WebSocket)');
  }

  onModuleDestroy() {
    this.clients.clear();
    this.logger.log('🧹 RecentTradesGateway destroyed');
  }

  // Called by gateway middleware
  async handleConnection(ws: any, symbol: string) {
    const id = Math.random().toString(36);
    this.clients.set(id, { ws, symbol });
    this.logger.log(`🔗 RecentTrades Client connected: ${id} for ${symbol}`);

    // Send initial recent trades
    try {
      const recentTrades = await this.getRecentTrades(symbol);
      ws.send(JSON.stringify({ symbol, trades: recentTrades }));
    } catch (err) {
      this.logger.error('Error fetching initial trades:', err);
    }

    // No polling - updates pushed when trades happen via broadcastRecentTrade()

    ws.on('close', () => {
      this.clients.delete(id);
      this.logger.log(`🔌 RecentTrades Client disconnected: ${id}`);
    });

    ws.on('error', (err: any) => {
      this.logger.error(`❌ RecentTrades Client error: ${err.message}`);
    });
  }

  /**
   * Broadcast new trade to all connected clients for a symbol
   * Called when a trade happens
   */
  async broadcastRecentTrade(symbol: string): Promise<void> {
    try {
      // Find all clients subscribed to this symbol
      for (const [id, client] of this.clients) {
        if (client.symbol === symbol && client.ws.readyState === 1) {
          const recentTrades = await this.getRecentTrades(client.symbol);

          client.ws.send(
            JSON.stringify({
              symbol: client.symbol,
              trades: recentTrades,
              action: 'trade_update',
              timestamp: Date.now(),
            }),
          );
        }
      }

      if (this.clients.size > 0) {
        this.logger.log(
          `📊 Broadcasted recent trades for ${symbol} to ${this.clients.size} clients`,
        );
      }
    } catch (err) {
      this.logger.error(`❌ Broadcast recent trade error:`, err);
    }
  }

  /**
   * Fetch recent trades from database
   * Returns the last 50 trades sorted by most recent first
   *
   * @param symbol - Trading pair (BTCUSDT)
   * @returns Array of recent trades with price, quantity, and timestamp
   */
  private async getRecentTrades(symbol: string): Promise<RecentTradeData[]> {
    try {
      // Using raw query for better performance
      const trades = await this.tradeService.getRecentTrades(symbol, 50);

      return trades.map((trade: Trade) => ({
        id: trade.id,
        symbol: trade.symbol,
        price: trade.price,
        quantity: trade.quantity,
        time: new Date(trade.created_at).getTime(),
        takerSide: trade.taker_side,
      }));
    } catch (err) {
      this.logger.error(`Error fetching recent trades for ${symbol}:`, err);
      return [];
    }
  }
}
