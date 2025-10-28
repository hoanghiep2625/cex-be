import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { CandleService } from '../candles/candle.service';

@Injectable()
export class CandleGateway implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('CandleGateway');
  private clients = new Map<string, any>();
  private intervals = new Map<string, NodeJS.Timeout>();

  constructor(private readonly candleService: CandleService) {}

  onModuleInit() {
    this.logger.log('✅ CandleGateway initialized (ready for WebSocket)');
  }

  onModuleDestroy() {
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals.clear();
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
    this.clients.set(id, ws);
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

    // Stream updates every 5 seconds (polling database for new candles)
    const updateInterval = setInterval(async () => {
      try {
        if (ws.readyState === 1) {
          // 1 = OPEN
          const candles = await this.candleService.getCandles({
            symbol,
            interval: interval as any,
            type: type as any,
            limit: 500,
          });

          ws.send(
            JSON.stringify({
              action: 'update',
              symbol,
              interval,
              type,
              candles,
              timestamp: Date.now(),
            }),
          );
        }
      } catch (err) {
        this.logger.error(`Stream error for ${symbol}:`, err);
      }
    }, 5000);

    this.intervals.set(id, updateInterval);

    ws.on('close', () => {
      const intervalId = this.intervals.get(id);
      if (intervalId) {
        clearInterval(intervalId);
        this.intervals.delete(id);
      }
      this.clients.delete(id);
      this.logger.log(`🔌 Candle Client disconnected: ${id}`);
    });

    ws.on('error', (err: any) => {
      this.logger.error(`❌ Candle Client error for ${id}: ${err.message}`);
    });
  }
}
