import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { OrderBookService } from './orderbook.service';
import { Server, WebSocket } from 'ws';

@Injectable()
export class OrderBookGateway implements OnModuleInit, OnModuleDestroy {
  private wss?: Server;

  constructor(private readonly orderBookService: OrderBookService) {}

  onModuleInit() {
    // Khởi tạo WS server khi module start
    this.wss = new Server({ port: 8080 }, () => {
      console.log('WS server listening ws://localhost:8080');
    });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('New client connected');

      const sendOrderBook = async (symbol: string) => {
        try {
          const orderBook =
            await this.orderBookService.getOrderBookDepth(symbol);
          ws.send(JSON.stringify({ symbol, orderBook }));
        } catch (e) {
          console.error('sendOrderBook error:', e);
        }
      };

      // Lắng nghe message từ client
      ws.on('message', async (raw) => {
        try {
          const message = raw.toString(); // Buffer -> string
          const { symbol } = JSON.parse(message);
          if (!symbol) return;

          console.log(`Client subscribed to ${symbol} order book`);

          // Gửi lần đầu
          await sendOrderBook(symbol);

          // Gửi mỗi giây
          const interval = setInterval(() => sendOrderBook(symbol), 1000);

          ws.once('close', () => {
            clearInterval(interval);
            console.log('Client disconnected');
          });
        } catch (e) {
          console.error('Invalid message:', e);
        }
      });
    });
  }

  onModuleDestroy() {
    // Đóng WS server khi app shutdown
    this.wss?.clients.forEach((client) => client.close());
    this.wss?.close();
  }
}
