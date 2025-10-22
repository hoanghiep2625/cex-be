import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import * as cookieParser from 'cookie-parser';

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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
