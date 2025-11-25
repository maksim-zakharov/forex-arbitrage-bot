import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { CTraderConnection } from '@max89701/ctrader-layer';
import Bottleneck from 'bottleneck';
import { initializeAuth } from './ctrader-auth.utils';

// Временные типы до копирования generated файлов
enum ProtoOAPayloadType {
  PROTO_OA_APPLICATION_AUTH_REQ = 2100,
  PROTO_OA_ACCOUNT_AUTH_REQ = 2102,
  PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ = 2149,
  PROTO_OA_SYMBOLS_LIST_REQ = 2114,
  PROTO_OA_RECONCILE_REQ = 2124,
  PROTO_OA_NEW_ORDER_REQ = 2106,
  PROTO_OA_CLOSE_POSITION_REQ = 2111,
}

enum ProtoOAPositionStatus {
  POSITION_STATUS_OPEN = 1,
  POSITION_STATUS_CLOSED = 2,
  POSITION_STATUS_CREATED = 3,
  POSITION_STATUS_ERROR = 4,
}

enum ProtoOAOrderType {
  MARKET = 1,
  LIMIT = 2,
  STOP = 3,
}

enum ProtoOATradeSide {
  BUY = 1,
  SELL = 2,
}

interface Command {
  payloadType: ProtoOAPayloadType;
  payload: any;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

@Injectable()
export class CtraderService implements OnModuleInit {
  private readonly logger = new Logger(CtraderService.name);
  private connection: CTraderConnection;
  private ctidTraderAccountId: string;
  private positions: any[] = [];
  private orders: any[] = [];
  private limiter: Bottleneck;
  private symbols: any[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.limiter = new Bottleneck({
      maxConcurrent: 1,
      minTime: 250,
    });
  }

  async onModuleInit() {
    this.logger.log('🚀 Инициализация cTrader сервиса...');
    await this.init();
  }

  async init() {
    try {
      // Проверяем наличие токенов
      let accessToken = this.configService.get('CTRADER_ACCESS_TOKEN');
      let refreshToken = this.configService.get('CTRADER_REFRESH_TOKEN');

      // Если токенов нет или они невалидны, выполняем авторизацию через puppeteer
      if (!accessToken || !refreshToken) {
        this.logger.log('🔐 Токены отсутствуют, запуск авторизации через Puppeteer...');
        
        const tokens = await initializeAuth({
          username: this.configService.get('CTRADER_USERNAME'),
          password: this.configService.get('CTRADER_PASSWORD'),
          client_id: this.configService.get('CTRADER_CLIENT_ID'),
          client_secret: this.configService.get('CTRADER_CLIENT_SECRET'),
          redirect_uri: this.configService.get('CTRADER_REDIRECT_URI'),
          httpService: this.httpService,
          logger: this.logger,
        });

        accessToken = tokens.accessToken;
        refreshToken = tokens.refreshToken;

        this.logger.log('💾 Токены сохранены в конфигурации');
        // Сохраняем токены (если нужно обновить конфиг)
        this.configService.set('CTRADER_ACCESS_TOKEN', accessToken);
        this.configService.set('CTRADER_REFRESH_TOKEN', refreshToken);
      } else {
        this.logger.log('✅ Токены уже существуют, пропускаем авторизацию');
      }

      // Подключение к cTrader API
      const host = this.configService.get('CTRADER_HOST') || 'live.ctraderapi.com';
      const port = parseInt(this.configService.get('CTRADER_PORT') || '5035');

      this.logger.log(`🔌 Подключение к cTrader API (${host}:${port})...`);
      this.connection = new CTraderConnection({ host, port });
      await this.connection.open();

      this.logger.log('🔐 Авторизация приложения...');
      await this.connection.sendCommand(
        ProtoOAPayloadType.PROTO_OA_APPLICATION_AUTH_REQ,
        {
          clientId: this.configService.get('CTRADER_CLIENT_ID'),
          clientSecret: this.configService.get('CTRADER_CLIENT_SECRET'),
        },
      );

      // Отправка heartbeat каждые 25 секунд
      setInterval(() => this.connection.sendHeartbeat(), 25000);

      this.logger.log('✅ CTrader приложение успешно авторизовано');

      // Выбор аккаунта
      if (accessToken) {
        this.logger.log('👤 Выбор торгового аккаунта...');
        const selectAccountRes = await this.selectAccount(accessToken);
        if (selectAccountRes && selectAccountRes.length > 0) {
          this.ctidTraderAccountId = selectAccountRes[0].ctidTraderAccountId.toString();
          this.logger.log(`✅ Выбран аккаунт: ${this.ctidTraderAccountId}`);
          
          await this.auth(accessToken, this.ctidTraderAccountId);
          await this.loadSymbols();
        } else {
          this.logger.warn('⚠️ Аккаунты не найдены');
        }
      }
    } catch (error) {
      this.logger.error(`❌ Ошибка инициализации cTrader: ${error.message}`, error.stack);
      throw error;
    }
  }

  get accessToken() {
    return this.configService.get('CTRADER_ACCESS_TOKEN');
  }

  async selectAccount(accessToken: string) {
    try {
      const res = await this.connection.sendCommand(
        ProtoOAPayloadType.PROTO_OA_GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ,
        {
          accessToken,
        },
      );
      return res.ctidTraderAccount;
    } catch (e) {
      this.logger.error(`Error selecting account: ${JSON.stringify(e)}`);
      return undefined;
    }
  }

  async auth(accessToken: string, ctidTraderAccountId: string) {
    const res = await this.sendCommand(
      ProtoOAPayloadType.PROTO_OA_ACCOUNT_AUTH_REQ,
      {
        ctidTraderAccountId: Number(ctidTraderAccountId),
        accessToken,
      },
    );
    this.logger.log(`Аккаунт ${ctidTraderAccountId} авторизован`);
    return res;
  }

  async loadSymbols() {
    const res = await this.sendCommand<any>(
      ProtoOAPayloadType.PROTO_OA_SYMBOLS_LIST_REQ,
      {
        ctidTraderAccountId: Number(this.ctidTraderAccountId),
      },
    );
    this.symbols = res.symbol || [];
    this.logger.log(`Доступно ${this.symbols.length} инструментов`);
  }

  async getPositions(ctidTraderAccountId?: string) {
    const accountId = ctidTraderAccountId || this.ctidTraderAccountId;
    const res = await this.sendCommand<any>(
      ProtoOAPayloadType.PROTO_OA_RECONCILE_REQ,
      {
        ctidTraderAccountId: Number(accountId),
      },
    );
    this.positions = res.position || [];
    this.orders = res.order || [];
    return res;
  }

  getActivePositions() {
    return this.positions.filter(
      (p) => p.positionStatus === ProtoOAPositionStatus.POSITION_STATUS_OPEN,
    );
  }

  async getPositionsBySymbol(symbol: string) {
    await this.getPositions();
    const activePositions = this.getActivePositions();
    const symbolInfo = this.symbols.find((s) => s.symbolName === symbol);
    if (!symbolInfo) {
      return [];
    }
    return activePositions.filter(
      (p) => p.symbolId.toString() === symbolInfo.symbolId.toString(),
    );
  }

  async hasOpenPosition(symbol: string): Promise<boolean> {
    const positions = await this.getPositionsBySymbol(symbol);
    return positions.length > 0;
  }

  async createMarketOrder(symbol: string, side: 'buy' | 'sell', volume: number) {
    const symbolInfo = this.symbols.find((s) => s.symbolName === symbol);
    if (!symbolInfo) {
      throw new Error(`Symbol ${symbol} not found`);
    }

    const res = await this.sendCommand<any>(
      ProtoOAPayloadType.PROTO_OA_NEW_ORDER_REQ,
      {
        ctidTraderAccountId: Number(this.ctidTraderAccountId),
        symbolId: Number(symbolInfo.symbolId),
        orderType: ProtoOAOrderType.MARKET,
        tradeSide: side === 'buy' ? ProtoOATradeSide.BUY : ProtoOATradeSide.SELL,
        volume,
      },
    );
    return res;
  }

  async closePosition(positionId: number, volume: number) {
    const res = await this.sendCommand<any>(
      ProtoOAPayloadType.PROTO_OA_CLOSE_POSITION_REQ,
      {
        ctidTraderAccountId: Number(this.ctidTraderAccountId),
        positionId,
        volume,
      },
    );
    return res;
  }

  async closeOnePosition(symbol: string) {
    const positions = await this.getPositionsBySymbol(symbol);
    if (positions.length === 0) {
      throw new Error(`No open positions found for ${symbol}`);
    }

    // Закрываем первую позицию полностью
    const positionToClose = positions[0];
    // В ProtoOAPosition volume находится в tradeData
    const volume = positionToClose.tradeData?.volume || 0;
    if (volume === 0) {
      throw new Error(`Position ${positionToClose.positionId} has zero volume`);
    }
    await this.closePosition(
      Number(positionToClose.positionId),
      volume,
    );
    return { volume };
  }

  private async _baseRequest(command: Command) {
    try {
      const result = await this.connection.sendCommand(
        command.payloadType,
        command.payload,
      );
      command.resolve(result);
    } catch (error) {
      this.logger.error(`CTrader API error: ${JSON.stringify(error)}`);
      command.reject(error);
    }
  }

  async sendCommand<Response>(
    payloadType: ProtoOAPayloadType,
    payload: any,
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      this.limiter
        .schedule(() =>
          this._baseRequest({ payloadType, payload, resolve, reject }),
        )
        .catch((error) => {
          reject(error);
        });
    });
  }
}

