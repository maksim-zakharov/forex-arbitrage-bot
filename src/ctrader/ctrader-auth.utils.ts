import * as puppeteer from 'puppeteer';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export const getAuthCodeHeadless = async ({
  username,
  password,
  client_id,
  redirect_uri,
  logger,
}: {
  username: string;
  password: string;
  client_id: string;
  redirect_uri: string;
  logger?: any;
}): Promise<string> => {
  logger?.log('🚀 Запуск браузера для авторизации...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    );

    logger?.log('📝 Переход на страницу авторизации...');
    // Шаг 1: Авторизация
    const authUrl = new URL(
      'https://id.ctrader.com/my/settings/openapi/grantingaccess',
    );
    authUrl.searchParams.append('client_id', client_id);
    authUrl.searchParams.append('redirect_uri', redirect_uri);
    authUrl.searchParams.append('scope', 'trading');

    await page.goto(authUrl.toString(), { waitUntil: 'networkidle2' });

    logger?.log('⏳ Ожидание формы входа...');
    // Добавляем задержку для полной загрузки формы
    await page.waitForSelector('input[name="id"]', { visible: true });
    await page.waitForSelector('input[name="password"]', { visible: true });

    logger?.log('✍️ Заполнение формы авторизации...');
    // Заполняем форму с новыми селекторами
    await page.type('input[name="id"]', username, { delay: 50 });
    await page.type('input[name="password"]', password, { delay: 50 });

    logger?.log('🔘 Нажатие кнопки входа...');
    // Кликаем по кнопке входа
    await page.evaluate(() => {
      // @ts-ignore
      document.querySelector('#login-content button[type="submit"]').click();
    });

    logger?.log('⏳ Ожидание страницы подтверждения доступа...');
    // Шаг 2: Ожидаем страницу подтверждения доступа
    await page.waitForSelector('#auth-btn-allow', { timeout: 15000 });

    let authCode: string | null = null;

    // Включаем перехват запросов
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      request.continue();
    });

    // Ловим редирект
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes(redirect_uri)) {
        const location = response.headers()['location'] || url;
        const urlObj = new URL(location);
        authCode = urlObj.searchParams.get('code');
      }
    });

    logger?.log('✅ Подтверждение доступа...');
    // Кликаем кнопку подтверждения
    await page.evaluate(() => {
      // @ts-ignore
      document.querySelector('#auth-btn-allow').click();
    });

    logger?.log('⏳ Получение кода авторизации...');
    // Ждем либо появления кода, либо таймаута
    authCode = await getAuthCode(page, logger);

    if (!authCode) {
      throw new Error('Authorization code not found');
    }

    logger?.log('✅ Код авторизации успешно получен');
    return authCode;
  } finally {
    await browser.close();
    logger?.log('🔒 Браузер закрыт');
  }
};

const getAuthCode = async (
  page: puppeteer.Page,
  logger?: any,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Вариант 1: Ожидание изменения URL
    const checkUrl = () => {
      const url = page.url();
      if (url.includes('callback?code=')) {
        clearTimeout(timeout);
        resolve(new URL(url).searchParams.get('code')!);
        return true;
      }
      return false;
    };

    // Вариант 2: Обработчик response (для API запросов)
    const responseHandler = async (response: puppeteer.HTTPResponse) => {
      const url = response.url();
      if (url.includes('callback?code=')) {
        clearTimeout(timeout);
        page.off('response', responseHandler);
        resolve(new URL(url).searchParams.get('code')!);
      }
    };

    // Вариант 3: Обработчик request (для редиректов)
    const requestHandler = (request: puppeteer.HTTPRequest) => {
      const url = request.url();
      if (url.includes('callback?code=')) {
        clearTimeout(timeout);
        page.off('request', requestHandler);
        resolve(new URL(url).searchParams.get('code')!);
      }
    };

    // Таймаут
    const timeout = setTimeout(() => {
      page.off('response', responseHandler);
      page.off('request', requestHandler);
      logger?.error('❌ Таймаут получения кода авторизации (10s)');
      reject(new Error('Auth code timeout (10s)'));
    }, 10000);

    // Запускаем все проверки
    if (!checkUrl()) {
      page.on('response', responseHandler);
      page.on('request', requestHandler);

      // Периодическая проверка URL
      const interval = setInterval(() => {
        if (checkUrl()) {
          clearInterval(interval);
          page.off('response', responseHandler);
          page.off('request', requestHandler);
        }
      }, 300);
    }
  });
};

export const exchangeCodeForToken = async (
  props: {
    code: string;
    redirect_uri: string;
    client_id: string;
    client_secret: string;
  },
  httpService: HttpService,
  logger?: any,
) => {
  logger?.log('🔄 Обмен кода авторизации на токены...');
  const response = await firstValueFrom(
    httpService.post(
      'https://openapi.ctrader.com/apps/token',
      {},
      {
        params: {
          grant_type: 'authorization_code',
          ...props,
        },
      },
    ),
  );

  logger?.log('✅ Токены успешно получены');
  return response.data;
};

export const initializeAuth = async (props: {
  username: string;
  password: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  httpService: HttpService;
  logger?: any;
}) => {
  try {
    props?.logger?.log('🔐 Начало процесса авторизации cTrader...');
    const code = await getAuthCodeHeadless(
      {
        username: props.username,
        password: props.password,
        client_id: props.client_id,
        redirect_uri: props.redirect_uri,
      },
      props.logger,
    );
    props?.logger?.log('📦 Получение токенов доступа...');
    const tokens = await exchangeCodeForToken(
      {
        client_id: props.client_id,
        client_secret: props.client_secret,
        code,
        redirect_uri: props.redirect_uri,
      },
      props.httpService,
      props.logger,
    );
    props?.logger?.log('✅ Авторизация cTrader завершена успешно');
    return tokens;
  } catch (error: any) {
    if (error.response?.status === 429) {
      props?.logger?.error(
        '⚠️ CTraderError: Слишком частые запросы, повтор через 15 секунд...',
      );

      await new Promise((resolve) => setTimeout(resolve, 15000));

      return initializeAuth(props);
    }
    props?.logger?.error(`❌ Ошибка авторизации: ${error.message}`);
    throw error;
  }
};

