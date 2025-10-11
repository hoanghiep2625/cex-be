import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AssetService, CreateAssetDto, UpdateAssetDto } from './asset.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('assets')
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  // 💰 Lấy tất cả assets (public endpoint)
  @Get()
  async getAllAssets() {
    return await this.assetService.getAllAssets();
  }

  // 💰 Lấy asset theo code (public endpoint)
  @Get('/:code')
  async getAssetByCode(@Param('code') code: string) {
    return await this.assetService.getAssetByCode(code);
  }

  // 🔒 ADMIN ENDPOINTS - Cần authentication
  @Post()
  @UseGuards(JwtAuthGuard) // TODO: Add admin role guard
  async createAsset(@Body() createAssetDto: CreateAssetDto) {
    return await this.assetService.createAsset(createAssetDto);
  }

  @Put('/:code')
  @UseGuards(JwtAuthGuard) // TODO: Add admin role guard
  async updateAsset(
    @Param('code') code: string,
    @Body() updateAssetDto: UpdateAssetDto,
  ) {
    return await this.assetService.updateAsset(code, updateAssetDto);
  }

  @Delete('/:code')
  @UseGuards(JwtAuthGuard) // TODO: Add admin role guard
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAsset(@Param('code') code: string) {
    await this.assetService.deleteAsset(code);
  }
}
