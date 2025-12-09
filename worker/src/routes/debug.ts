import { sendEmail } from '../services/email';
import { sendServerChanMessage } from '../services/serverchan';
import type { Env } from '../types/index';
import { errorResponse, jsonResponse, verifyToken } from '../utils';

/**
 * 获取用户通知配置和状态
 */
export async function getNotifyStatus(
  request: Request,
  env: Env,
): Promise<Response> {
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

  // 获取即将到期的订阅（详细信息）
  const { results: expiringSubscriptions } = await env.DB.prepare(`
    SELECT id, name, type, end_date, remind_days,
           date('now') as today,
           date('now', '+' || remind_days || ' days') as remind_until
    FROM subscriptions 
    WHERE user_id = ? 
      AND status = 'active' 
      AND one_time = 0
      AND date(end_date) >= date('now')
      AND date(end_date) <= date('now', '+' || remind_days || ' days')
  `)
    .bind(payload.userId)
    .all();

  // 获取所有活跃订阅用于对比
  const { results: allActiveSubscriptions } = await env.DB.prepare(`
    SELECT id, name, end_date, remind_days,
           date('now') as today,
           date('now', '+' || remind_days || ' days') as remind_until,
           CASE 
             WHEN date(end_date) < date('now') THEN 'expired'
             WHEN date(end_date) <= date('now', '+' || remind_days || ' days') THEN 'expiring'
             ELSE 'ok'
           END as notify_status
    FROM subscriptions 
    WHERE user_id = ? AND status = 'active' AND one_time = 0
    ORDER BY end_date ASC
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
            resendHoursSince >= ((user?.resend_notify_interval as number) ?? 24)),
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
            serverchanHoursSince >= ((user?.serverchan_notify_interval as number) ?? 24)),
      },
      subscriptions: {
        expiringCount: expiringSubscriptions.length,
        expiring: expiringSubscriptions,
        allActive: allActiveSubscriptions,
      },
    },
  });
}

/**
 * 强制发送通知（忽略时间和频率限制）
 */
export async function forceNotify(
  request: Request,
  env: Env,
): Promise<Response> {
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
      AND date(end_date) >= date('now')
      AND date(end_date) <= date('now', '+' || remind_days || ' days')
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
    const html = generateTestEmailHtml(subscriptions, user.site_url as string | undefined);
    results.email = await sendEmail(
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
  if ((type === 'all' || type === 'serverchan') && user.serverchan_api_key) {
    const content = generateServerChanContent(subscriptions, user.site_url as string | undefined);

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

/**
 * 重置上次发送时间
 */
export async function resetLastSent(
  request: Request,
  env: Env,
): Promise<Response> {
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

// 类型中文映射
const TYPE_LABELS: Record<string, string> = {
  domain: '域名',
  server: '服务器',
  membership: '会员',
  software: '软件',
  other: '其他',
};

/**
 * 生成 ServerChan 消息内容
 */
function generateServerChanContent(subscriptions: any[], siteUrl?: string): string {
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

/**
 * 生成测试邮件 HTML
 */
function generateTestEmailHtml(subscriptions: any[], siteUrl?: string): string {
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
