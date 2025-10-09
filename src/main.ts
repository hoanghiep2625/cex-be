import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
