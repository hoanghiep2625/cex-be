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
      console.log(`📡 Published to ${channel}:`, data);
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
   * 🧹 Cleanup khi module destroy
   */
  async onModuleDestroy() {
    await this.redisClient.disconnect();
    console.log('🔌 Disconnected from Redis');
  }
}
