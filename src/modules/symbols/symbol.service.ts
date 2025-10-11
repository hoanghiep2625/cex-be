import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Symbol } from './entities/symbol.entity';
import {
  CreateSymbolDto,
  UpdateSymbolDto,
  SymbolFilterDto,
} from './dto/symbol.dto';

@Injectable()
export class SymbolService {
  constructor(
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
  ) {}

  // 📈 Lấy tất cả symbols với filter
  async getAllSymbols(filters?: SymbolFilterDto): Promise<Symbol[]> {
    const queryBuilder = this.symbolRepository
      .createQueryBuilder('symbol')
      .leftJoinAndSelect('symbol.baseAssetEntity', 'baseAsset')
      .leftJoinAndSelect('symbol.quoteAssetEntity', 'quoteAsset');

    if (filters?.baseAsset) {
      queryBuilder.andWhere('symbol.baseAsset = :baseAsset', {
        baseAsset: filters.baseAsset.toUpperCase(),
      });
    }

    if (filters?.quoteAsset) {
      queryBuilder.andWhere('symbol.quoteAsset = :quoteAsset', {
        quoteAsset: filters.quoteAsset.toUpperCase(),
      });
    }

    if (filters?.status) {
      queryBuilder.andWhere('symbol.status = :status', {
        status: filters.status,
      });
    }

    if (filters?.isSpotTradingAllowed !== undefined) {
      queryBuilder.andWhere(
        'symbol.isSpotTradingAllowed = :isSpotTradingAllowed',
        {
          isSpotTradingAllowed: filters.isSpotTradingAllowed,
        },
      );
    }

    if (filters?.isMarginTradingAllowed !== undefined) {
      queryBuilder.andWhere(
        'symbol.isMarginTradingAllowed = :isMarginTradingAllowed',
        {
          isMarginTradingAllowed: filters.isMarginTradingAllowed,
        },
      );
    }

    return await queryBuilder.orderBy('symbol.symbol', 'ASC').getMany();
  }

  // 📈 Lấy symbol theo tên
  async getSymbolBySymbol(symbol: string): Promise<Symbol> {
    const symbolEntity = await this.symbolRepository.findOne({
      where: { symbol: symbol.toUpperCase() },
      relations: ['baseAssetEntity', 'quoteAssetEntity'],
    });

    if (!symbolEntity) {
      throw new NotFoundException(`Symbol ${symbol} not found`);
    }

    return symbolEntity;
  }

  // 📈 Lấy symbols theo base asset
  async getSymbolsByBaseAsset(baseAsset: string): Promise<Symbol[]> {
    return await this.symbolRepository.find({
      where: { baseAsset: baseAsset.toUpperCase() },
      relations: ['baseAssetEntity', 'quoteAssetEntity'],
      order: { symbol: 'ASC' },
    });
  }

  // 📈 Lấy symbols theo quote asset
  async getSymbolsByQuoteAsset(quoteAsset: string): Promise<Symbol[]> {
    return await this.symbolRepository.find({
      where: { quoteAsset: quoteAsset.toUpperCase() },
      relations: ['baseAssetEntity', 'quoteAssetEntity'],
      order: { symbol: 'ASC' },
    });
  }

  // 📈 Lấy symbols theo status
  async getSymbolsByStatus(status: string): Promise<Symbol[]> {
    return await this.symbolRepository.find({
      where: { status: status.toUpperCase() },
      relations: ['baseAssetEntity', 'quoteAssetEntity'],
      order: { symbol: 'ASC' },
    });
  }

  // 📈 Tạo symbol mới
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
      baseAsset: createSymbolDto.baseAsset.toUpperCase(),
      quoteAsset: createSymbolDto.quoteAsset.toUpperCase(),
      tickSize: createSymbolDto.tickSize,
      lotSize: createSymbolDto.lotSize,
      minNotional: createSymbolDto.minNotional,
      maxNotional: createSymbolDto.maxNotional,
      minQty: createSymbolDto.minQty,
      maxQty: createSymbolDto.maxQty,
      status: createSymbolDto.status || 'TRADING',
      isSpotTradingAllowed: createSymbolDto.isSpotTradingAllowed ?? true,
      isMarginTradingAllowed: createSymbolDto.isMarginTradingAllowed ?? false,
    };

    const newSymbol = this.symbolRepository.create(symbolData);
    return await this.symbolRepository.save(newSymbol);
  }

  // 📈 Update symbol
  async updateSymbol(
    symbol: string,
    updateSymbolDto: UpdateSymbolDto,
  ): Promise<Symbol> {
    const symbolEntity = await this.getSymbolBySymbol(symbol);

    Object.assign(symbolEntity, updateSymbolDto);
    return await this.symbolRepository.save(symbolEntity);
  }

  // 📈 Xóa symbol
  async deleteSymbol(symbol: string): Promise<void> {
    const symbolEntity = await this.getSymbolBySymbol(symbol);
    await this.symbolRepository.remove(symbolEntity);
  }

  // 📈 Lấy symbols đang trading
  async getTradingSymbols(): Promise<Symbol[]> {
    return await this.symbolRepository.find({
      where: {
        status: 'TRADING',
        isSpotTradingAllowed: true,
      },
      relations: ['baseAssetEntity', 'quoteAssetEntity'],
      order: { symbol: 'ASC' },
    });
  }

  // 📈 Toggle symbol status
  async toggleSymbolStatus(symbol: string): Promise<Symbol> {
    const symbolEntity = await this.getSymbolBySymbol(symbol);

    symbolEntity.status =
      symbolEntity.status === 'TRADING' ? 'DISABLED' : 'TRADING';
    return await this.symbolRepository.save(symbolEntity);
  }
}
