import type { Env, Subscription, User } from '../types';

export interface EmailData {
  to: string;
  subject: string;
  html: string;
}

// 发送邮件 (使用 Resend API)
export async function sendEmail(
  apiKey: string,
  domain: string,
  data: EmailData,
): Promise<boolean> {
  try {
    const fromEmail = domain
      ? `Subly <noreply@${domain}>`
      : 'Subly <onboarding@resend.dev>';

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: data.to,
        subject: data.subject,
        html: data.html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resend API error:', response.status, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Send email error:', error);
    return false;
  }
}

// 类型中文映射
const typeLabels: Record<string, string> = {
  domain: '域名',
  server: '服务器',
  membership: '会员',
  software: '软件',
  other: '其他',
};

// 生成提醒邮件 HTML
export function generateReminderEmail(
  subscriptions: Subscription[],
  siteUrl?: string,
): string {
  const items = subscriptions
    .map(
      (sub) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${sub.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${typeLabels[sub.type] || sub.type}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${sub.end_date}</td>
    </tr>
  `,
    )
    .join('');

  // Conditionally render "查看详情" button when siteUrl is provided
  const viewDetailsButton = siteUrl
    ? `
        <div style="margin-top: 20px; text-align: center;">
          <a href="${siteUrl}" style="display: inline-block; background: #18a058; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 14px;">查看详情</a>
        </div>
      `
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>订阅到期提醒</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #18a058; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Subly 订阅提醒</h1>
      </div>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px;">
        <p>您有以下订阅即将到期，请及时处理：</p>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #f8f8f8;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #eee;">服务名称</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #eee;">类型</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #eee;">到期日期</th>
            </tr>
          </thead>
          <tbody>
            ${items}
          </tbody>
        </table>
        ${viewDetailsButton}
        <p style="margin-top: 20px; color: #666; font-size: 14px;">
          这是一封自动发送的邮件，请勿直接回复。
        </p>
      </div>
    </body>
    </html>
  `;
}

// 检查是否应该发送通知（基于时间和频率）
function shouldSendNotification(
  notifyTime: number | null | undefined,
  notifyInterval: number | null | undefined,
  lastSentAt: string | null | undefined,
  beijingHour: number,
): boolean {
  // 默认通知时间为8点，默认间隔为24小时
  const targetHour = notifyTime ?? 8;
  const intervalHours = notifyInterval ?? 24;

  // 检查当前小时是否匹配通知时间
  if (beijingHour !== targetHour) {
    return false;
  }

  // 如果没有上次发送记录，应该发送
  if (!lastSentAt) {
    return true;
  }

  // 计算距离上次发送的小时数
  const lastSent = new Date(lastSentAt);
  const now = new Date();
  const hoursSinceLastSent =
    (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);

  // 如果超过间隔时间，应该发送
  return hoursSinceLastSent >= intervalHours;
}

// 检查并发送到期提醒 (由 Cron 触发，每小时执行一次)
export async function checkAndSendEmailReminders(env: Env): Promise<void> {
  try {
    // 获取当前北京时间的小时 (0-23)
    const now = new Date();
    const utcHour = now.getUTCHours();
    const beijingHour = (utcHour + 8) % 24;

    console.log(`[Email] Checking reminders at Beijing hour: ${beijingHour}`);

    // 获取所有配置了 Resend API Key 且启用了邮件提醒的用户
    const { results: users } = await env.DB.prepare(
      `SELECT * FROM users 
       WHERE resend_api_key IS NOT NULL AND resend_api_key != ''
       AND (resend_enabled IS NULL OR resend_enabled = 1)`,
    ).all<User>();

    console.log(`[Email] Found ${users.length} users with Resend enabled`);

    for (const user of users) {
      // 检查是否应该发送通知
      if (
        !shouldSendNotification(
          user.resend_notify_time,
          user.resend_notify_interval,
          user.resend_last_sent_at,
          beijingHour,
        )
      ) {
        continue;
      }

      // 获取该用户即将到期的订阅（非一次性，非停用）
      const { results: subscriptions } = await env.DB.prepare(`
        SELECT * FROM subscriptions 
        WHERE user_id = ? 
          AND status = 'active' 
          AND one_time = 0
          AND date(end_date) BETWEEN date('now') AND date('now', '+' || remind_days || ' days')
      `)
        .bind(user.id)
        .all<Subscription>();

      if (subscriptions.length > 0) {
        const title = `[Subly] 您有 ${subscriptions.length} 个订阅即将到期`;
        const html = generateReminderEmail(
          subscriptions,
          user.site_url || undefined,
        );

        console.log(
          `[Email] Sending reminder to user ${user.id} (${user.email})`,
        );

        const success = await sendEmail(
          user.resend_api_key as string,
          user.resend_domain || '',
          {
            to: user.email,
            subject: title,
            html,
          },
        );

        if (success) {
          // 更新上次发送时间
          await env.DB.prepare(
            `UPDATE users SET resend_last_sent_at = ? WHERE id = ?`,
          )
            .bind(now.toISOString(), user.id)
            .run();
          console.log(`[Email] Successfully sent to user ${user.id}`);
        } else {
          console.error(`[Email] Failed to send to user ${user.id}`);
        }
      }
    }
  } catch (error) {
    console.error('[Email] Check reminders error:', error);
  }
}
