import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { SymbolService } from '../symbols/symbol.service';

export interface MarketDataUpdate {
  symbol: string;
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  highPrice24h: number;
  lowPrice24h: number;
  volume24h: number;
  quoteAssetVolume24h: number;
  name: string;
}

@Injectable()
export class MarketDataGateway implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('MarketDataGateway');
  private clients = new Map<string, any>();
  private intervals = new Map<string, NodeJS.Timeout>();

  constructor(private readonly symbolService: SymbolService) {}

  onModuleInit() {
    this.logger.log('✅ MarketDataGateway initialized (ready for WebSocket)');
  }

  onModuleDestroy() {
    // Clear all intervals
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals.clear();
    this.clients.clear();
    this.logger.log('🧹 MarketDataGateway destroyed');
  }

  // Called by gateway middleware
  async handleConnection(ws: any, symbol: string, type: string = 'spot') {
    const id = Math.random().toString(36);
    this.clients.set(id, ws);
    this.logger.log(
      `🔗 MarketData Client connected: ${id} for symbol: ${symbol}, type: ${type}`,
    );

    // Send initial market data
    try {
      const marketData = await this.getMarketData(symbol, type);
      this.logger.log(
        `📤 Sending initial market data for ${symbol} (${type}) to client ${id}`,
      );
      ws.send(JSON.stringify({ symbol, type, data: marketData }));
    } catch (err) {
      this.logger.error(
        `❌ Error fetching initial market data for ${symbol}:`,
        err,
      );
    }

    // Stream updates every 1 second
    const interval = setInterval(async () => {
      try {
        if (ws.readyState === 1) {
          // 1 = OPEN
          const marketData = await this.getMarketData(symbol, type);
          ws.send(JSON.stringify({ symbol, type, data: marketData }));
        }
      } catch (err) {
        this.logger.error(`❌ Stream error for ${symbol}:`, err);
      }
    }, 1000);

    this.intervals.set(id, interval);

    ws.on('close', () => {
      const intervalId = this.intervals.get(id);
      if (intervalId) {
        clearInterval(intervalId);
        this.intervals.delete(id);
      }
      this.clients.delete(id);
      this.logger.log(`🔌 MarketData Client disconnected: ${id}`);
    });

    ws.on('error', (err: any) => {
      this.logger.error(`❌ MarketData Client error for ${id}: ${err.message}`);
    });
  }

  /**
   * Fetch market data for a symbol
   * @param symbol - Trading pair (BTCUSDT)
   * @param type - Trading type (spot, margin, futures)
   * @returns Market data with price, changes, volume, etc.
   */
  private async getMarketData(
    symbol: string,
    type: string = 'spot',
  ): Promise<MarketDataUpdate> {
    try {
      return await this.symbolService.getMarketData(symbol, type);
    } catch (err) {
      this.logger.error(`Error fetching market data for ${symbol}:`, err);
      // Return default data if error
      return {
        symbol,
        price: 0,
        priceChange24h: 0,
        priceChangePercent24h: 0,
        highPrice24h: 0,
        lowPrice24h: 0,
        volume24h: 0,
        quoteAssetVolume24h: 0,
        name: '',
      };
    }
  }
}
