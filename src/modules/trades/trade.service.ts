import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trade, OrderSide, LiquidityFlag } from './entities/trade.entity';
import { CreateTradeDto } from './dto/trade.dto';
import Decimal from 'decimal.js';

@Injectable()
export class TradeService {
  constructor(
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
  ) {}

  async createTrade(createTradeDto: CreateTradeDto): Promise<Trade> {
    if (
      !createTradeDto.symbol ||
      !createTradeDto.maker_order_id ||
      !createTradeDto.taker_order_id
    ) {
      throw new BadRequestException('Missing required trade fields');
    }

    // Validate price and quantity are positive
    const price = new Decimal(createTradeDto.price);
    const quantity = new Decimal(createTradeDto.quantity);
    const quoteQuantity = new Decimal(createTradeDto.quote_quantity);

    if (price.lte(0) || quantity.lte(0) || quoteQuantity.lte(0)) {
      throw new BadRequestException(
        'Price, quantity and quote_quantity must be positive',
      );
    }

    // Validate taker_side
    const takerSide = createTradeDto.taker_side.toUpperCase();
    if (!['BUY', 'SELL'].includes(takerSide)) {
      throw new BadRequestException('Invalid taker_side (BUY | SELL)');
    }

    // Calculate maker_side (opposite of taker_side)
    const makerSide = takerSide === 'BUY' ? 'SELL' : 'BUY';

    // Verify quote_quantity ≈ price * quantity
    const expectedQuoteQuantity = price.times(quantity);
    const difference = expectedQuoteQuantity
      .minus(quoteQuantity)
      .abs()
      .dividedBy(expectedQuoteQuantity);
    if (difference.gt(0.0001)) {
      // Allow 0.01% difference for rounding
      throw new BadRequestException(
        'quote_quantity does not match price * quantity',
      );
    }

    // Create trade with liquidity flag = TAKER (always for this record)
    const trade = this.tradeRepository.create({
      symbol: createTradeDto.symbol,
      maker_order_id: createTradeDto.maker_order_id,
      taker_order_id: createTradeDto.taker_order_id,
      maker_user_id: createTradeDto.maker_user_id,
      taker_user_id: createTradeDto.taker_user_id,
      taker_side: takerSide as OrderSide,
      liquidity: LiquidityFlag.TAKER, // This record is always from taker's perspective
      price: price.toString(),
      quantity: quantity.toString(),
      quote_quantity: quoteQuantity.toString(),
      maker_fee: createTradeDto.maker_fee || '0',
      maker_fee_asset: createTradeDto.maker_fee_asset,
      taker_fee: createTradeDto.taker_fee || '0',
      taker_fee_asset: createTradeDto.taker_fee_asset,
    });

    const savedTrade = await this.tradeRepository.save(trade);
    console.log(
      `✅ Trade created: ${savedTrade.id} (${createTradeDto.symbol} @ ${createTradeDto.price} qty: ${createTradeDto.quantity})`,
    );

    return savedTrade;
  }

  /**
   * Get recent trades for a symbol
   * @param symbol - Trading pair (BTCUSDT)
   * @param limit - Number of recent trades to fetch (default: 50)
   * @returns Array of recent trades sorted by most recent first
   */
  async getRecentTrades(symbol: string, limit: number = 50): Promise<Trade[]> {
    return await this.tradeRepository.find({
      where: { symbol },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }
}
