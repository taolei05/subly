import type { Env } from '../types/index';
import { jsonResponse, logger, verifyToken } from '../utils';

const DEFAULT_RATES: Record<string, number> = {
  CNY: 1,
  HKD: 1.09,
  USD: 0.14,
  EUR: 0.13,
  GBP: 0.11,
};

interface ExchangeRateApiResponse {
  result: string;
  conversion_rates: Record<string, number>;
}

export async function getExchangeRate(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const payload = await verifyToken(token);

      if (payload) {
        const config = await env.DB.prepare('SELECT api_key, enabled FROM exchangerate_config WHERE user_id = ?')
          .bind(payload.userId)
          .first<{ api_key: string; enabled: number }>();

        if (config?.enabled !== 0 && config?.api_key) {
          const rates = await fetchExchangeRates(config.api_key);
          if (rates) {
            return jsonResponse({
              success: true,
              source: 'exchangerate-api',
              data: {
                base: 'CNY',
                rates: {
                  CNY: 1,
                  HKD: rates.HKD || DEFAULT_RATES.HKD,
                  USD: rates.USD || DEFAULT_RATES.USD,
                  EUR: rates.EUR || DEFAULT_RATES.EUR,
                  GBP: rates.GBP || DEFAULT_RATES.GBP,
                },
              },
            });
          }
        }
      }
    } catch (e) {
      logger.error('Exchange rate API error', e);
    }
  }

  return jsonResponse({
    success: true,
    source: 'default',
    data: { base: 'CNY', rates: DEFAULT_RATES },
  });
}

async function fetchExchangeRates(apiKey: string): Promise<Record<string, number> | null> {
  try {
    const apiUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/CNY`;
    const response = await fetch(apiUrl);
    const data = (await response.json()) as ExchangeRateApiResponse;

    if (data.result === 'success') {
      return data.conversion_rates;
    }
    return null;
  } catch (error) {
    logger.error('Fetch exchange rates error', error);
    return null;
  }
}
