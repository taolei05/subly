import type { Env, Subscription, User } from '../types/index';
import { logger } from '../utils';

// ==================== 类型定义 ====================

export interface EmailData {
  to: string;
  subject: string;
  html: string;
}

// 类型中文映射
const TYPE_LABELS: Record<string, string> = {
  domain: '域名',
  server: '服务器',
  membership: '会员',
  software: '软件',
  other: '其他',
};

// ==================== 邮件发送 ====================

/**
 * 发送邮件 (使用 Resend API)
 */
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
      logger.error('Resend API error', { status: response.status, error: errorText });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Send email error', error);
    return false;
  }
}

// ==================== 邮件模板 ====================

/**
 * 生成提醒邮件 HTML
 */
export function generateReminderEmail(
  subscriptions: Subscription[],
  siteUrl?: string,
): string {
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

// ==================== 定时任务 ====================

/**
 * 检查是否应该发送通知（基于时间和频率）
 * 返回 { should: boolean, reason: string } 用于调试
 */
function shouldSendNotification(
  notifyTime: number | null | undefined,
  notifyInterval: number | null | undefined,
  lastSentAt: string | null | undefined,
  beijingHour: number,
): { should: boolean; reason: string } {
  const targetHour = notifyTime ?? 8;
  const intervalHours = notifyInterval ?? 24;

  // 检查是否在通知时间（允许1小时误差）
  if (beijingHour !== targetHour) {
    return { should: false, reason: `当前时间 ${beijingHour} 点，通知时间 ${targetHour} 点` };
  }

  // 从未发送过，直接发送
  if (!lastSentAt) {
    return { should: true, reason: '首次发送' };
  }

  // 检查距离上次发送的时间间隔
  const lastSent = new Date(lastSentAt);
  const now = new Date();
  const hoursSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);

  if (hoursSinceLastSent >= intervalHours) {
    return { should: true, reason: `距上次发送 ${hoursSinceLastSent.toFixed(1)} 小时，超过间隔 ${intervalHours} 小时` };
  }

  return { should: false, reason: `距上次发送 ${hoursSinceLastSent.toFixed(1)} 小时，未达间隔 ${intervalHours} 小时` };
}

/**
 * 检查并发送到期提醒 (由 Cron 触发)
 */
export async function checkAndSendEmailReminders(env: Env): Promise<void> {
  try {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const beijingHour = (utcHour + 8) % 24;

    logger.info('[Email] Checking reminders', { utcHour, beijingHour, timestamp: now.toISOString() });

    const { results: users } = await env.DB.prepare(
      `SELECT * FROM users 
       WHERE resend_api_key IS NOT NULL AND resend_api_key != ''
       AND (resend_enabled IS NULL OR resend_enabled = 1)`,
    ).all<User>();

    logger.info('[Email] Found users with Resend enabled', { count: users.length });

    for (const user of users) {
      const checkResult = shouldSendNotification(
        user.resend_notify_time,
        user.resend_notify_interval,
        user.resend_last_sent_at,
        beijingHour,
      );

      logger.info('[Email] User notification check', {
        userId: user.id,
        should: checkResult.should,
        reason: checkResult.reason,
        notifyTime: user.resend_notify_time ?? 8,
        lastSentAt: user.resend_last_sent_at,
      });

      if (!checkResult.should) {
        continue;
      }

      // 查询即将到期的订阅（到期日期在今天到 remind_days 天后之间）
      const { results: subscriptions } = await env.DB.prepare(`
        SELECT * FROM subscriptions 
        WHERE user_id = ? 
          AND status = 'active' 
          AND one_time = 0
          AND date(end_date) >= date('now')
          AND date(end_date) <= date('now', '+' || remind_days || ' days')
      `)
        .bind(user.id)
        .all<Subscription>();

      logger.info('[Email] Found expiring subscriptions', {
        userId: user.id,
        count: subscriptions.length,
        subscriptions: subscriptions.map(s => ({ name: s.name, end_date: s.end_date, remind_days: s.remind_days })),
      });

      if (subscriptions.length > 0) {
        const title = `[Subly] 您有 ${subscriptions.length} 个订阅即将到期`;
        const html = generateReminderEmail(subscriptions, user.site_url || undefined);

        logger.info('[Email] Sending reminder', { userId: user.id, email: user.email, count: subscriptions.length });

        const success = await sendEmail(
          user.resend_api_key as string,
          user.resend_domain || '',
          { to: user.email, subject: title, html },
        );

        if (success) {
          await env.DB.prepare(`UPDATE users SET resend_last_sent_at = ? WHERE id = ?`)
            .bind(now.toISOString(), user.id)
            .run();
          logger.info('[Email] Successfully sent', { userId: user.id });
        } else {
          logger.error('[Email] Failed to send', { userId: user.id });
        }
      } else {
        logger.info('[Email] No expiring subscriptions, skipping', { userId: user.id });
      }
    }
  } catch (error) {
    logger.error('[Email] Check reminders error', error);
  }
}
