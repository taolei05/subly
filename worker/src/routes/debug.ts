import { sendEmail } from '../services/email';
import { sendServerChanMessage } from '../services/serverchan';
import type { Env, Subscription } from '../types/index';
import { errorResponse, jsonResponse, verifyToken } from '../utils';

const TYPE_LABELS: Record<string, string> = {
  domain: '域名',
  server: '服务器',
  membership: '会员',
  software: '软件',
  other: '其他',
};

export async function getNotifyStatus(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse('未授权', 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);
  if (!payload) return errorResponse('无效的 Token', 401);

  const now = new Date();
  const utcHour = now.getUTCHours();
  const beijingHour = (utcHour + 8) % 24;
  const beijingDate = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 获取 Resend 配置
  const resendConfig = await env.DB.prepare(
    'SELECT email, api_key, notify_time, notify_interval, last_sent_at FROM resend_config WHERE user_id = ?',
  ).bind(payload.userId).first<{
    email: string;
    api_key: string;
    notify_time: number;
    notify_interval: number;
    last_sent_at: string;
  }>();

  // 获取 ServerChan 配置
  const serverchanConfig = await env.DB.prepare(
    'SELECT api_key, notify_time, notify_interval, last_sent_at FROM serverchan_config WHERE user_id = ?',
  ).bind(payload.userId).first<{
    api_key: string;
    notify_time: number;
    notify_interval: number;
    last_sent_at: string;
  }>();

  const resendLastSent = resendConfig?.last_sent_at ? new Date(resendConfig.last_sent_at) : null;
  const serverchanLastSent = serverchanConfig?.last_sent_at ? new Date(serverchanConfig.last_sent_at) : null;

  const resendHoursSince = resendLastSent
    ? (now.getTime() - resendLastSent.getTime()) / (1000 * 60 * 60)
    : null;
  const serverchanHoursSince = serverchanLastSent
    ? (now.getTime() - serverchanLastSent.getTime()) / (1000 * 60 * 60)
    : null;

  // 获取即将到期的订阅
  const { results: expiringSubscriptions } = await env.DB.prepare(`
    SELECT id, name, type, end_date, remind_days,
           ? as today,
           date(?, '+' || remind_days || ' days') as remind_until
    FROM subscriptions 
    WHERE user_id = ? 
      AND status = 'active' 
      AND one_time = 0
      AND date(end_date) >= date(?)
      AND date(end_date) <= date(?, '+' || remind_days || ' days')
  `).bind(beijingDate, beijingDate, payload.userId, beijingDate, beijingDate).all();

  // 获取所有活跃订阅
  const { results: allActiveSubscriptions } = await env.DB.prepare(`
    SELECT id, name, end_date, remind_days,
           ? as today,
           date(?, '+' || remind_days || ' days') as remind_until,
           CASE 
             WHEN date(end_date) < date(?) THEN 'expired'
             WHEN date(end_date) <= date(?, '+' || remind_days || ' days') THEN 'expiring'
             ELSE 'ok'
           END as notify_status
    FROM subscriptions 
    WHERE user_id = ? AND status = 'active' AND one_time = 0
    ORDER BY end_date ASC
  `).bind(beijingDate, beijingDate, beijingDate, beijingDate, payload.userId).all();

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
        configured: !!resendConfig?.api_key,
        notifyTime: resendConfig?.notify_time ?? 8,
        notifyInterval: resendConfig?.notify_interval ?? 24,
        lastSentAt: resendConfig?.last_sent_at || null,
        hoursSinceLastSent: resendHoursSince?.toFixed(2) || null,
        wouldSendNow:
          !!resendConfig?.api_key &&
          beijingHour === (resendConfig?.notify_time ?? 8) &&
          (resendHoursSince === null || resendHoursSince >= (resendConfig?.notify_interval ?? 24)),
      },
      serverchan: {
        configured: !!serverchanConfig?.api_key,
        notifyTime: serverchanConfig?.notify_time ?? 8,
        notifyInterval: serverchanConfig?.notify_interval ?? 24,
        lastSentAt: serverchanConfig?.last_sent_at || null,
        hoursSinceLastSent: serverchanHoursSince?.toFixed(2) || null,
        wouldSendNow:
          !!serverchanConfig?.api_key &&
          beijingHour === (serverchanConfig?.notify_time ?? 8) &&
          (serverchanHoursSince === null || serverchanHoursSince >= (serverchanConfig?.notify_interval ?? 24)),
      },
      subscriptions: {
        expiringCount: expiringSubscriptions.length,
        expiring: expiringSubscriptions,
        allActive: allActiveSubscriptions,
      },
    },
  });
}

export async function forceNotify(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse('未授权', 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);
  if (!payload) return errorResponse('无效的 Token', 401);

  const body = (await request.json()) as { type?: 'email' | 'serverchan' | 'all' };
  const type = body.type || 'all';

  // 获取用户信息
  const user = await env.DB.prepare('SELECT site_url FROM users WHERE id = ?')
    .bind(payload.userId)
    .first<{ site_url?: string }>();

  if (!user) return errorResponse('用户不存在', 404);

  const now = new Date();
  const beijingDate = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { results: subscriptions } = await env.DB.prepare(`
    SELECT * FROM subscriptions 
    WHERE user_id = ? 
      AND status = 'active' 
      AND one_time = 0
      AND date(end_date) >= date(?)
      AND date(end_date) <= date(?, '+' || remind_days || ' days')
  `).bind(payload.userId, beijingDate, beijingDate).all<Subscription>();

  if (subscriptions.length === 0) {
    return jsonResponse({ success: false, message: '没有即将到期的订阅，无需发送通知' });
  }

  const results: { email?: boolean; serverchan?: boolean } = {};
  const title = `[Subly] 您有 ${subscriptions.length} 个订阅即将到期`;

  // 发送邮件
  if (type === 'all' || type === 'email') {
    const resendConfig = await env.DB.prepare('SELECT email, api_key, domain FROM resend_config WHERE user_id = ?')
      .bind(payload.userId)
      .first<{ email: string; api_key: string; domain?: string }>();

    if (resendConfig?.api_key) {
      const html = generateTestEmailHtml(subscriptions, user.site_url);
      results.email = await sendEmail(resendConfig.api_key, resendConfig.domain || '', {
        to: resendConfig.email,
        subject: title,
        html,
      });

      if (results.email) {
        await env.DB.prepare('UPDATE resend_config SET last_sent_at = ? WHERE user_id = ?')
          .bind(now.toISOString(), payload.userId)
          .run();
      }
    }
  }

  // 发送 ServerChan
  if (type === 'all' || type === 'serverchan') {
    const serverchanConfig = await env.DB.prepare('SELECT api_key FROM serverchan_config WHERE user_id = ?')
      .bind(payload.userId)
      .first<{ api_key: string }>();

    if (serverchanConfig?.api_key) {
      const content = generateServerChanContent(subscriptions, user.site_url);
      const result = await sendServerChanMessage(serverchanConfig.api_key, title, content);
      results.serverchan = result.code === 0;

      if (results.serverchan) {
        await env.DB.prepare('UPDATE serverchan_config SET last_sent_at = ? WHERE user_id = ?')
          .bind(now.toISOString(), payload.userId)
          .run();
      }
    }
  }

  return jsonResponse({
    success: true,
    message: '强制发送完成',
    data: { subscriptionCount: subscriptions.length, results },
  });
}

export async function resetLastSent(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse('未授权', 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);
  if (!payload) return errorResponse('无效的 Token', 401);

  const body = (await request.json()) as { type?: 'email' | 'serverchan' | 'all' };
  const type = body.type || 'all';

  if (type === 'all' || type === 'email') {
    await env.DB.prepare('UPDATE resend_config SET last_sent_at = NULL WHERE user_id = ?')
      .bind(payload.userId)
      .run();
  }

  if (type === 'all' || type === 'serverchan') {
    await env.DB.prepare('UPDATE serverchan_config SET last_sent_at = NULL WHERE user_id = ?')
      .bind(payload.userId)
      .run();
  }

  return jsonResponse({ success: true, message: `已重置 ${type} 的上次发送时间` });
}

function generateServerChanContent(subscriptions: Subscription[], siteUrl?: string): string {
  const sendTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const tableRows = subscriptions
    .map((sub) => `| ${sub.name} | ${TYPE_LABELS[sub.type] || sub.type} | ${sub.end_date} |`)
    .join('\n');

  return `
## ⏰ 订阅到期提醒

您有以下订阅即将到期，请及时处理：

| 服务名称 | 类型 | 到期日期 |
| :--- | :--- | :--- |
${tableRows}

---

| 项目 | 内容 |
| :--- | :--- |
| 发送时间 | ${sendTime} |
| 到期数量 | ${subscriptions.length} 个 |

${siteUrl ? `[👉 查看详情](${siteUrl})` : ''}

---

*这是一条强制发送的测试消息。*
`.trim();
}

function generateTestEmailHtml(subscriptions: Subscription[], siteUrl?: string): string {
  const items = subscriptions
    .map(
      (sub) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${sub.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${TYPE_LABELS[sub.type] || sub.type}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${sub.end_date}</td>
    </tr>
  `,
    )
    .join('');

  const viewDetailsButton = siteUrl
    ? `<div style="margin-top: 20px; text-align: center;">
        <a href="${siteUrl}" style="display: inline-block; background: #18a058; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 14px;">查看详情</a>
      </div>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>订阅到期提醒</title></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #18a058; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Subly 订阅提醒 (强制测试)</h1>
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
        ${viewDetailsButton}
        <p style="margin-top: 20px; color: #666; font-size: 14px;">这是一封强制发送的测试邮件。</p>
      </div>
    </body>
    </html>
  `;
}
