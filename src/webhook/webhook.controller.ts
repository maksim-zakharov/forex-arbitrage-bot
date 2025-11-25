import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ArbitrageService, ArbitrageSignal } from '../arbitrage/arbitrage.service';

interface TradingViewWebhook {
  action?: 'open' | 'close';
  symbol?: string;
  alorSymbol?: string;
  ctraderSymbol?: string;
  volume?: number;
  side?: 'buy' | 'sell';
  // TradingView может отправлять другие поля
  [key: string]: any;
}

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly arbitrageService: ArbitrageService) {}

  @Post('tradingview')
  @HttpCode(HttpStatus.OK)
  async handleTradingViewWebhook(@Body() body: TradingViewWebhook) {
    this.logger.log(`Received webhook: ${JSON.stringify(body)}`);

    try {
      // Преобразуем вебхук TradingView в формат ArbitrageSignal
      const signal: ArbitrageSignal = {
        action: body.action || (body.close ? 'close' : 'open'),
        symbol: body.symbol || '',
        alorSymbol: body.alorSymbol || body.symbol || '',
        ctraderSymbol: body.ctraderSymbol || body.symbol || '',
        volume: body.volume || 1,
        side: body.side || (body.buy ? 'buy' : 'sell'),
      };

      // Валидация
      if (!signal.alorSymbol || !signal.ctraderSymbol) {
        throw new Error('alorSymbol and ctraderSymbol are required');
      }

      if (!signal.volume || signal.volume <= 0) {
        throw new Error('volume must be greater than 0');
      }

      const result = await this.arbitrageService.handleSignal(signal);

      this.logger.log(`Successfully processed signal: ${JSON.stringify(signal)}`);
      return {
        success: true,
        message: 'Signal processed successfully',
        result,
      };
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

