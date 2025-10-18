import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * 🔴 Redis Service - Quản lý kết nối Redis
 * Dùng để publish events, cache data, rate limiting
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private redisClient: Redis;

  constructor(private configService: ConfigService) {
    this.redisClient = new Redis({
      host: this.configService.get('REDIS_HOST', '127.0.0.1'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD', undefined),
      lazyConnect: true,
    });

    // 🎯 Event listeners
    this.redisClient.on('connect', () => {
      console.log('✅ Connected to Redis');
    });

    this.redisClient.on('error', (err) => {
      console.error('❌ Redis connection error:', err);
    });
  }

  /**
   * 📡 Publish event to Redis channel
   * @param channel - Tên channel (VD: 'orders', 'trades', 'balances')
   * @param data - Data object sẽ được JSON.stringify
   */
  async publish(channel: string, data: any): Promise<number> {
    try {
      const result = await this.redisClient.publish(
        channel,
        JSON.stringify(data),
      );
      return result;
    } catch (error) {
      console.error(`❌ Failed to publish to ${channel}:`, error);
      throw error;
    }
  }

  /**
   * 💾 Set key-value với expiration
   * @param key - Redis key
   * @param value - Giá trị (sẽ JSON.stringify nếu là object)
   * @param ttlSeconds - Time to live (seconds)
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<string> {
    const serializedValue =
      typeof value === 'string' ? value : JSON.stringify(value);

    if (ttlSeconds) {
      return await this.redisClient.setex(key, ttlSeconds, serializedValue);
    }
    return await this.redisClient.set(key, serializedValue);
  }

  /**
   * 📥 Get value by key
   * @param key - Redis key
   * @param parseJson - Có parse JSON không (default: true)
   */
  async get(key: string, parseJson: boolean = true): Promise<any> {
    const value = await this.redisClient.get(key);
    if (!value) return null;

    return parseJson ? JSON.parse(value) : value;
  }

  /**
   * 🗑️ Delete key
   */
  async del(key: string): Promise<number> {
    return await this.redisClient.del(key);
  }

  /**
   * 🔄 Get Redis client instance (for advanced operations)
   */
  getClient(): Redis {
    return this.redisClient;
  }

  /**
   * 🧹 Clear all order book data for a symbol (for testing/reset)
   * Removes all bids, asks, and order data from Redis
   */
  async clearOrderBook(symbol: string): Promise<number> {
    const client = this.redisClient;
    const keys = [`orderbook:${symbol}:bids`, `orderbook:${symbol}:asks`];

    // Get all price levels
    const bidPrices = await client.zrange(`orderbook:${symbol}:bids`, 0, -1);
    const askPrices = await client.zrange(`orderbook:${symbol}:asks`, 0, -1);

    // Add price-level hashes to delete
    bidPrices.forEach((price) => {
      keys.push(`orderbook:${symbol}:bids:${price}`);
    });
    askPrices.forEach((price) => {
      keys.push(`orderbook:${symbol}:asks:${price}`);
    });

    // Delete all keys
    if (keys.length > 0) {
      return await client.del(...keys);
    }
    return 0;
  }

  /**
   * 🧹 Clear ALL Redis data (DANGEROUS - for testing only)
   * Flushes entire Redis database
   */
  async clearAllData(): Promise<void> {
    console.log('⚠️  FLUSHING ALL REDIS DATA - This cannot be undone!');
    await this.redisClient.flushdb();
    console.log('✅ All Redis data cleared');
  }

  /**
   * 🧹 Cleanup khi module destroy
   */
  async onModuleDestroy() {
    await this.redisClient.disconnect();
    console.log('🔌 Disconnected from Redis');
  }
}
