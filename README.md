# Forex Arbitrage Bot

Автоматический бот для арбитража между Alor MOEX и ctraderForex через вебхуки TradingView.

## Установка

```bash
npm install
```

### Копирование сгенерированных типов CTrader

Для работы с CTrader необходимо скопировать сгенерированные типы из проекта `moex-arbitrage-bot`:

```bash
# Скопируйте папку generated из moex-arbitrage-bot в forex-arbitrage-bot
cp -r ../moex-arbitrage-bot/src/generated ./src/generated
```

Или в Windows PowerShell:
```powershell
Copy-Item -Path "..\moex-arbitrage-bot\src\generated" -Destination ".\src\generated" -Recurse
```

Эти файлы содержат TypeScript типы для работы с CTrader Open API протоколом.

## Настройка

Скопируйте `.env.example` в `.env` и заполните необходимые переменные:

- `ALOR_REFRESH_TOKEN` - токен для Alor API
- `ALOR_PORTFOLIO` - портфель Alor
- `CTRADER_HOST` - хост CTrader сервера (по умолчанию `live.ctraderapi.com`)
- `CTRADER_PORT` - порт CTrader сервера (по умолчанию `5035`)
- `CTRADER_CLIENT_ID` - Client ID для CTrader
- `CTRADER_CLIENT_SECRET` - Client Secret для CTrader
- `CTRADER_ACCESS_TOKEN` - Access Token для CTrader (получается через OAuth)

## Запуск

```bash
# Разработка
npm run start:dev

# Продакшн
npm run build
npm run start:prod
```

## API

### Webhook для TradingView

**POST** `/api/webhook/tradingview`

Тело запроса:
```json
{
  "action": "open",  // или "close"
  "symbol": "EURUSD",
  "alorSymbol": "EURUSD",
  "ctraderSymbol": "EURUSD",
  "volume": 1,
  "side": "buy"  // или "sell"
}
```

## Особенности

- Защита от открытия позиций, если они уже существуют
- Защита от частых запросов (mutex) - пока предыдущий запрос не выполнен, новый игнорируется
- При закрытии позиций: закрывается одна позиция на форексе, затем эквивалентная позиция на алоре

