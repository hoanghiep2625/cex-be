import {
  Controller,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/order.dto';
import { Order } from './entities/order.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @Request() req: any,
    @Body(ValidationPipe) createOrderDto: CreateOrderDto,
  ): Promise<Order> {
    return this.orderService.createOrder(req.user.id, createOrderDto);
  }

  /**
   *  Sync database orders to Redis order book
   * POST /orders/sync-to-redis
   */
  @Post('sync-to-redis')
  @HttpCode(HttpStatus.OK)
  @UseGuards() // Remove JWT guard for this endpoint
  async syncOrdersToRedis() {
    const result = await this.orderService.syncOrdersToRedis();

    return {
      success: true,
      message: 'Database orders synced to Redis order book',
      result,
    };
  }

  @Put(':id/cancel')
  async cancelOrder(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) orderId: string,
  ): Promise<Order> {
    return this.orderService.cancelOrder(req.user.id, orderId);
  }
}
