import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { SymbolService } from '../symbols/symbol.service';

@Injectable()
export class TickerGateway implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger('TickerGateway');
  private clients = new Map<string, { ws: any; quoteAsset: string }>();

  constructor(private readonly symbolService: SymbolService) {}

  onModuleInit() {
    this.logger.log('✅ TickerGateway initialized');
  }

  onModuleDestroy() {
    this.clients.clear();
    this.logger.log('🧹 TickerGateway destroyed');
  }

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

    ws.on('close', () => {
      this.clients.delete(id);
      this.logger.log(`🔌 Ticker Client disconnected: ${id}`);
    });

    ws.on('error', (err: any) => {
      this.logger.error(`❌ Ticker Client error for ${id}: ${err.message}`);
    });
  }

  async broadcastTickerUpdate(
    symbol: string,
    type: string = 'spot',
  ): Promise<void> {
    try {
      const symbolEntity = await this.symbolService.getSymbolBySymbolAndType(
        symbol,
        type,
      );
      const quoteAsset = symbolEntity.quote_asset;

      for (const [id, { ws, quoteAsset: clientQuote }] of this.clients) {
        if (clientQuote === quoteAsset && ws.readyState === 1) {
          const tickers = await this.symbolService.getAllSymbolsWithMarketData({
            quote_asset: clientQuote,
            status: 'TRADING',
            type: type as any,
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
}
