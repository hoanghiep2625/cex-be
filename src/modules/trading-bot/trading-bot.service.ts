import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import axios from 'axios';
import { Symbol } from '../symbols/entities/symbol.entity';
import {
  Order,
  OrderSide,
  OrderType,
  OrderStatus,
} from '../orders/entities/order.entity';
import { OrderService } from '../orders/order.service';
import { SymbolType } from '../symbols/enums/symbol-type.enum';
import { WalletType } from '../balances/entities/balance.entity';

interface BinanceTickerPrice {
  symbol: string;
  price: string;
}

export interface BotConfig {
  enabled: boolean;
  botBuyUserId: number; // User ID của bot BUY (maker)
  botSellUserId: number; // User ID của bot SELL (maker)
  botTraderUserId: number; // User ID của bot Trader (taker)
  spread: number; // % spread (e.g., 0.001 = 0.1%)
  orderSize: number; // Số lượng mỗi lệnh (quote currency)
  updateInterval: number; // ms - thời gian update giá
  tradeInterval: number; // ms - thời gian bot trader đặt lệnh
  priceSource: 'binance'; // Nguồn giá
}

@Injectable()
export class TradingBotService implements OnModuleInit {
  private readonly logger = new Logger(TradingBotService.name);
  private config: BotConfig = {
    enabled: true,
    botBuyUserId: 1, // Bot user cho lệnh BUY (maker)
    botSellUserId: 2, // Bot user cho lệnh SELL (maker)
    botTraderUserId: 3, // Bot user tạo trades (taker)
    spread: 0.001, // 0.1% spread
    orderSize: 100, // 100 USDT mỗi lệnh maker
    updateInterval: 5000, // Update giá mỗi 5s
    tradeInterval: 10000, // Trader bot đặt lệnh mỗi 10s
    priceSource: 'binance',
  };

  private lastPrices: Map<string, number> = new Map(); // Track giá trước đó

  private activeOrders: Map<
    string,
    { buyOrderId: string; sellOrderId: string }
  > = new Map();
  private isRunning = false;

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
    private orderService: OrderService,
  ) {}

  async onModuleInit() {
    if (this.config.enabled) {
      this.logger.log('🤖 Trading Bot starting...');
      await this.start();
    }
  }

  async start() {
    if (this.isRunning) {
      this.logger.warn('Bot is already running');
      return;
    }

    this.isRunning = true;
    this.logger.log('🤖 Trading Bot started');
    this.runBot();
    this.runTraderBot();
  }

  async stop() {
    this.isRunning = false;
    this.logger.log('🛑 Trading Bot stopped');
    await this.cancelAllBotOrders();
  }

  private async runBot() {
    while (this.isRunning) {
      try {
        await this.updateMarketMaking();
      } catch (err) {
        this.logger.error(`❌ Bot error: ${err.message}`, err.stack);
      }

      await this.sleep(this.config.updateInterval);
    }
  }

  private async updateMarketMaking() {
    // Lấy danh sách symbols đang TRADING
    const symbolRepo = this.dataSource.getRepository(Symbol);
    const symbols = await symbolRepo.find({
      where: { status: 'TRADING', type: SymbolType.SPOT },
    });

    for (const symbol of symbols) {
      try {
        await this.updateSymbolOrders(symbol);
      } catch (err) {
        this.logger.error(`❌ Error updating ${symbol.symbol}: ${err.message}`);
      }
    }
  }

  private async updateSymbolOrders(symbol: Symbol) {
    // Fetch giá từ Binance
    const binanceSymbol = symbol.symbol; // BTCUSDT, ETHUSDT, etc.
    const marketPrice = await this.fetchBinancePrice(binanceSymbol);

    if (!marketPrice) {
      this.logger.warn(`⚠️  No price for ${binanceSymbol} from Binance`);
      return;
    }

    this.logger.log(`📊 ${binanceSymbol}: Market price = ${marketPrice}`);

    // Tính giá bid/ask với spread và làm tròn theo tick_size
    const tickSize = parseFloat(symbol.tick_size);
    const spreadAmount = marketPrice * this.config.spread;
    const rawBidPrice = marketPrice - spreadAmount;
    const rawAskPrice = marketPrice + spreadAmount;

    // Làm tròn price xuống theo tick_size
    const bidPrice = Math.floor(rawBidPrice / tickSize) * tickSize;
    const askPrice = Math.floor(rawAskPrice / tickSize) * tickSize;

    // Tính quantity dựa trên orderSize (USDT) và làm tròn theo lot_size
    const rawQuantity = this.config.orderSize / marketPrice;
    const lotSize = parseFloat(symbol.lot_size);
    const baseQuantity = Math.floor(rawQuantity / lotSize) * lotSize;

    // Skip nếu quantity quá nhỏ
    if (baseQuantity <= 0) {
      this.logger.warn(
        `⚠️  ${binanceSymbol}: Quantity too small (${baseQuantity}), skipping`,
      );
      return;
    }

    // Check xem đã có lệnh active chưa
    const existingOrders = this.activeOrders.get(binanceSymbol);

    if (existingOrders) {
      // Cancel lệnh cũ
      await this.cancelOrder(
        this.config.botBuyUserId,
        existingOrders.buyOrderId,
      );
      await this.cancelOrder(
        this.config.botSellUserId,
        existingOrders.sellOrderId,
      );
    }

    // Đặt lệnh mới (2 bot users khác nhau để tránh self-trading)
    const buyOrderId = await this.placeBotOrder(
      this.config.botBuyUserId,
      binanceSymbol,
      OrderSide.BUY,
      bidPrice,
      baseQuantity,
    );

    const sellOrderId = await this.placeBotOrder(
      this.config.botSellUserId,
      binanceSymbol,
      OrderSide.SELL,
      askPrice,
      baseQuantity,
    );

    // Lưu order IDs
    this.activeOrders.set(binanceSymbol, {
      buyOrderId,
      sellOrderId,
    });

    this.logger.log(
      `✅ ${binanceSymbol}: Placed BUY @ ${bidPrice.toFixed(2)} (${baseQuantity}) | SELL @ ${askPrice.toFixed(2)} (${baseQuantity})`,
    );
  }

  private async fetchBinancePrice(symbol: string): Promise<number | null> {
    try {
      const response = await axios.get<BinanceTickerPrice>(
        `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
        { timeout: 5000 },
      );

      return parseFloat(response.data.price);
    } catch (err) {
      this.logger.error(
        `❌ Failed to fetch Binance price for ${symbol}: ${err.message}`,
      );
      return null;
    }
  }

  private async placeBotOrder(
    userId: number,
    symbol: string,
    side: OrderSide,
    price: number,
    quantity: number,
  ): Promise<string> {
    try {
      // Format price và quantity to remove trailing zeros
      const formattedPrice = parseFloat(price.toFixed(8)).toString();
      const formattedQty = parseFloat(quantity.toFixed(8)).toString();

      const order = await this.orderService.createOrder(userId, {
        symbol,
        side,
        type: OrderType.LIMIT,
        price: formattedPrice,
        qty: formattedQty,
      });

      return order.id;
    } catch (err) {
      this.logger.error(`❌ Failed to place bot order: ${err.message}`);
      throw err;
    }
  }

  private async cancelOrder(userId: number, orderId: string) {
    try {
      await this.orderService.cancelOrder(userId, orderId);
    } catch (err) {
      // Ignore if order already filled or canceled
      if (
        !err.message.includes('not found') &&
        !err.message.includes('cannot be cancelled')
      ) {
        this.logger.error(
          `❌ Failed to cancel order ${orderId}: ${err.message}`,
        );
      }
    }
  }

  private async cancelAllBotOrders() {
    const orderRepo = this.dataSource.getRepository(Order);

    // Cancel lệnh của cả 2 bot users
    const botBuyOrders = await orderRepo.find({
      where: {
        user_id: this.config.botBuyUserId.toString(),
        status: OrderStatus.NEW,
      },
    });

    const botSellOrders = await orderRepo.find({
      where: {
        user_id: this.config.botSellUserId.toString(),
        status: OrderStatus.NEW,
      },
    });

    for (const order of botBuyOrders) {
      await this.cancelOrder(this.config.botBuyUserId, order.id);
    }

    for (const order of botSellOrders) {
      await this.cancelOrder(this.config.botSellUserId, order.id);
    }

    this.activeOrders.clear();
    this.logger.log('🧹 All bot orders cancelled');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Trader Bot - Tự động trade với market maker để tạo volume
  private async runTraderBot() {
    while (this.isRunning) {
      try {
        await this.executeTrades();
      } catch (err) {
        this.logger.error(`❌ Trader bot error: ${err.message}`, err.stack);
      }

      await this.sleep(this.config.tradeInterval);
    }
  }

  private async executeTrades() {
    const symbolRepo = this.dataSource.getRepository(Symbol);
    const symbols = await symbolRepo.find({
      where: { status: 'TRADING', type: SymbolType.SPOT },
    });

    for (const symbol of symbols) {
      try {
        await this.executeTradeForSymbol(symbol);
      } catch (err) {
        this.logger.error(
          `❌ Error executing trade for ${symbol.symbol}: ${err.message}`,
        );
      }
    }
  }

  private async executeTradeForSymbol(symbol: Symbol) {
    const binanceSymbol = symbol.symbol;
    const currentPrice = await this.fetchBinancePrice(binanceSymbol);

    if (!currentPrice) {
      return;
    }

    const lastPrice = this.lastPrices.get(binanceSymbol);
    this.lastPrices.set(binanceSymbol, currentPrice);

    // Parse base/quote currency từ symbol (BTCUSDT → BTC/USDT)
    const baseCurrency = binanceSymbol.replace('USDT', '');
    const quoteCurrency = 'USDT';

    // Check balance để quyết định BUY hay SELL
    const Balance = this.dataSource.getRepository(
      (await import('../balances/entities/balance.entity')).Balance,
    );

    const usdtBalance = await Balance.findOne({
      where: {
        user_id: this.config.botTraderUserId,
        currency: quoteCurrency,
        wallet_type: WalletType.SPOT,
      },
    });

    const baseBalance = await Balance.findOne({
      where: {
        user_id: this.config.botTraderUserId,
        currency: baseCurrency,
        wallet_type: WalletType.SPOT,
      },
    });

    const availableUsdt = parseFloat(usdtBalance?.available || '0');
    const availableBase = parseFloat(baseBalance?.available || '0');

    this.logger.debug(
      `💰 ${binanceSymbol} Balance - USDT: ${availableUsdt.toFixed(2)}, ${baseCurrency}: ${availableBase.toFixed(6)}`,
    );

    // Quyết định BUY hay SELL dựa trên balance và rebalancing
    let side: OrderSide;
    let maxQty: number;

    const usdtValue = availableUsdt;
    const baseValue = availableBase * currentPrice;
    const totalValue = usdtValue + baseValue;
    const usdtRatio = totalValue > 0 ? usdtValue / totalValue : 0;

    // Rebalancing: duy trì tỉ lệ USDT ~50-70%
    if (usdtRatio > 0.7 && availableUsdt >= this.config.orderSize) {
      // Quá nhiều USDT → Ưu tiên BUY
      side = OrderSide.BUY;
      maxQty = availableUsdt / currentPrice;
    } else if (usdtRatio < 0.3 && availableBase > 0) {
      // Quá nhiều base currency → Ưu tiên SELL
      side = OrderSide.SELL;
      maxQty = availableBase;
    } else if (availableUsdt >= this.config.orderSize && availableBase > 0) {
      // Cân bằng → theo xu hướng giá
      if (!lastPrice || currentPrice >= lastPrice) {
        side = OrderSide.BUY;
        maxQty = availableUsdt / currentPrice;
      } else {
        side = OrderSide.SELL;
        maxQty = availableBase;
      }
    } else if (availableUsdt >= this.config.orderSize) {
      // Chỉ có USDT → BUY
      side = OrderSide.BUY;
      maxQty = availableUsdt / currentPrice;
    } else if (availableBase > 0) {
      // Chỉ có base currency → SELL
      side = OrderSide.SELL;
      maxQty = availableBase;
    } else {
      // Không đủ balance
      this.logger.warn(
        `⚠️ ${binanceSymbol}: Insufficient balance (USDT: ${availableUsdt.toFixed(2)}, ${baseCurrency}: ${availableBase.toFixed(6)})`,
      );
      return;
    }

    this.logger.debug(
      `📊 ${binanceSymbol} Portfolio - Total: $${totalValue.toFixed(2)}, USDT ratio: ${(usdtRatio * 100).toFixed(1)}% → ${side}`,
    );

    // Random quantity từ 30-80% của orderSize để đảm bảo đủ balance
    const baseSize = this.config.orderSize * (0.3 + Math.random() * 0.5);
    const lotSize = parseFloat(symbol.lot_size);

    // Đảm bảo không vượt quá 80% available balance
    const safeMaxQty = side === OrderSide.BUY ? maxQty * 0.8 : maxQty * 0.8;

    const rawQty = Math.min(baseSize / currentPrice, safeMaxQty);
    const quantity = Math.floor(rawQty / lotSize) * lotSize;

    if (quantity <= 0) {
      this.logger.warn(
        `⚠️ ${binanceSymbol}: Quantity too small (${quantity}), skipping`,
      );
      return;
    }

    try {
      // Đặt MARKET order để khớp ngay với market maker bot
      const formattedQty = parseFloat(quantity.toFixed(8)).toString();
      const estimatedCost =
        side === OrderSide.BUY ? quantity * currentPrice : 0;

      this.logger.log(
        `🔄 Attempting ${side} ${formattedQty} ${binanceSymbol} @ MARKET (Est. cost: ${estimatedCost.toFixed(2)} USDT, Available: ${availableUsdt.toFixed(2)} USDT)`,
      );

      await this.orderService.createOrder(this.config.botTraderUserId, {
        symbol: binanceSymbol,
        side,
        type: OrderType.MARKET,
        qty: formattedQty,
      });

      this.logger.log(
        `✅ Trader bot: ${side} ${formattedQty} ${binanceSymbol} @ MARKET`,
      );
    } catch (err) {
      this.logger.error(
        `❌ Trader bot order failed for ${binanceSymbol}: ${err.message}`,
      );
      this.logger.error(
        `   Details - Side: ${side}, Qty: ${quantity}, USDT: ${availableUsdt}, ${baseCurrency}: ${availableBase}`,
      );
    }
  }

  // API để bật/tắt bot
  async toggleBot(enabled: boolean) {
    this.config.enabled = enabled;
    if (enabled) {
      await this.start();
    } else {
      await this.stop();
    }
  }

  // API để update config
  async updateConfig(config: Partial<BotConfig>) {
    this.config = { ...this.config, ...config };
    this.logger.log(`🔧 Bot config updated: ${JSON.stringify(this.config)}`);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      activeSymbols: Array.from(this.activeOrders.keys()),
      totalActiveOrders: this.activeOrders.size * 2, // Buy + Sell
    };
  }
}
