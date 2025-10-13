import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto, OrderQueryDto } from './dto/order.dto';
import { Order, OrderStatus } from './entities/order.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * 📝 Create new order
   *
   * POST /orders
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @Request() req: any,
    @Body(ValidationPipe) createOrderDto: CreateOrderDto,
  ): Promise<Order> {
    return this.orderService.createOrder(req.user.id, createOrderDto);
  }

  /**
   * 📋 Get user's orders with filters
   *
   * GET /orders?status=NEW,FILLED&symbol=BTCUSDT&limit=20&offset=0
   */
  @Get()
  async getUserOrders(
    @Request() req: any,
    @Query() query: OrderQueryDto,
  ): Promise<{ orders: Order[]; total: number; page_info: any }> {
    const filters = {
      status: query.status
        ? (query.status.split(',') as OrderStatus[])
        : undefined,
      symbol: query.symbol,
      side: query.side,
      type: query.type,
      limit: Math.min(query.limit || 50, 100), // Max 100 per page
      offset: query.offset || 0,
    };

    const result = await this.orderService.getUserOrders(req.user.id, filters);

    return {
      ...result,
      page_info: {
        current_page:
          Math.floor((filters.offset || 0) / (filters.limit || 50)) + 1,
        per_page: filters.limit || 50,
        has_next: result.orders.length === (filters.limit || 50),
      },
    };
  }

  /**
   * 🔍 Get specific order by ID
   *
   * GET /orders/:id
   */
  @Get(':id')
  async getOrderById(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) orderId: string,
  ): Promise<Order> {
    return this.orderService.getUserOrderById(req.user.id, orderId);
  }

  /**
   * ❌ Cancel order
   *
   * PUT /orders/:id/cancel
   */
  @Put(':id/cancel')
  async cancelOrder(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) orderId: string,
  ): Promise<Order> {
    return this.orderService.cancelOrder(req.user.id, orderId);
  }

  /**
   * 📊 Get order history (completed orders)
   *
   * GET /orders/history/all?symbol=BTCUSDT&limit=20
   */
  @Get('history/all')
  async getOrderHistory(
    @Request() req: any,
    @Query() query: Omit<OrderQueryDto, 'status' | 'type'>,
  ): Promise<{ orders: Order[]; total: number; page_info: any }> {
    const filters = {
      symbol: query.symbol,
      side: query.side,
      limit: Math.min(query.limit || 50, 100),
      offset: query.offset || 0,
    };

    const result = await this.orderService.getUserOrderHistory(
      req.user.id,
      filters,
    );

    return {
      ...result,
      page_info: {
        current_page:
          Math.floor((filters.offset || 0) / (filters.limit || 50)) + 1,
        per_page: filters.limit || 50,
        has_next: result.orders.length === (filters.limit || 50),
      },
    };
  }

  /**
   * 🔄 Get active orders (NEW + PARTIALLY_FILLED)
   *
   * GET /orders/active/all?symbol=BTCUSDT
   */
  @Get('active/all')
  async getActiveOrders(
    @Request() req: any,
    @Query() query: Omit<OrderQueryDto, 'status' | 'type'>,
  ): Promise<{ orders: Order[]; total: number; page_info: any }> {
    const filters = {
      symbol: query.symbol,
      side: query.side,
      limit: Math.min(query.limit || 50, 100),
      offset: query.offset || 0,
    };

    const result = await this.orderService.getUserActiveOrders(
      req.user.id,
      filters,
    );

    return {
      ...result,
      page_info: {
        current_page:
          Math.floor((filters.offset || 0) / (filters.limit || 50)) + 1,
        per_page: filters.limit || 50,
        has_next: result.orders.length === (filters.limit || 50),
      },
    };
  }
}
