# Forex Arbitrage Bot

Автоматический бот для арбитража между Alor MOEX и ctraderForex через вебхуки TradingView.

## Установка

```bash
npm install
```

## Настройка

Скопируйте `.env.example` в `.env` и заполните необходимые переменные:

- `ALOR_TOKEN` - токен для Alor API
- `ALOR_PORTFOLIO` - портфель Alor
- `CTRADER_HOST` - хост CTrader сервера
- `CTRADER_PORT` - порт CTrader сервера (по умолчанию 5032)
- `CTRADER_CLIENT_ID` - Client ID для CTrader
- `CTRADER_CLIENT_SECRET` - Client Secret для CTrader
- `CTRADER_ACCOUNT_ID` - Account ID для CTrader

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

