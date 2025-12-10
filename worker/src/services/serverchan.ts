import type { Env, Subscription } from '../types/index';
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

    const postResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const postResult = (await postResponse.json()) as ServerChanResponse;
    if (postResult.code === 0) return postResult;

    const getUrl = `${baseUrl}?${params.toString()}`;
    const getResponse = await fetch(getUrl, { method: 'GET' });
    const getResult = (await getResponse.json()) as ServerChanResponse;
    if (getResult.code === 0) return getResult;

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

const TYPE_LABELS: Record<string, string> = {
  domain: '域名',
  server: '服务器',
  membership: '会员',
  software: '软件',
  other: '其他',
};

function generateReminderContent(subscriptions: Subscription[], siteUrl?: string): string {
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

*这是一条自动发送的消息，请勿直接回复。*
`.trim();
}

// ==================== 定时任务 ====================

function shouldSendNotification(
  notifyTime: number | null | undefined,
  notifyInterval: number | null | undefined,
  lastSentAt: string | null | undefined,
  beijingHour: number,
): { should: boolean; reason: string } {
  const targetHour = notifyTime ?? 8;
  const intervalHours = notifyInterval ?? 24;

  if (beijingHour !== targetHour) {
    return { should: false, reason: `当前时间 ${beijingHour} 点，通知时间 ${targetHour} 点` };
  }

  if (!lastSentAt) {
    return { should: true, reason: '首次发送' };
  }

  const lastSent = new Date(lastSentAt);
  const now = new Date();
  const hoursSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);

  if (hoursSinceLastSent >= intervalHours) {
    return { should: true, reason: `距上次发送 ${hoursSinceLastSent.toFixed(1)} 小时，超过间隔 ${intervalHours} 小时` };
  }

  return { should: false, reason: `距上次发送 ${hoursSinceLastSent.toFixed(1)} 小时，未达间隔 ${intervalHours} 小时` };
}

// 用于定时任务的聚合查询结果类型
interface UserServerChanConfig {
  user_id: number;
  site_url?: string;
  api_key: string;
  notify_time: number;
  notify_interval: number;
  last_sent_at?: string;
  enabled: number;
}

export async function checkAndSendServerChanReminders(env: Env): Promise<void> {
  try {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const beijingHour = (utcHour + 8) % 24;

    logger.info('[ServerChan] Checking reminders', { utcHour, beijingHour, timestamp: now.toISOString() });

    const { results: configs } = await env.DB.prepare(`
      SELECT s.user_id, u.site_url, s.api_key, s.notify_time, s.notify_interval, s.last_sent_at, s.enabled
      FROM serverchan_config s
      JOIN users u ON s.user_id = u.id
      WHERE s.api_key IS NOT NULL AND s.api_key != ''
        AND (s.enabled IS NULL OR s.enabled = 1)
    `).all<UserServerChanConfig>();

    logger.info('[ServerChan] Found users with ServerChan enabled', { count: configs.length });

    for (const config of configs) {
      const checkResult = shouldSendNotification(
        config.notify_time,
        config.notify_interval,
        config.last_sent_at,
        beijingHour,
      );

      logger.info('[ServerChan] User notification check', {
        userId: config.user_id,
        should: checkResult.should,
        reason: checkResult.reason,
        notifyTime: config.notify_time ?? 8,
        lastSentAt: config.last_sent_at,
      });

      if (!checkResult.should) continue;

      // 使用北京时间进行日期比较
      const beijingDate = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { results: subscriptions } = await env.DB.prepare(`
        SELECT * FROM subscriptions 
        WHERE user_id = ? 
          AND status = 'active' 
          AND one_time = 0
          AND date(end_date) >= date(?)
          AND date(end_date) <= date(?, '+' || remind_days || ' days')
      `).bind(config.user_id, beijingDate, beijingDate).all<Subscription>();

      logger.info('[ServerChan] Found expiring subscriptions', {
        userId: config.user_id,
        count: subscriptions.length,
        subscriptions: subscriptions.map((s) => ({ name: s.name, end_date: s.end_date, remind_days: s.remind_days })),
      });

      if (subscriptions.length > 0) {
        const title = `[Subly] 您有 ${subscriptions.length} 个订阅即将到期`;
        const content = generateReminderContent(subscriptions, config.site_url);

        logger.info('[ServerChan] Sending reminder', { userId: config.user_id, count: subscriptions.length });

        const result = await sendServerChanMessage(config.api_key, title, content);

        if (result.code === 0) {
          await env.DB.prepare('UPDATE serverchan_config SET last_sent_at = ? WHERE user_id = ?')
            .bind(now.toISOString(), config.user_id)
            .run();
          logger.info('[ServerChan] Successfully sent', { userId: config.user_id });
        } else {
          logger.error('[ServerChan] Failed to send', { userId: config.user_id, message: result.message });
        }
      } else {
        logger.info('[ServerChan] No expiring subscriptions, skipping', { userId: config.user_id });
      }
    }
  } catch (error) {
    logger.error('[ServerChan] Check reminders error', error);
  }
}
