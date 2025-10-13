import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Symbol } from './entities/symbol.entity';
import { CreateSymbolDto, SymbolFilterDto } from './dto/symbol.dto';

@Injectable()
export class SymbolService {
  constructor(
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
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
      is_spot_trading_allowed: createSymbolDto.is_spot_trading_allowed ?? true,
      is_margin_trading_allowed:
        createSymbolDto.is_margin_trading_allowed ?? false,
    };

    const newSymbol = this.symbolRepository.create(symbolData);
    return await this.symbolRepository.save(newSymbol);
  }
}
