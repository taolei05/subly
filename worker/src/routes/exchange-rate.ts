import type { Env } from '../types/index';
import { jsonResponse, verifyToken } from '../utils';

// 默认汇率（备用）
const DEFAULT_RATES: Record<string, number> = {
  CNY: 1,
  HKD: 1.09,
  USD: 0.14,
  EUR: 0.8,
  GBP: 0.11,
};

// ExchangeRate API 响应类型
interface ExchangeRateApiResponse {
  result: string;
  conversion_rates: Record<string, number>;
}

/**
 * 获取汇率
 * 优先使用用户配置的 ExchangeRate API Key，否则返回默认汇率
 */
export async function getExchangeRate(
  request: Request,
  env: Env,
): Promise<Response> {
  const authHeader = request.headers.get('Authorization');

  // 尝试从用户设置获取 API Key
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const payload = await verifyToken(token);

      if (payload) {
        const user = await env.DB.prepare(
          'SELECT exchangerate_api_key FROM users WHERE id = ?',
        )
          .bind(payload.userId)
          .first<{ exchangerate_api_key: string }>();

        if (user?.exchangerate_api_key) {
          const rates = await fetchExchangeRates(user.exchangerate_api_key);
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
      console.error('Exchange rate API error:', e);
    }
  }

  // 返回默认汇率
  return jsonResponse({
    success: true,
    source: 'default',
    data: { base: 'CNY', rates: DEFAULT_RATES },
  });
}

/**
 * 从 ExchangeRate API 获取汇率
 */
async function fetchExchangeRates(
  apiKey: string,
): Promise<Record<string, number> | null> {
  try {
    const apiUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/CNY`;
    const response = await fetch(apiUrl);
    const data = (await response.json()) as ExchangeRateApiResponse;

    if (data.result === 'success') {
      return data.conversion_rates;
    }
    return null;
  } catch (error) {
    console.error('Fetch exchange rates error:', error);
    return null;
  }
}
