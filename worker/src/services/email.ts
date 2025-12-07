import type { Env, Subscription, User } from '../types';

// ... (existing imports and interface)

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
  // ... (existing implementation)
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

    return response.ok;
  } catch (error) {
    console.error('Send email error:', error);
    return false;
  }
}

// 生成提醒邮件 HTML
function generateReminderEmail(subscriptions: Subscription[]): string {
  // ... (existing implementation)
  const items = subscriptions
    .map(
      (sub) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${sub.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${sub.type}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${sub.end_date}</td>
    </tr>
  `,
    )
    .join('');

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
        <p style="margin-top: 20px; color: #666; font-size: 14px;">
          这是一封自动发送的邮件，请勿直接回复。
        </p>
      </div>
    </body>
    </html>
  `;
}

// 检查并发送到期提醒 (由 Cron 触发，每小时执行一次)
export async function checkAndSendEmailReminders(env: Env): Promise<void> {
  try {
    // 获取当前北京时间的小时 (0-23)
    // 假设服务器时区为 UTC，需要加 8 小时
    const now = new Date();
    const utcHour = now.getUTCHours();
    const beijingHour = (utcHour + 8) % 24;

    console.log(`Checking reminders for hour: ${beijingHour} (Beijing Time)`);

    // 获取所有配置了通知方式且设定通知时间为当前小时的用户
    // 如果通知时间为空，默认为 8 点
    // 必须配置 Resend API Key 或 ServerChan Token 且对应通知时间匹配
    const { results: users } = await env.DB.prepare(
      `SELECT * FROM users 
       WHERE (resend_api_key IS NOT NULL AND resend_api_key != '')
       AND (resend_notify_time = ? OR (resend_notify_time IS NULL AND ? = 8))`,
    )
      .bind(beijingHour, beijingHour)
      .all<User>();

    console.log(`Found ${users.length} users to check`);

    for (const user of users) {
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

        const isEmailTime =
          user.resend_notify_time === beijingHour ||
          (user.resend_notify_time == null && beijingHour === 8);
        if (user.resend_api_key && isEmailTime) {
          const html = generateReminderEmail(subscriptions);
          await sendEmail(user.resend_api_key, user.resend_domain || '', {
            to: user.email,
            subject: title,
            html,
          });
        }
      }
    }
  } catch (error) {
    console.error('Check reminders error:', error);
  }
}
