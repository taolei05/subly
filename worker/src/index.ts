import {
  getMe,
  login,
  register,
  sendTestServerChan,
  updateProfile,
  updateSettings,
} from './routes/auth';
import { sendTestEmail } from './routes/email';
import {
  createSubscription,
  deleteSubscription,
  getSubscription,
  getSubscriptions,
  updateSubscription,
  updateSubscriptionStatus,
} from './routes/subscriptions';
import { checkAndSendEmailReminders, sendEmail } from './services/email';
import { checkAndSendServerChanReminders } from './services/serverchan';
import type { Env } from './types';
import { corsHeaders, errorResponse, jsonResponse, verifyToken } from './utils';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // 处理 CORS 预检请求
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // API 路由
      if (path.startsWith('/api/')) {
        const apiPath = path.slice(4); // 移除 /api 前缀

        // 认证路由
        if (apiPath === '/auth/register' && method === 'POST') {
          return await register(request, env);
        }
        if (apiPath === '/auth/test-email' && method === 'POST') {
          return await sendTestEmail(request, env);
        }
        if (apiPath === '/auth/test-serverchan' && method === 'POST') {
          return await sendTestServerChan(request, env);
        }
        if (apiPath === '/auth/login' && method === 'POST') {
          return await login(request, env);
        }
        if (apiPath === '/auth/me' && method === 'GET') {
          return await getMe(request, env);
        }

        if (apiPath === '/auth/profile' && method === 'PUT') {
          return await import('./routes/auth').then((m) =>
            m.updateProfile(request, env),
          );
        }

        // 设置路由
        if (apiPath === '/settings' && method === 'PUT') {
          return await updateSettings(request, env);
        }

        // 订阅路由
        if (apiPath === '/subscriptions' && method === 'GET') {
          return await getSubscriptions(request, env);
        }
        if (apiPath === '/subscriptions' && method === 'POST') {
          return await createSubscription(request, env);
        }

        // 带 ID 的订阅路由
        const subscriptionMatch = apiPath.match(/^\/subscriptions\/(\d+)$/);
        if (subscriptionMatch) {
          const id = subscriptionMatch[1];
          if (method === 'GET') return await getSubscription(request, env, id);
          if (method === 'PUT')
            return await updateSubscription(request, env, id);
          if (method === 'DELETE')
            return await deleteSubscription(request, env, id);
        }

        // 订阅状态路由
        const statusMatch = apiPath.match(/^\/subscriptions\/(\d+)\/status$/);
        if (statusMatch && method === 'PUT') {
          return await updateSubscriptionStatus(request, env, statusMatch[1]);
        }

        // 汇率 API
        if (apiPath === '/exchange-rate' && method === 'GET') {
          // 默认汇率（备用）
          const defaultRates = {
            CNY: 1,
            HKD: 1.09,
            USD: 0.14,
            EUR: 0.13,
            GBP: 0.11,
          };

          // 尝试从用户设置获取 API Key
          const authHeader = request.headers.get('Authorization');
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
                  // 调用 ExchangeRate API
                  const apiUrl = `https://v6.exchangerate-api.com/v6/${user.exchangerate_api_key}/latest/CNY`;
                  const response = await fetch(apiUrl);
                  const data = (await response.json()) as {
                    result: string;
                    conversion_rates: Record<string, number>;
                  };

                  if (data.result === 'success') {
                    return jsonResponse({
                      success: true,
                      source: 'exchangerate-api',
                      data: {
                        base: 'CNY',
                        rates: {
                          CNY: 1,
                          HKD: data.conversion_rates.HKD || defaultRates.HKD,
                          USD: data.conversion_rates.USD || defaultRates.USD,
                          EUR: data.conversion_rates.EUR || defaultRates.EUR,
                          GBP: data.conversion_rates.GBP || defaultRates.GBP,
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
            data: { base: 'CNY', rates: defaultRates },
          });
        }

        // 测试邮件发送（手动触发提醒检查）
        if (apiPath === '/test-reminder' && method === 'POST') {
          await checkAndSendEmailReminders(env);
          await checkAndSendServerChanReminders(env);
          return jsonResponse({ success: true, message: '提醒检查已触发' });
        }

        // 发送测试邮件（系统设置页）
        if (apiPath === '/email/test' && method === 'POST') {
          try {
            const authHeader = request.headers.get('Authorization');
            if (!authHeader?.startsWith('Bearer ')) {
              return errorResponse('未授权', 401);
            }
            const token = authHeader.slice(7);
            const payload = await verifyToken(token);
            if (!payload) return errorResponse('无效的 Token', 401);

            const user = await env.DB.prepare(
              'SELECT email FROM users WHERE id = ?',
            )
              .bind(payload.userId)
              .first<{ email: string }>();

            if (!user) return errorResponse('用户不存在', 404);

            const body = (await request.json()) as {
              resend_api_key: string;
              resend_domain: string;
            };
            if (!body.resend_api_key)
              return errorResponse('Resend API Key 不能为空', 400);

            const success = await sendEmail(
              body.resend_api_key,
              body.resend_domain,
              {
                to: user.email,
                subject: '[Subly] 测试邮件',
                html: `
                                <div style="font-family: sans-serif; padding: 20px;">
                                    <h1>邮件配置测试成功</h1>
                                    <p>恭喜！这封邮件证明您的 Resend API Key 或域名配置正确。</p>
                                    <p>时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
                                </div>
                            `,
              },
            );

            if (success) {
              return jsonResponse({
                success: true,
                message: '测试邮件发送成功，请检查邮箱',
              });
            } else {
              return errorResponse('测试邮件发送失败，请检查配置', 500);
            }
          } catch (e) {
            const errorMessage =
              e instanceof Error ? e.message : 'Unknown error';
            console.error('Email test error:', e);
            return errorResponse(
              `发送测试邮件时发生错误: ${errorMessage}`,
              500,
            );
          }
        }

        return errorResponse('API 路由不存在', 404);
      }

      // 静态文件服务
      let response = await env.ASSETS?.fetch(request);

      // SPA 路由回退：如果资源未找到 (404) 且是 GET 请求，返回 index.html
      // 这确保了像 /settings 这样的前端路由在刷新时也能正常工作
      if ((!response || response.status === 404) && request.method === 'GET') {
        response = await env.ASSETS?.fetch(new URL('/', request.url));
      }

      return response || new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Worker global error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  // 定时任务处理
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await checkAndSendEmailReminders(env);
    await checkAndSendServerChanReminders(env);
  },
};
