import type { Env, Subscription, User } from '../types/index';
import { logger } from '../utils';

// ==================== 类型定义 ====================

export interface ServerChanResponse {
  code: number;
  message: string;
  data: {
    pushid?: string;
    readkey?: string;
    error?: string;
    errno?: number;
  };
}

// ==================== 消息发送 ====================

/**
 * 发送 Server酱消息
 */
export async function sendServerChanMessage(
  token: string,
  title: string,
  content: string,
): Promise<ServerChanResponse> {
  try {
    const baseUrl = `https://sctapi.ftqq.com/${token}.send`;
    const params = new URLSearchParams();
    params.append('title', title);
    params.append('desp', content);

    // 尝试 POST 请求
    const postResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const postResult = (await postResponse.json()) as ServerChanResponse;
    if (postResult.code === 0) return postResult;

    // POST 失败，尝试 GET 请求
    const getUrl = `${baseUrl}?${params.toString()}`;
    const getResponse = await fetch(getUrl, { method: 'GET' });
    const getResult = (await getResponse.json()) as ServerChanResponse;
    if (getResult.code === 0) return getResult;

    // 尝试旧版 API
    const legacyParams = new URLSearchParams();
    legacyParams.append('text', title);
    legacyParams.append('desp', content);
    const legacyUrl = `https://sc.ftqq.com/${token}.send?${legacyParams.toString()}`;
    const legacyResponse = await fetch(legacyUrl, { method: 'GET' });
    return (await legacyResponse.json()) as ServerChanResponse;
  } catch (error) {
    logger.error('[ServerChan] Send error', error);
    return {
      code: -1,
      message: String(error),
      data: { error: 'FETCH_ERROR', errno: -1 },
    };
  }
}

// ==================== 消息模板 ====================

// 类型中文映射
const TYPE_LABELS: Record<string, string> = {
  domain: '域名',
  server: '服务器',
  membership: '会员',
  software: '软件',
  other: '其他',
};

/**
 * 生成提醒消息内容 (Markdown 格式)
 */
function generateReminderContent(
  subscriptions: Subscription[],
  siteUrl?: string,
): string {
  const tableRows = subscriptions
    .map(
      (sub) =>
        `| ${sub.name} | ${TYPE_LABELS[sub.type] || sub.type} | ${sub.end_date} |`,
    )
    .join('\n');

  return `
## ⏰ 订阅到期提醒

您有以下订阅即将到期，请及时处理：

| 服务名称 | 类型 | 到期日期 |
| :--- | :--- | :--- |
${tableRows}

${siteUrl ? `\n[👉 查看详情](${siteUrl})` : ''}

---

*这是一条自动发送的消息，请勿直接回复。*
`.trim();
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

  // 检查是否在通知时间
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
 * 检查并发送 Server酱提醒 (由 Cron 触发)
 */
export async function checkAndSendServerChanReminders(env: Env): Promise<void> {
  try {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const beijingHour = (utcHour + 8) % 24;

    logger.info('[ServerChan] Checking reminders', { utcHour, beijingHour, timestamp: now.toISOString() });

    const { results: users } = await env.DB.prepare(
      `SELECT * FROM users 
       WHERE serverchan_api_key IS NOT NULL AND serverchan_api_key != ''
       AND (serverchan_enabled IS NULL OR serverchan_enabled = 1)`,
    ).all<User>();

    logger.info('[ServerChan] Found users with ServerChan enabled', { count: users.length });

    for (const user of users) {
      const checkResult = shouldSendNotification(
        user.serverchan_notify_time,
        user.serverchan_notify_interval,
        user.serverchan_last_sent_at,
        beijingHour,
      );

      logger.info('[ServerChan] User notification check', {
        userId: user.id,
        should: checkResult.should,
        reason: checkResult.reason,
        notifyTime: user.serverchan_notify_time ?? 8,
        lastSentAt: user.serverchan_last_sent_at,
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

      logger.info('[ServerChan] Found expiring subscriptions', {
        userId: user.id,
        count: subscriptions.length,
        subscriptions: subscriptions.map(s => ({ name: s.name, end_date: s.end_date, remind_days: s.remind_days })),
      });

      if (subscriptions.length > 0) {
        const title = `[Subly] 您有 ${subscriptions.length} 个订阅即将到期`;
        const content = generateReminderContent(subscriptions, user.site_url);

        logger.info('[ServerChan] Sending reminder', { userId: user.id, count: subscriptions.length });

        const result = await sendServerChanMessage(
          user.serverchan_api_key as string,
          title,
          content,
        );

        if (result.code === 0) {
          await env.DB.prepare(`UPDATE users SET serverchan_last_sent_at = ? WHERE id = ?`)
            .bind(now.toISOString(), user.id)
            .run();
          logger.info('[ServerChan] Successfully sent', { userId: user.id });
        } else {
          logger.error('[ServerChan] Failed to send', { userId: user.id, message: result.message });
        }
      } else {
        logger.info('[ServerChan] No expiring subscriptions, skipping', { userId: user.id });
      }
    }
  } catch (error) {
    logger.error('[ServerChan] Check reminders error', error);
  }
}
