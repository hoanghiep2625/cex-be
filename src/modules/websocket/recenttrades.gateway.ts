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

@Injectable()
export class RecentTradesGateway implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('RecentTradesGateway');
  private clients = new Map<string, any>();
  private intervals = new Map<string, NodeJS.Timeout>();

  constructor(private readonly tradeService: TradeService) {}

  onModuleInit() {
    this.logger.log('✅ RecentTradesGateway initialized (ready for WebSocket)');
  }

  onModuleDestroy() {
    // Clear all intervals
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals.clear();
    this.clients.clear();
    this.logger.log('🧹 RecentTradesGateway destroyed');
  }

  // Called by gateway middleware
  async handleConnection(ws: any, symbol: string) {
    const id = Math.random().toString(36);
    this.clients.set(id, ws);
    this.logger.log(`🔗 RecentTrades Client connected: ${id} for ${symbol}`);

    // Send initial recent trades
    try {
      const recentTrades = await this.getRecentTrades(symbol);
      ws.send(JSON.stringify({ symbol, trades: recentTrades }));
    } catch (err) {
      this.logger.error('Error fetching initial trades:', err);
    }

    // Stream updates every 2 seconds
    const interval = setInterval(async () => {
      try {
        if (ws.readyState === 1) {
          // 1 = OPEN
          const recentTrades = await this.getRecentTrades(symbol);
          ws.send(JSON.stringify({ symbol, trades: recentTrades }));
        }
      } catch (err) {
        this.logger.error('Stream error:', err);
      }
    }, 2000);

    this.intervals.set(id, interval);

    ws.on('close', () => {
      const intervalId = this.intervals.get(id);
      if (intervalId) {
        clearInterval(intervalId);
        this.intervals.delete(id);
      }
      this.clients.delete(id);
      this.logger.log(`🔌 RecentTrades Client disconnected: ${id}`);
    });

    ws.on('error', (err: any) => {
      this.logger.error(`❌ RecentTrades Client error: ${err.message}`);
    });
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
