import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import * as cookieParser from 'cookie-parser';
import { OrderBookGateway } from './modules/redis/orderbook.gateway';

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

  server.on('upgrade', (req: any, socket: any, head: any) => {
    if (req.url.startsWith('/ws')) {
      const { WebSocketServer } = require('ws');
      const wss = new WebSocketServer({ noServer: true });

      wss.handleUpgrade(req, socket, head, (ws: any) => {
        // Extract symbol from query or default to BTCUSDT
        const url = new URL(req.url, `http://${req.headers.host}`);
        const symbol = url.searchParams.get('symbol') || 'BTCUSDT';
        orderBookGateway.handleConnection(ws, symbol);
      });
    }
  });

  await app.listen(process.env.PORT ?? 3000, () => {
    console.log('✅ NestJS API running on :3000');
    console.log('✅ WebSocket server ready on :3000/ws');
  });
}
bootstrap();
