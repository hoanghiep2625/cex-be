import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from './entities/asset.entity';
import { CreateAssetDto, UpdateAssetDto } from './dto/asset.dto';

@Injectable()
export class AssetService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
  ) {}

  // 💰 Lấy tất cả assets
  async getAllAssets(): Promise<Asset[]> {
    return await this.assetRepository.find({
      order: { code: 'ASC' },
    });
  }

  // 💰 Lấy asset theo code
  async getAssetByCode(code: string): Promise<Asset> {
    const asset = await this.assetRepository.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!asset) {
      throw new NotFoundException(`Asset ${code} not found`);
    }

    return asset;
  }

  // 💰 Tạo asset mới
  async createAsset(createAssetDto: CreateAssetDto): Promise<Asset> {
    // Check if asset already exists
    const existingAsset = await this.assetRepository.findOne({
      where: { code: createAssetDto.code.toUpperCase() },
    });

    if (existingAsset) {
      throw new ConflictException(
        `Asset ${createAssetDto.code} already exists`,
      );
    }

    const asset = this.assetRepository.create({
      code: createAssetDto.code.toUpperCase(),
      name: createAssetDto.name,
      precision: createAssetDto.precision || 8,
    });

    return await this.assetRepository.save(asset);
  }
}
