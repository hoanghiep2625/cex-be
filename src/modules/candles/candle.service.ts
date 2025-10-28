import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from 'src/modules/redis/redis.service';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  LessThan,
  DataSource,
  MoreThanOrEqual,
  LessThanOrEqual,
  Between,
} from 'typeorm';
import { Candle, CandleTimeframe } from './entities/candle.entity';
import { Symbol } from '../symbols/entities/symbol.entity';
import { QueryCandlesDto } from './dto/candle.dto';
import { SymbolType } from '../symbols/enums/symbol-type.enum';
import Decimal from 'decimal.js';

@Injectable()
export class CandleService implements OnModuleInit {
  private lastStreamId = '$'; // Start from latest messages
  private isProcessing = false;

  constructor(
    private readonly redisService: RedisService,
    @InjectRepository(Candle)
    private readonly candleRepo: Repository<Candle>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    // Kết nối Redis
    const client = this.redisService.getClient();
    await client.connect();

    // Bắt đầu consumer loop
    this.startStreamConsumer();

    console.log('✅ Started Redis Stream consumer for trades:candle');
  }

  private async startStreamConsumer() {
    // Poll messages from stream every 100ms
    setInterval(async () => {
      if (this.isProcessing) return;

      try {
        this.isProcessing = true;
        await this.processStreamMessages();
      } catch (err) {
        console.error('❌ Error in stream consumer:', err);
      } finally {
        this.isProcessing = false;
      }
    }, 100);
  }

  private async processStreamMessages() {
    try {
      const client = this.redisService.getClient();

      // XREAD BLOCK 1000 STREAMS trades:candle lastId
      const result = await client.xread(
        'BLOCK',
        1000,
        'STREAMS',
        'trades:candle',
        this.lastStreamId,
      );

      if (!result || result.length === 0) {
        return;
      }

      for (const [, messages] of result) {
        for (const [messageId, fields] of messages) {
          try {
            // Parse message fields
            const data: any = {};
            for (let i = 0; i < fields.length; i += 2) {
              const key = fields[i];
              let value: any = fields[i + 1];

              // Parse JSON if needed
              try {
                value = JSON.parse(value);
              } catch {
                // Keep as string
              }

              data[key] = value;
            }

            console.log(`📥 Stream message ${messageId}:`, data);
            await this.processTradeForCandles(data);

            // Update last processed ID
            this.lastStreamId = messageId;
          } catch (err) {
            console.error(`❌ Error processing message ${messageId}:`, err);
          }
        }
      }
    } catch (err) {
      if (err.message && err.message.includes('WRONGTYPE')) {
        console.error('❌ Stream key exists but is not a stream. Resetting...');
        this.lastStreamId = '$';
      }
    }
  }

  private async processTradeForCandles(data: any) {
    try {
      // Định nghĩa các timeframe và milliseconds tương ứng
      const timeframes: { name: CandleTimeframe; ms: number }[] = [
        { name: '1m', ms: 60000 }, // 1 phút
        { name: '5m', ms: 300000 }, // 5 phút
        { name: '15m', ms: 900000 }, // 15 phút
        { name: '30m', ms: 1800000 }, // 30 phút
        { name: '1h', ms: 3600000 }, // 1 giờ
        { name: '4h', ms: 14400000 }, // 4 giờ
        { name: '1d', ms: 86400000 }, // 1 ngày
        { name: '1w', ms: 604800000 }, // 1 tuần
      ];

      const price = new Decimal(data.price);
      const tsMs = parseInt(data.tsMs);
      const symbolId = parseInt(data.symbol_id);
      const isTakerBuy = data.isTakerBuy === 'true' || data.isTakerBuy === true;

      // Lưu candle cho từng timeframe
      for (const tf of timeframes) {
        const openMs = Math.floor(tsMs / tf.ms) * tf.ms;
        const openTime = new Date(openMs);
        const closeTime = new Date(openMs + tf.ms);

        let candle = await this.candleRepo.findOne({
          where: {
            symbol_id: symbolId,
            timeframe: tf.name,
            open_time: openTime,
          },
        });

        if (!candle) {
          candle = this.candleRepo.create({
            symbol_id: symbolId,
            symbol: data.symbol,
            type: data.type,
            timeframe: tf.name,
            open_time: openTime,
            close_time: closeTime,
            open: price.toString(),
            high: price.toString(),
            low: price.toString(),
            close: price.toString(),
            volume: new Decimal(data.baseQty).toString(),
            quote_volume: new Decimal(data.quoteQty).toString(),
            number_of_trades: 1,
            taker_buy_base_volume: isTakerBuy
              ? new Decimal(data.baseQty).toString()
              : '0',
            taker_buy_quote_volume: isTakerBuy
              ? new Decimal(data.quoteQty).toString()
              : '0',
            is_closed: false,
          });
        } else {
          candle.high = Decimal.max(new Decimal(candle.high), price).toString();
          candle.low = Decimal.min(new Decimal(candle.low), price).toString();
          candle.close = price.toString();
          candle.volume = new Decimal(candle.volume)
            .plus(new Decimal(data.baseQty))
            .toString();
          candle.quote_volume = new Decimal(candle.quote_volume)
            .plus(new Decimal(data.quoteQty))
            .toString();
          candle.number_of_trades += 1;
          if (isTakerBuy) {
            candle.taker_buy_base_volume = new Decimal(
              candle.taker_buy_base_volume,
            )
              .plus(new Decimal(data.baseQty))
              .toString();
            candle.taker_buy_quote_volume = new Decimal(
              candle.taker_buy_quote_volume,
            )
              .plus(new Decimal(data.quoteQty))
              .toString();
          }
        }

        await this.candleRepo.save(candle);
      }

      console.log('✅ Candles saved for all timeframes');
    } catch (err) {
      console.error('❌ Error saving candle:', err);
      console.error('❌ Error stack:', err.stack);
    }
  }

  /**
   * 📊 Get candles theo symbol, type, interval
   * @param query - Query params
   * @returns Array of candles
   */
  async getCandles(query: QueryCandlesDto): Promise<any[]> {
    const {
      symbol,
      type = SymbolType.SPOT,
      interval,
      limit = 500,
      startTime,
      endTime,
    } = query;

    // Build where clause
    const where: any = {
      symbol,
      type,
      timeframe: interval,
    };

    // Add time filters if provided
    if (startTime && endTime) {
      where.open_time = Between(new Date(startTime), new Date(endTime));
    } else if (startTime) {
      where.open_time = MoreThanOrEqual(new Date(startTime));
    } else if (endTime) {
      where.open_time = LessThanOrEqual(new Date(endTime));
    }

    // Query candles
    const candles = await this.candleRepo.find({
      where,
      order: { open_time: 'ASC' },
      take: limit,
    });

    // Transform to response format (convert Date to epoch ms)
    return candles.map((candle) => ({
      symbol: candle.symbol,
      type: candle.type,
      interval: candle.timeframe,
      open_time: candle.open_time.getTime(),
      close_time: candle.close_time.getTime(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      quote_volume: candle.quote_volume,
      number_of_trades: candle.number_of_trades,
      taker_buy_base_volume: candle.taker_buy_base_volume,
      taker_buy_quote_volume: candle.taker_buy_quote_volume,
      is_closed: candle.is_closed,
    }));
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'close-expired-candles',
  })
  async closeExpiredCandles() {
    try {
      const now = new Date();
      const result = await this.candleRepo.update(
        {
          close_time: LessThan(now),
          is_closed: false,
        },
        {
          is_closed: true,
        },
      );

      if (result.affected > 0) {
        console.log(`🕒 Closed ${result.affected} expired candles`);
      }
    } catch (err) {
      console.error('❌ Error closing expired candles:', err);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'create-empty-candles',
  })
  async createEmptyCandles() {
    try {
      const now = Date.now();
      const currentMinute = Math.floor(now / 60000) * 60000;

      // Định nghĩa timeframes cần tạo ở thời điểm hiện tại
      const timeframes: { name: CandleTimeframe; ms: number }[] = [];

      // 1m - mỗi phút
      timeframes.push({ name: '1m', ms: 60000 });

      // 5m - mỗi 5 phút
      if (currentMinute % 300000 === 0) {
        timeframes.push({ name: '5m', ms: 300000 });
      }

      // 15m - mỗi 15 phút
      if (currentMinute % 900000 === 0) {
        timeframes.push({ name: '15m', ms: 900000 });
      }

      // 30m - mỗi 30 phút
      if (currentMinute % 1800000 === 0) {
        timeframes.push({ name: '30m', ms: 1800000 });
      }

      // 1h - mỗi giờ
      if (currentMinute % 3600000 === 0) {
        timeframes.push({ name: '1h', ms: 3600000 });
      }

      // 4h - mỗi 4 giờ
      if (currentMinute % 14400000 === 0) {
        timeframes.push({ name: '4h', ms: 14400000 });
      }

      // 1d - mỗi ngày (00:00)
      if (currentMinute % 86400000 === 0) {
        timeframes.push({ name: '1d', ms: 86400000 });
      }

      // 1w - mỗi tuần (thứ 2, 00:00)
      const currentDate = new Date(currentMinute);
      if (
        currentDate.getDay() === 1 &&
        currentDate.getHours() === 0 &&
        currentDate.getMinutes() === 0
      ) {
        timeframes.push({ name: '1w', ms: 604800000 });
      }

      if (timeframes.length === 0) return;

      // Lấy tất cả symbols
      const symbolRepo = this.dataSource.getRepository(Symbol);
      const symbols = await symbolRepo.find({
        where: { status: 'TRADING' },
      });

      let createdCount = 0;

      for (const symbol of symbols) {
        for (const tf of timeframes) {
          // Tính open_time của nến hiện tại dựa trên currentMinute (đã round)
          const openMs = Math.floor(currentMinute / tf.ms) * tf.ms;
          const openTime = new Date(openMs);
          const closeTime = new Date(openMs + tf.ms);

          // Check xem nến đã tồn tại chưa
          const existingCandle = await this.candleRepo.findOne({
            where: {
              symbol_id: symbol.id,
              timeframe: tf.name,
              open_time: openTime,
            },
          });

          if (!existingCandle) {
            // Lấy giá đóng cửa của nến trước đó
            const previousOpenTime = new Date(openMs - tf.ms);
            const previousCandle = await this.candleRepo.findOne({
              where: {
                symbol_id: symbol.id,
                timeframe: tf.name,
                open_time: previousOpenTime,
              },
            });

            const price = previousCandle ? previousCandle.close : '0'; // Nếu không có nến trước, dùng giá 0 (hoặc có thể skip)

            if (price !== '0') {
              // Chỉ tạo nến nếu có giá từ nến trước
              const newCandle = this.candleRepo.create({
                symbol_id: symbol.id,
                symbol: symbol.symbol,
                type: symbol.type,
                timeframe: tf.name,
                open_time: openTime,
                close_time: closeTime,
                open: price,
                high: price,
                low: price,
                close: price,
                volume: '0',
                quote_volume: '0',
                number_of_trades: 0,
                taker_buy_base_volume: '0',
                taker_buy_quote_volume: '0',
                is_closed: false,
              });

              await this.candleRepo.save(newCandle);
              createdCount++;
            }
          }
        }
      }

      if (createdCount > 0) {
        console.log(
          `🕯️  Created ${createdCount} empty candles for ${timeframes.map((tf) => tf.name).join(', ')}`,
        );
      }
    } catch (err) {
      console.error('❌ Error creating empty candles:', err);
    }
  }
}
