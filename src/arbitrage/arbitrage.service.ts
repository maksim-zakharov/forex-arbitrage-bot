import { Injectable } from '@nestjs/common';
import { AlorService } from '../alor/alor.service';
import { CtraderService } from '../ctrader/ctrader.service';
import { Mutex } from 'async-mutex';
import { Side } from 'alor-api';

export interface ArbitrageSignal {
  action: 'open' | 'close';
  symbol: string;
  alorSymbol: string;
  ctraderSymbol: string;
  volume: number;
  side: 'buy' | 'sell';
}

@Injectable()
export class ArbitrageService {
  private operationMutex = new Mutex();

  constructor(
    private readonly alorService: AlorService,
    private readonly ctraderService: CtraderService,
  ) {}

  async handleOpenSignal(signal: ArbitrageSignal): Promise<void> {
    // Защита от частых запросов
    return this.operationMutex.runExclusive(async () => {
      // Проверяем, нет ли уже открытых позиций
      const alorHasPosition = await this.alorService.hasOpenPosition(signal.alorSymbol);
      const ctraderHasPosition = await this.ctraderService.hasOpenPosition(signal.ctraderSymbol);

      if (alorHasPosition || ctraderHasPosition) {
        throw new Error(
          `Position already exists: Alor=${alorHasPosition}, CTrader=${ctraderHasPosition}`,
        );
      }

      // Открываем позиции одновременно
      const [alorOrder, ctraderOrder] = await Promise.all([
        this.alorService.createMarketOrder(
          signal.alorSymbol,
          signal.side === 'buy' ? Side.Buy : Side.Sell,
          signal.volume,
        ),
        this.ctraderService.createMarketOrder(
          signal.ctraderSymbol,
          signal.side,
          signal.volume,
        ),
      ]);

      return { alorOrder, ctraderOrder };
    });
  }

  async handleCloseSignal(signal: ArbitrageSignal): Promise<void> {
    // Защита от частых запросов
    return this.operationMutex.runExclusive(async () => {
      // Получаем позиции по форексу
      const ctraderPositions = await this.ctraderService.getPositionsBySymbol(signal.ctraderSymbol);

      if (ctraderPositions.length === 0) {
        throw new Error(`No open positions found for ${signal.ctraderSymbol}`);
      }

      // Закрываем одну позицию на форексе
      const closedCtraderPosition = await this.ctraderService.closeOnePosition(signal.ctraderSymbol);
      const closedVolume = closedCtraderPosition.volume || signal.volume;

      // Закрываем эквивалентную позицию на алоре
      await this.alorService.closePosition(signal.alorSymbol, closedVolume);

      return { closedCtraderPosition, closedVolume };
    });
  }

  async handleSignal(signal: ArbitrageSignal): Promise<any> {
    if (signal.action === 'open') {
      return this.handleOpenSignal(signal);
    } else if (signal.action === 'close') {
      return this.handleCloseSignal(signal);
    } else {
      throw new Error(`Unknown action: ${signal.action}`);
    }
  }
}

