import { Injectable, Logger } from '@nestjs/common';
import * as WebSocket from 'ws';
import { OrderBookService } from './orderbook.service';

@Injectable()
export class OrderBookGateway {
  private wss: WebSocket.Server;
  private logger = new Logger('OrderBookGateway');
  private clients = new Map<WebSocket, Set<string>>();
  private intervals = new Map<string, NodeJS.Timer>();

  constructor(private readonly orderBookService: OrderBookService) {
    this.initWebSocketServer();
  }

  private initWebSocketServer() {
    this.wss = new WebSocket.Server({ port: 8080 });

    this.wss.on('connection', (ws: WebSocket) => {
      this.logger.log('🔗 Client connected');
      this.clients.set(ws, new Set());

      ws.on('message', (message: string) => {
        this.handleMessage(ws, message);
      });

      ws.on('close', () => {
        this.logger.log('🔌 Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        this.logger.error(`❌ WebSocket error: ${error.message}`);
      });
    });

    this.logger.log('✅ WebSocket server running on port 8080');
  }

  private async handleMessage(ws: WebSocket, message: string) {
    try {
      const data = JSON.parse(message);
      const { type, symbol, limit = 20 } = data;

      if (type === 'subscribe') {
        this.handleSubscribe(ws, symbol);
      } else if (type === 'unsubscribe') {
        this.handleUnsubscribe(ws, symbol);
      } else if (type === 'best') {
        const best = await this.orderBookService.getBestBidAsk(symbol);
        ws.send(JSON.stringify({ type: 'best', data: best }));
      } else if (type === 'depth') {
        const depth = await this.orderBookService.getOrderBookDepth(
          symbol,
          limit,
        );
        ws.send(JSON.stringify({ type: 'depth', data: depth }));
      }
    } catch (error) {
      this.logger.error(`❌ Error handling message: ${error.message}`);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  }

  private handleSubscribe(ws: WebSocket, symbol: string) {
    const subscriptions = this.clients.get(ws);
    if (!subscriptions.has(symbol)) {
      subscriptions.add(symbol);
      this.logger.log(`✅ Client subscribed to ${symbol}`);

      // Stream updates every 1 second
      const intervalKey = `${symbol}`;
      if (!this.intervals.has(intervalKey)) {
        const interval = setInterval(async () => {
          const depth = await this.orderBookService.getOrderBookDepth(symbol);

          // Send to all clients subscribed to this symbol
          this.clients.forEach((subs, client) => {
            if (subs.has(symbol) && client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({ type: 'update', symbol, data: depth }),
              );
            }
          });
        }, 1000);

        this.intervals.set(intervalKey, interval);
      }

      ws.send(JSON.stringify({ type: 'subscribed', symbol }));
    }
  }

  private handleUnsubscribe(ws: WebSocket, symbol: string) {
    const subscriptions = this.clients.get(ws);
    subscriptions.delete(symbol);
    this.logger.log(`❌ Client unsubscribed from ${symbol}`);

    // Clear interval if no more subscribers
    const hasSubscribers = Array.from(this.clients.values()).some((subs) =>
      subs.has(symbol),
    );
    if (!hasSubscribers) {
      const interval = this.intervals.get(symbol);
      if (interval) {
        clearInterval(interval as any);
        this.intervals.delete(symbol);
      }
    }

    ws.send(JSON.stringify({ type: 'unsubscribed', symbol }));
  }

  broadcast(symbol: string, data: any) {
    this.clients.forEach((subs, client) => {
      if (subs.has(symbol) && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'update', symbol, data }));
      }
    });
  }
}
