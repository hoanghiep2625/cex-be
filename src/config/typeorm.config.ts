import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

/**
 * Common TypeORM configuration
 * Dùng chung cho cả NestJS app và TypeORM CLI
 */
export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: +(process.env.DB_PORT || 5432),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'root',
  database: process.env.DB_NAME || 'cex',
  entities: ['dist/**/*.entity{.ts,.js}'],
  migrations: ['dist/migrations/*{.ts,.js}'],
  synchronize: process.env.TYPEORM_SYNC === 'false', // Chỉ dùng trong dev, tránh dùng trong production
  logging: true,
};

/**
 * DataSource cho TypeORM CLI
 */
export const AppDataSource = new DataSource({
  ...typeOrmConfig,
  entities: ['src/**/*.entity{.ts,.js}'], // CLI dùng src/, app dùng dist/
  migrations: ['src/migrations/*{.ts,.js}'],
} as any);
