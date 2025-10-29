import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { CandleService } from '../candles/candle.service';

interface CandleClient {
  ws: any;
  symbol: string;
  interval: string;
  type: string;
}

@Injectable()
export class CandleGateway implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('CandleGateway');
  private clients = new Map<string, CandleClient>();

  constructor(private readonly candleService: CandleService) {}

  onModuleInit() {
    this.logger.log('✅ CandleGateway initialized (ready for WebSocket)');
  }

  onModuleDestroy() {
    this.clients.clear();
    this.logger.log('🧹 CandleGateway destroyed');
  }

  // Called by gateway middleware
  async handleConnection(
    ws: any,
    symbol: string,
    interval: string,
    type: string = 'spot',
  ) {
    const id = Math.random().toString(36);
    this.clients.set(id, { ws, symbol, interval, type });
    this.logger.log(
      `🔗 Candle Client connected: ${id} for ${symbol} (${interval}, ${type})`,
    );

    // Send initial candles
    try {
      const candles = await this.candleService.getCandles({
        symbol,
        interval: interval as any,
        type: type as any,
        limit: 500,
      });

      ws.send(
        JSON.stringify({
          action: 'initial',
          symbol,
          interval,
          type,
          candles,
          timestamp: Date.now(),
        }),
      );
    } catch (err) {
      this.logger.error(`Error fetching initial candles for ${symbol}:`, err);
    }

    // No polling - updates pushed when trades happen via broadcastCandleUpdate()

    ws.on('close', () => {
      this.clients.delete(id);
      this.logger.log(`🔌 Candle Client disconnected: ${id}`);
    });

    ws.on('error', (err: any) => {
      this.logger.error(`❌ Candle Client error for ${id}: ${err.message}`);
    });
  }

  /**
   * Broadcast candle update to all connected clients for a symbol
   * Called when a trade happens
   */
  async broadcastCandleUpdate(symbol: string): Promise<void> {
    try {
      // Find all clients subscribed to this symbol
      for (const [id, client] of this.clients) {
        if (client.symbol === symbol && client.ws.readyState === 1) {
          const candles = await this.candleService.getCandles({
            symbol: client.symbol,
            interval: client.interval as any,
            type: client.type as any,
            limit: 500,
          });

          client.ws.send(
            JSON.stringify({
              action: 'trade_update',
              symbol: client.symbol,
              interval: client.interval,
              type: client.type,
              candles,
              timestamp: Date.now(),
            }),
          );
        }
      }

      if (this.clients.size > 0) {
        this.logger.log(
          `📊 Broadcasted candle update for ${symbol} to ${this.clients.size} clients`,
        );
      }
    } catch (err) {
      this.logger.error(`❌ Broadcast candle update error:`, err);
    }
  }
}
