import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import * as cookieParser from 'cookie-parser';
import { OrderBookGateway } from 'src/modules/websocket/orderbook.gateway';
import { RecentTradesGateway } from 'src/modules/websocket/recenttrades.gateway';
import { MarketDataGateway } from 'src/modules/websocket/marketdata.gateway';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ Enable CORS
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://cex.tahoanghiep.com',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400, // 24 hours
  });

  // Enable cookie parser
  app.use(cookieParser());

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Loại bỏ các properties không được định nghĩa trong DTO
      forbidNonWhitelisted: true, // Throw error nếu có properties không được phép
      transform: true, // Tự động transform type (string -> number, etc.)
    }),
  );

  // Global Response Interceptor
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Global Exception Filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ✅ WebSocket upgrade handler
  const server = app.getHttpServer();
  const orderBookGateway = app.get(OrderBookGateway);
  const recentTradesGateway = app.get(RecentTradesGateway);
  const marketDataGateway = app.get(MarketDataGateway);

  server.on('upgrade', (req: any, socket: any, head: any) => {
    console.log(`[WS] Upgrade request: ${req.url}`);
    if (req.url.startsWith('/ws')) {
      const { WebSocketServer } = require('ws');
      const wss = new WebSocketServer({ noServer: true });

      wss.handleUpgrade(req, socket, head, (ws: any) => {
        // Extract symbol and type from query params
        const url = new URL(req.url, `http://${req.headers.host}`);
        const symbol = url.searchParams.get('symbol') || 'BTCUSDT';
        const type = url.searchParams.get('type') || 'spot';

        // Route to appropriate gateway based on path
        if (req.url.includes('/ws/trades')) {
          console.log(
            `[WS] Routing to RecentTradesGateway for symbol: ${symbol}`,
          );
          recentTradesGateway.handleConnection(ws, symbol);
        } else if (req.url.includes('/ws/market-data')) {
          console.log(
            `[WS] Routing to MarketDataGateway for symbol: ${symbol}, type: ${type}`,
          );
          marketDataGateway.handleConnection(ws, symbol, type);
        } else if (req.url.includes('/ws')) {
          console.log(
            `[WS] Routing to OrderBookGateway for symbol: ${symbol}, type: ${type}`,
          );
          orderBookGateway.handleConnection(ws, symbol, type);
        }
      });
    }
  });

  await app.listen(process.env.PORT ?? 3000, () => {
    console.log('✅ NestJS API running on :3000');
    console.log('✅ WebSocket server ready on :3000/ws');
    console.log('✅ RecentTrades WebSocket ready on :3000/ws/trades');
    console.log('✅ MarketData WebSocket ready on :3000/ws/market-data');
  });
}
bootstrap();
