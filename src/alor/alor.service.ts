import { Injectable, OnModuleInit } from '@nestjs/common';
import { AlorApi, Exchange, Side, Endpoint, AuthEndpoint, WssEndpoint, WssEndpointBeta } from 'alor-api';

@Injectable()
export class AlorService implements OnModuleInit {
  private api: AlorApi;
  private token: string;
  private portfolio: string;
  private exchange: Exchange = Exchange.MOEX;

  onModuleInit() {
    this.token = process.env.ALOR_REFRESH_TOKEN || '';
    this.portfolio = process.env.ALOR_PORTFOLIO || '';

    if (!this.token || !this.portfolio) {
      throw new Error('ALOR_REFRESH_TOKEN and ALOR_PORTFOLIO must be set in environment variables');
    }

    this.api = new AlorApi({
      token: this.token,
      endpoint: Endpoint.PROD,
      authEndpoint: AuthEndpoint.PROD,
      wssEndpoint: WssEndpoint.PROD,
      wssEndpointBeta: WssEndpointBeta.PROD,
    });
  }

  async getPositions() {
    return this.api.clientInfo.getPositions({
      exchange: this.exchange as any,
      portfolio: this.portfolio,
    });
  }

  async getPositionBySymbol(symbol: string) {
    const positions = await this.getPositions();
    return positions.find(p => p.symbol === symbol);
  }

  async hasOpenPosition(symbol: string): Promise<boolean> {
    const position = await this.getPositionBySymbol(symbol);
    return !!position && Math.abs(position.qty) > 0;
  }

  async createMarketOrder(symbol: string, side: Side, qty: number) {
    // Используем sendMarketOrder для создания рыночного ордера
    return this.api.orders.sendMarketOrder({
      side: side as any,
      quantity: Math.abs(qty),
      type: 'market',
      user: {
        portfolio: this.portfolio,
      },
      instrument: {
        symbol,
        exchange: this.exchange,
      },
    });
  }

  async closePosition(symbol: string, qty: number) {
    const position = await this.getPositionBySymbol(symbol);
    if (!position) {
      throw new Error(`No open position found for ${symbol}`);
    }

    const side = position.qty > 0 ? Side.Sell : Side.Buy;
    const closeQty = Math.min(Math.abs(position.qty), qty);

    return this.createMarketOrder(symbol, side, closeQty);
  }
}

