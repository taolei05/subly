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
  batchDeleteSubscriptions,
  batchUpdateRemindDays,
  createSubscription,
  deleteSubscription,
  exportSubscriptions,
  getSubscription,
  getSubscriptions,
  importSubscriptions,
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

        // 导出订阅
        if (apiPath === '/subscriptions/export' && method === 'GET') {
          return await exportSubscriptions(request, env);
        }

        // 导入订阅
        if (apiPath === '/subscriptions/import' && method === 'POST') {
          return await importSubscriptions(request, env);
        }

        // 批量删除
        if (apiPath === '/subscriptions/batch' && method === 'DELETE') {
          return await batchDeleteSubscriptions(request, env);
        }

        // 批量修改提醒天数
        if (apiPath === '/subscriptions/batch' && method === 'PATCH') {
          return await batchUpdateRemindDays(request, env);
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

        // 调试：查看用户通知配置和状态
        if (apiPath === '/debug/notify-status' && method === 'GET') {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader?.startsWith('Bearer ')) {
            return errorResponse('未授权', 401);
          }
          const token = authHeader.slice(7);
          const payload = await verifyToken(token);
          if (!payload) return errorResponse('无效的 Token', 401);

          const user = await env.DB.prepare(
            `SELECT id, email, resend_api_key, resend_notify_time, resend_notify_interval, resend_last_sent_at,
                    serverchan_api_key, serverchan_notify_time, serverchan_notify_interval, serverchan_last_sent_at
             FROM users WHERE id = ?`,
          )
            .bind(payload.userId)
            .first();

          const now = new Date();
          const utcHour = now.getUTCHours();
          const beijingHour = (utcHour + 8) % 24;

          // 计算距离上次发送的时间
          const resendLastSent = user?.resend_last_sent_at
            ? new Date(user.resend_last_sent_at as string)
            : null;
          const serverchanLastSent = user?.serverchan_last_sent_at
            ? new Date(user.serverchan_last_sent_at as string)
            : null;

          const resendHoursSince = resendLastSent
            ? (now.getTime() - resendLastSent.getTime()) / (1000 * 60 * 60)
            : null;
          const serverchanHoursSince = serverchanLastSent
            ? (now.getTime() - serverchanLastSent.getTime()) / (1000 * 60 * 60)
            : null;

          // 获取即将到期的订阅数量
          const { results: subscriptions } = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM subscriptions 
            WHERE user_id = ? 
              AND status = 'active' 
              AND one_time = 0
              AND date(end_date) BETWEEN date('now') AND date('now', '+' || remind_days || ' days')
          `)
            .bind(payload.userId)
            .all();

          return jsonResponse({
            success: true,
            data: {
              currentTime: {
                utc: now.toISOString(),
                utcHour,
                beijingHour,
                beijingTime: `${String(beijingHour).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`,
              },
              resend: {
                configured: !!user?.resend_api_key,
                notifyTime: user?.resend_notify_time ?? 8,
                notifyInterval: user?.resend_notify_interval ?? 24,
                lastSentAt: user?.resend_last_sent_at || null,
                hoursSinceLastSent: resendHoursSince?.toFixed(2) || null,
                wouldSendNow:
                  !!user?.resend_api_key &&
                  beijingHour === (user?.resend_notify_time ?? 8) &&
                  (resendHoursSince === null ||
                    resendHoursSince >= (user?.resend_notify_interval ?? 24)),
              },
              serverchan: {
                configured: !!user?.serverchan_api_key,
                notifyTime: user?.serverchan_notify_time ?? 8,
                notifyInterval: user?.serverchan_notify_interval ?? 24,
                lastSentAt: user?.serverchan_last_sent_at || null,
                hoursSinceLastSent: serverchanHoursSince?.toFixed(2) || null,
                wouldSendNow:
                  !!user?.serverchan_api_key &&
                  beijingHour === (user?.serverchan_notify_time ?? 8) &&
                  (serverchanHoursSince === null ||
                    serverchanHoursSince >=
                      (user?.serverchan_notify_interval ?? 24)),
              },
              expiringSubscriptions: (subscriptions[0] as { count: number })
                ?.count,
            },
          });
        }

        // 调试：强制发送通知（忽略时间和频率限制）
        if (apiPath === '/debug/force-notify' && method === 'POST') {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader?.startsWith('Bearer ')) {
            return errorResponse('未授权', 401);
          }
          const token = authHeader.slice(7);
          const payload = await verifyToken(token);
          if (!payload) return errorResponse('无效的 Token', 401);

          const body = (await request.json()) as {
            type?: 'email' | 'serverchan' | 'all';
          };
          const type = body.type || 'all';

          const user = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`)
            .bind(payload.userId)
            .first();

          if (!user) return errorResponse('用户不存在', 404);

          const { results: subscriptions } = await env.DB.prepare(`
            SELECT * FROM subscriptions 
            WHERE user_id = ? 
              AND status = 'active' 
              AND one_time = 0
              AND date(end_date) BETWEEN date('now') AND date('now', '+' || remind_days || ' days')
          `)
            .bind(payload.userId)
            .all();

          const results: { email?: boolean; serverchan?: boolean } = {};

          if (subscriptions.length === 0) {
            return jsonResponse({
              success: false,
              message: '没有即将到期的订阅，无需发送通知',
            });
          }

          const title = `[Subly] 您有 ${subscriptions.length} 个订阅即将到期`;

          // 发送邮件
          if ((type === 'all' || type === 'email') && user.resend_api_key) {
            const { sendEmail: sendEmailFn } = await import('./services/email');
            const items = subscriptions
              .map(
                (sub: any) => `
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">${sub.name}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">${sub.type}</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">${sub.end_date}</td>
              </tr>
            `,
              )
              .join('');

            const html = `
              <!DOCTYPE html>
              <html>
              <head><meta charset="utf-8"><title>订阅到期提醒</title></head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #18a058; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; font-size: 24px;">Subly 订阅提醒 (测试)</h1>
                </div>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px;">
                  <p>您有以下订阅即将到期：</p>
                  <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px;">
                    <thead>
                      <tr style="background: #f8f8f8;">
                        <th style="padding: 12px; text-align: left;">服务名称</th>
                        <th style="padding: 12px; text-align: left;">类型</th>
                        <th style="padding: 12px; text-align: left;">到期日期</th>
                      </tr>
                    </thead>
                    <tbody>${items}</tbody>
                  </table>
                </div>
              </body>
              </html>
            `;

            results.email = await sendEmailFn(
              user.resend_api_key as string,
              (user.resend_domain as string) || '',
              { to: user.email as string, subject: title, html },
            );

            if (results.email) {
              await env.DB.prepare(
                `UPDATE users SET resend_last_sent_at = ? WHERE id = ?`,
              )
                .bind(new Date().toISOString(), payload.userId)
                .run();
            }
          }

          // 发送 ServerChan
          if (
            (type === 'all' || type === 'serverchan') &&
            user.serverchan_api_key
          ) {
            const { sendServerChanMessage } = await import(
              './services/serverchan'
            );
            const content =
              subscriptions
                .map(
                  (sub: any) =>
                    `- **${sub.name}** (${sub.type}): ${sub.end_date} 到期`,
                )
                .join('\n\n') + '\n\n请及时处理。';

            const result = await sendServerChanMessage(
              user.serverchan_api_key as string,
              title,
              content,
            );
            results.serverchan = result.code === 0;

            if (results.serverchan) {
              await env.DB.prepare(
                `UPDATE users SET serverchan_last_sent_at = ? WHERE id = ?`,
              )
                .bind(new Date().toISOString(), payload.userId)
                .run();
            }
          }

          return jsonResponse({
            success: true,
            message: '强制发送完成',
            data: {
              subscriptionCount: subscriptions.length,
              results,
            },
          });
        }

        // 调试：重置上次发送时间
        if (apiPath === '/debug/reset-last-sent' && method === 'POST') {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader?.startsWith('Bearer ')) {
            return errorResponse('未授权', 401);
          }
          const token = authHeader.slice(7);
          const payload = await verifyToken(token);
          if (!payload) return errorResponse('无效的 Token', 401);

          const body = (await request.json()) as {
            type?: 'email' | 'serverchan' | 'all';
          };
          const type = body.type || 'all';

          if (type === 'all' || type === 'email') {
            await env.DB.prepare(
              `UPDATE users SET resend_last_sent_at = NULL WHERE id = ?`,
            )
              .bind(payload.userId)
              .run();
          }

          if (type === 'all' || type === 'serverchan') {
            await env.DB.prepare(
              `UPDATE users SET serverchan_last_sent_at = NULL WHERE id = ?`,
            )
              .bind(payload.userId)
              .run();
          }

          return jsonResponse({
            success: true,
            message: `已重置 ${type} 的上次发送时间`,
          });
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
