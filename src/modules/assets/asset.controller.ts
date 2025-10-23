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
import { AssetService } from './asset.service';
import { CreateAssetDto, UpdateAssetDto } from './dto/asset.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { UserRole } from 'src/modules/users/entities/user.entity';

@Controller('assets')
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  // Lấy tất cả assets (public endpoint)
  @Get()
  async getAllAssets() {
    return await this.assetService.getAllAssets();
  }

  // Lấy asset theo code (public endpoint)
  @Get('/:code')
  async getAssetByCode(@Param('code') code: string) {
    return await this.assetService.getAssetByCode(code);
  }

  // ADMIN ENDPOINTS - Cần authentication
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard) // TODO: Add admin role guard
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN) // 👑 Chỉ admin tạo symbols
  async createAsset(@Body() createAssetDto: CreateAssetDto) {
    return await this.assetService.createAsset(createAssetDto);
  }
}
