import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { SymbolService } from '../symbols/symbol.service';

/**
 * Ticker WebSocket Gateway
 * Provides real-time price updates for multiple symbols
 *
 * Endpoint: ws://localhost:3000/ws/ticker?quote_asset=USDT
 */
@Injectable()
export class TickerGateway implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('TickerGateway');
  private clients = new Map<string, { ws: any; quoteAsset: string }>();
  private intervals = new Map<string, NodeJS.Timeout>();

  constructor(private readonly symbolService: SymbolService) {}

  onModuleInit() {
    this.logger.log('✅ TickerGateway initialized');
  }

  onModuleDestroy() {
    // Clear all intervals
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals.clear();
    this.clients.clear();
    this.logger.log('🧹 TickerGateway destroyed');
  }

  /**
   * Handle WebSocket connection to /ws/ticker
   * @param ws - WebSocket connection
   * @param quoteAsset - Quote asset to filter (USDT, BTC, etc.)
   * @param type - Trading type (spot, margin, futures)
   */
  async handleConnection(
    ws: any,
    quoteAsset: string = 'USDT',
    type: string = 'spot',
  ) {
    const id = Math.random().toString(36);
    this.clients.set(id, { ws, quoteAsset });
    this.logger.log(
      `🔗 Ticker Client connected: ${id} (quote: ${quoteAsset}, type: ${type})`,
    );

    // Send initial ticker data
    try {
      const tickers = await this.symbolService.getAllSymbolsWithMarketData({
        quote_asset: quoteAsset,
        status: 'TRADING',
        type: type as any,
      });

      ws.send(
        JSON.stringify({
          action: 'initial',
          quote_asset: quoteAsset,
          type,
          data: tickers.data,
          timestamp: Date.now(),
        }),
      );

      this.logger.log(
        `📤 Sent initial ticker data: ${tickers.data?.length || 0} symbols`,
      );
    } catch (err) {
      this.logger.error(`❌ Error fetching initial ticker data:`, err);
    }

    // Stream updates every 3 seconds
    const interval = setInterval(async () => {
      try {
        if (ws.readyState === 1) {
          // 1 = OPEN
          const tickers = await this.symbolService.getAllSymbolsWithMarketData({
            quote_asset: quoteAsset,
            status: 'TRADING',
            type: type as any,
          });

          ws.send(
            JSON.stringify({
              action: 'update',
              quote_asset: quoteAsset,
              type,
              data: tickers.data,
              timestamp: Date.now(),
            }),
          );
        }
      } catch (err) {
        this.logger.error(`❌ Ticker stream error for ${quoteAsset}:`, err);
      }
    }, 3000); // Update every 3 seconds

    this.intervals.set(id, interval);

    ws.on('close', () => {
      const intervalId = this.intervals.get(id);
      if (intervalId) {
        clearInterval(intervalId);
        this.intervals.delete(id);
      }
      this.clients.delete(id);
      this.logger.log(`🔌 Ticker Client disconnected: ${id}`);
    });

    ws.on('error', (err: any) => {
      this.logger.error(`❌ Ticker Client error for ${id}: ${err.message}`);
    });
  }

  /**
   * Broadcast ticker update to all connected clients
   * Called when a trade happens
   */
  async broadcastTickerUpdate(symbol: string): Promise<void> {
    try {
      // Get updated market data for this symbol
      const [baseAsset, quoteAsset] = this.parseSymbol(symbol);

      // Send update to all clients subscribed to this quote asset
      for (const [id, { ws, quoteAsset: clientQuote }] of this.clients) {
        if (clientQuote === quoteAsset && ws.readyState === 1) {
          const tickers = await this.symbolService.getAllSymbolsWithMarketData({
            quote_asset: clientQuote,
            status: 'TRADING',
            type: 'spot' as any,
          });

          ws.send(
            JSON.stringify({
              action: 'trade_update',
              symbol,
              data: tickers.data,
              timestamp: Date.now(),
            }),
          );
        }
      }
    } catch (err) {
      this.logger.error(`❌ Broadcast ticker update error:`, err);
    }
  }

  /**
   * Parse symbol into base and quote assets
   * e.g., BTCUSDT -> ['BTC', 'USDT']
   */
  private parseSymbol(symbol: string): [string, string] {
    // Common quote assets
    const quoteAssets = ['USDT', 'BUSD', 'USDC', 'BTC', 'ETH', 'BNB'];

    for (const quote of quoteAssets) {
      if (symbol.endsWith(quote)) {
        const base = symbol.slice(0, -quote.length);
        return [base, quote];
      }
    }

    // Fallback: assume last 3-4 chars are quote
    return [symbol.slice(0, -4), symbol.slice(-4)];
  }
}
