import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Symbol } from './entities/symbol.entity';
import { CreateSymbolDto, SymbolFilterDto } from './dto/symbol.dto';
import { SymbolType } from './enums/symbol-type.enum';
import { MarketDataDto } from './dto/market-data.dto';
import { Trade } from '../trades/entities/trade.entity';
import Decimal from 'decimal.js';

@Injectable()
export class SymbolService {
  constructor(
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
  ) {}

  async getAllSymbols(filters?: SymbolFilterDto): Promise<Symbol[]> {
    const queryBuilder = this.symbolRepository
      .createQueryBuilder('symbol')
      .leftJoinAndSelect('symbol.base_asset_entity', 'base_asset')
      .leftJoinAndSelect('symbol.quote_asset_entity', 'quote_asset');

    if (filters?.base_asset) {
      queryBuilder.andWhere('symbol.base_asset = :base_asset', {
        base_asset: filters.base_asset.toUpperCase(),
      });
    }

    if (filters?.quote_asset) {
      queryBuilder.andWhere('symbol.quote_asset = :quote_asset', {
        quote_asset: filters.quote_asset.toUpperCase(),
      });
    }

    if (filters?.status) {
      queryBuilder.andWhere('symbol.status = :status', {
        status: filters.status,
      });
    }

    if (filters?.type) {
      queryBuilder.andWhere('symbol.type = :type', {
        type: filters.type.toLowerCase(),
      });
    }

    if (filters?.is_spot_trading_allowed !== undefined) {
      queryBuilder.andWhere(
        'symbol.is_spot_trading_allowed = :isSpotTradingAllowed',
        {
          isSpotTradingAllowed: filters.is_spot_trading_allowed,
        },
      );
    }

    if (filters?.is_margin_trading_allowed !== undefined) {
      queryBuilder.andWhere(
        'symbol.is_margin_trading_allowed = :isMarginTradingAllowed',
        {
          isMarginTradingAllowed: filters.is_margin_trading_allowed,
        },
      );
    }

    return await queryBuilder.orderBy('symbol.symbol', 'ASC').getMany();
  }

  async createSymbol(createSymbolDto: CreateSymbolDto): Promise<Symbol> {
    // Check if symbol already exists
    const existingSymbol = await this.symbolRepository.findOne({
      where: { symbol: createSymbolDto.symbol.toUpperCase() },
    });

    if (existingSymbol) {
      throw new ConflictException(
        `Symbol ${createSymbolDto.symbol} already exists`,
      );
    }

    // Tạo symbol object với field names chuẩn
    const symbolData = {
      symbol: createSymbolDto.symbol.toUpperCase(),
      base_asset: createSymbolDto.base_asset.toUpperCase(),
      quote_asset: createSymbolDto.quote_asset.toUpperCase(),
      tick_size: createSymbolDto.tick_size,
      lot_size: createSymbolDto.lot_size,
      min_notional: createSymbolDto.min_notional,
      max_notional: createSymbolDto.max_notional,
      min_qty: createSymbolDto.min_qty,
      max_qty: createSymbolDto.max_qty,
      status: createSymbolDto.status || 'TRADING',
      type: createSymbolDto.type || SymbolType.SPOT,
      is_spot_trading_allowed: createSymbolDto.is_spot_trading_allowed ?? true,
      is_margin_trading_allowed:
        createSymbolDto.is_margin_trading_allowed ?? false,
    };

    const newSymbol = this.symbolRepository.create(symbolData);
    return await this.symbolRepository.save(newSymbol);
  }

  async getSymbolById(id: number): Promise<Symbol> {
    const symbol = await this.symbolRepository
      .createQueryBuilder('symbol')
      .leftJoinAndSelect('symbol.base_asset_entity', 'base_asset')
      .leftJoinAndSelect('symbol.quote_asset_entity', 'quote_asset')
      .where('symbol.id = :id', { id })
      .getOne();

    if (!symbol) {
      throw new NotFoundException(`Symbol with ID ${id} not found`);
    }

    return symbol;
  }

  async getSymbolBySymbolAndType(
    symbolCode: string,
    symbolType: string,
  ): Promise<Symbol> {
    const symbol = await this.symbolRepository
      .createQueryBuilder('symbol')
      .leftJoinAndSelect('symbol.base_asset_entity', 'base_asset')
      .leftJoinAndSelect('symbol.quote_asset_entity', 'quote_asset')
      .where('symbol.symbol = :symbol', { symbol: symbolCode.toUpperCase() })
      .andWhere('symbol.type = :type', { type: symbolType.toLowerCase() })
      .getOne();

    if (!symbol) {
      throw new NotFoundException(
        `Symbol ${symbolCode} with type ${symbolType} not found`,
      );
    }

    return symbol;
  }

  async getMarketData(
    symbolCode: string,
    type: string = 'spot',
  ): Promise<MarketDataDto> {
    // Validate input
    if (!symbolCode) {
      throw new BadRequestException('Symbol code is required');
    }

    const normalizedSymbol = symbolCode.toUpperCase();
    const normalizedType = type.toLowerCase();

    // Get symbol info including asset name
    let symbol: Symbol;
    try {
      symbol = await this.getSymbolBySymbolAndType(
        normalizedSymbol,
        normalizedType,
      );
    } catch (error) {
      // If symbol with specific type not found, try to get any symbol with this code
      const allSymbols = await this.symbolRepository.find({
        where: { symbol: normalizedSymbol },
      });
      if (allSymbols.length === 0) {
        throw new NotFoundException(`Symbol ${normalizedSymbol} not found`);
      }
      symbol = allSymbols[0];
    }

    // Get base asset name for display
    const baseAssetName = symbol.base_asset_entity?.name || symbol.base_asset;

    // Get trades from last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Use query builder for better date filtering
    const tradesLast24h = await this.tradeRepository
      .createQueryBuilder('trade')
      .where('trade.symbol = :symbol', { symbol: normalizedSymbol })
      .andWhere('trade.created_at >= :twentyFourHoursAgo', {
        twentyFourHoursAgo,
      })
      .orderBy('trade.created_at', 'DESC')
      .getMany();

    // If no trades in 24h, get the most recent trade for current price
    let currentPrice = new Decimal(0);
    let priceChange24h = new Decimal(0);
    let priceChangePercent24h = new Decimal(0);
    let highPrice24h = new Decimal(0);
    let lowPrice24h = new Decimal(0);
    let volume24h = new Decimal(0);
    let quoteAssetVolume24h = new Decimal(0);

    if (tradesLast24h.length > 0) {
      // Current price = most recent trade
      const mostRecentTrade = tradesLast24h[0];
      currentPrice = new Decimal(mostRecentTrade.price);

      // Calculate high and low
      let maxPrice = new Decimal(mostRecentTrade.price);
      let minPrice = new Decimal(mostRecentTrade.price);

      // Calculate volume and other stats
      for (const trade of tradesLast24h) {
        const tradePrice = new Decimal(trade.price);
        const tradeQuantity = new Decimal(trade.quantity);
        const tradeQuoteQuantity = new Decimal(trade.quote_quantity);

        // Update high/low
        if (tradePrice.gt(maxPrice)) {
          maxPrice = tradePrice;
        }
        if (tradePrice.lt(minPrice)) {
          minPrice = tradePrice;
        }

        // Add to volumes
        volume24h = volume24h.plus(tradeQuantity);
        quoteAssetVolume24h = quoteAssetVolume24h.plus(tradeQuoteQuantity);
      }

      highPrice24h = maxPrice;
      lowPrice24h = minPrice;

      // Get first trade price (24h ago or earliest)
      const oldestTrade = tradesLast24h[tradesLast24h.length - 1];
      const openPrice = new Decimal(oldestTrade.price);

      // Calculate price change
      priceChange24h = currentPrice.minus(openPrice);
      if (!openPrice.isZero()) {
        priceChangePercent24h = priceChange24h.dividedBy(openPrice).times(100);
      }
    } else {
      // No trades in last 24h, try to get most recent trade ever
      const lastTrade = await this.tradeRepository
        .createQueryBuilder('trade')
        .where('trade.symbol = :symbol', { symbol: normalizedSymbol })
        .orderBy('trade.created_at', 'DESC')
        .take(1)
        .getOne();

      if (lastTrade) {
        currentPrice = new Decimal(lastTrade.price);
        highPrice24h = currentPrice;
        lowPrice24h = currentPrice;
      }
    }

    return {
      symbol: normalizedSymbol,
      price: parseFloat(currentPrice.toFixed(8)),
      priceChange24h: parseFloat(priceChange24h.toFixed(8)),
      priceChangePercent24h: parseFloat(priceChangePercent24h.toFixed(2)),
      highPrice24h: parseFloat(highPrice24h.toFixed(8)),
      lowPrice24h: parseFloat(lowPrice24h.toFixed(8)),
      volume24h: parseFloat(volume24h.toFixed(8)),
      quoteAssetVolume24h: parseFloat(quoteAssetVolume24h.toFixed(2)),
      name: baseAssetName,
    };
  }
}
