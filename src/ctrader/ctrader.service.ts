import { Injectable, OnModuleInit } from '@nestjs/common';
import { CTraderLayer } from '@max89701/ctrader-layer';

@Injectable()
export class CtraderService implements OnModuleInit {
  private client: CTraderLayer;
  private accountId: string;

  onModuleInit() {
    const host = process.env.CTRADER_HOST || '';
    const port = parseInt(process.env.CTRADER_PORT || '5032');
    const clientId = process.env.CTRADER_CLIENT_ID || '';
    const clientSecret = process.env.CTRADER_CLIENT_SECRET || '';
    this.accountId = process.env.CTRADER_ACCOUNT_ID || '';

    if (!host || !clientId || !clientSecret || !this.accountId) {
      throw new Error('CTRADER_HOST, CTRADER_CLIENT_ID, CTRADER_CLIENT_SECRET, and CTRADER_ACCOUNT_ID must be set');
    }

    this.client = new CTraderLayer({
      host,
      port,
      clientId,
      clientSecret,
    });
  }

  async getPositions() {
    return this.client.getPositions(this.accountId);
  }

  async getPositionsBySymbol(symbol: string) {
    const positions = await this.getPositions();
    return positions.filter(p => p.symbol === symbol && p.volume > 0);
  }

  async hasOpenPosition(symbol: string): Promise<boolean> {
    const positions = await this.getPositionsBySymbol(symbol);
    return positions.length > 0;
  }

  async createMarketOrder(symbol: string, side: 'buy' | 'sell', volume: number) {
    return this.client.createMarketOrder({
      accountId: this.accountId,
      symbol,
      orderType: side === 'buy' ? 'BUY' : 'SELL',
      volume,
    });
  }

  async closePosition(positionId: string) {
    return this.client.closePosition({
      accountId: this.accountId,
      positionId,
    });
  }

  async closeOnePosition(symbol: string) {
    const positions = await this.getPositionsBySymbol(symbol);
    if (positions.length === 0) {
      throw new Error(`No open positions found for ${symbol}`);
    }

    // Закрываем первую позицию
    const positionToClose = positions[0];
    return this.closePosition(positionToClose.id);
  }
}

