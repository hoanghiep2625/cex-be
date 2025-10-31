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
      db: this.configService.get('REDIS_DB', 1),
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
   * 📤 Add message to Redis Stream
   * @param stream - Stream name (e.g., 'trades:candle')
   * @param data - Data object
   * @returns Message ID
   */
  async addToStream(stream: string, data: any): Promise<string> {
    try {
      const fields: string[] = [];
      Object.entries(data).forEach(([key, value]) => {
        fields.push(
          key,
          typeof value === 'string' ? value : JSON.stringify(value),
        );
      });

      const messageId = await this.redisClient.xadd(stream, '*', ...fields);
      return messageId;
    } catch (error) {
      console.error(`❌ Failed to add to stream ${stream}:`, error);
      throw error;
    }
  }

  /**
   * 📥 Read from Redis Stream
   * @param stream - Stream name
   * @param lastId - Last message ID (use '0' for all, '$' for new only)
   * @param count - Max number of messages
   * @returns Array of messages
   */
  async readFromStream(
    stream: string,
    lastId: string = '0',
    count: number = 100,
  ): Promise<any[]> {
    try {
      const result = await this.redisClient.xread(
        'COUNT',
        count,
        'STREAMS',
        stream,
        lastId,
      );

      if (!result || result.length === 0) {
        return [];
      }

      const messages: any[] = [];
      for (const [, streamMessages] of result) {
        for (const [messageId, fields] of streamMessages) {
          const data: any = { _id: messageId };
          for (let i = 0; i < fields.length; i += 2) {
            const key = fields[i];
            let value = fields[i + 1];

            // Try to parse JSON
            try {
              value = JSON.parse(value);
            } catch {
              // Keep as string if not JSON
            }

            data[key] = value;
          }
          messages.push(data);
        }
      }

      return messages;
    } catch (error) {
      console.error(`❌ Failed to read from stream ${stream}:`, error);
      throw error;
    }
  }

  /**
   * 🧹 Cleanup khi module destroy
   */
  async onModuleDestroy() {
    await this.redisClient.disconnect();
    console.log('🔌 Disconnected from Redis');
  }
}
