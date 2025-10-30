import { Controller, Post, Param, HttpCode, Delete } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * 🔴 Redis Controller - API để quản lý Redis data
 * Dùng cho testing, development, cleanup
 */
@Controller('api/redis')
export class RedisController {
  constructor(private readonly redisService: RedisService) {}

  /**
   * 🧹 Clear order book data cho một symbol
   * DELETE /api/redis/orderbook/:symbol
   */
  @Delete('orderbook/:symbol')
  @HttpCode(200)
  async clearOrderBook(@Param('symbol') symbol: string) {
    console.log(`🧹 Clearing order book for ${symbol}...`);
    const deletedKeys = await this.redisService.clearOrderBook(symbol);
    return {
      message: `Order book cleared for ${symbol}`,
      deletedKeys,
      timestamp: new Date(),
    };
  }

  /**
   * 🧹 Clear ALL Redis data (DANGEROUS!)
   * DELETE /api/redis/clear-all
   * WARNING: This will delete EVERYTHING in Redis
   */
  @Delete('clear-all')
  @HttpCode(200)
  async clearAllData() {
    console.log('⚠️  CLEARING ALL REDIS DATA');
    await this.redisService.clearAllData();
    return {
      message: '⚠️  All Redis data cleared - this cannot be undone',
      timestamp: new Date(),
      warning: 'Use with caution! All cached data has been deleted.',
    };
  }

  /**
   * 🧹 Clear all order books (for all symbols)
   * DELETE /api/redis/orderbooks
   */
  @Delete('orderbooks')
  @HttpCode(200)
  async clearAllOrderBooks() {
    console.log('🧹 Clearing all order books...');
    // Clear all orderbook:* keys
    const client = this.redisService['redisClient'];
    const keys = await client.keys('orderbook:*');
    let deletedCount = 0;

    if (keys.length > 0) {
      deletedCount = await client.del(...keys);
    }

    return {
      message: 'All order books cleared',
      deletedKeys: deletedCount,
      timestamp: new Date(),
    };
  }

  /**
   * ℹ️ Get Redis info
   * GET /api/redis/info
   */
  @Post('info')
  @HttpCode(200)
  async getInfo() {
    const client = this.redisService.getClient();
    const info = await client.info();
    const dbSize = await client.dbsize();
    const keys = await client.keys('*');

    return {
      dbSize,
      totalKeys: keys.length,
      orderbooks: keys.filter((k) => k.startsWith('orderbook:')).length,
      info: info.split('\n').slice(0, 5), // First few lines
      timestamp: new Date(),
    };
  }
}
