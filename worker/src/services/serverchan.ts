import type { Env, Subscription, User } from '../types/index';

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
    console.error('[ServerChan] Send error:', error);
    return {
      code: -1,
      message: String(error),
      data: { error: 'FETCH_ERROR', errno: -1 },
    };
  }
}

// ==================== 定时任务 ====================

/**
 * 检查是否应该发送通知（基于时间和频率）
 */
function shouldSendNotification(
  notifyTime: number | null | undefined,
  notifyInterval: number | null | undefined,
  lastSentAt: string | null | undefined,
  beijingHour: number,
): boolean {
  const targetHour = notifyTime ?? 8;
  const intervalHours = notifyInterval ?? 24;

  if (beijingHour !== targetHour) {
    return false;
  }

  if (!lastSentAt) {
    return true;
  }

  const lastSent = new Date(lastSentAt);
  const now = new Date();
  const hoursSinceLastSent =
    (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);

  return hoursSinceLastSent >= intervalHours;
}

/**
 * 检查并发送 Server酱提醒 (由 Cron 触发)
 */
export async function checkAndSendServerChanReminders(env: Env): Promise<void> {
  try {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const beijingHour = (utcHour + 8) % 24;

    console.log(
      `[ServerChan] Checking reminders at Beijing hour: ${beijingHour}`,
    );

    const { results: users } = await env.DB.prepare(
      `SELECT * FROM users 
       WHERE serverchan_api_key IS NOT NULL AND serverchan_api_key != ''
       AND (serverchan_enabled IS NULL OR serverchan_enabled = 1)`,
    ).all<User>();

    console.log(
      `[ServerChan] Found ${users.length} users with ServerChan enabled`,
    );

    for (const user of users) {
      if (
        !shouldSendNotification(
          user.serverchan_notify_time,
          user.serverchan_notify_interval,
          user.serverchan_last_sent_at,
          beijingHour,
        )
      ) {
        continue;
      }

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
        const content =
          subscriptions
            .map(
              (sub) => `- **${sub.name}** (${sub.type}): ${sub.end_date} 到期`,
            )
            .join('\n\n') + '\n\n请及时处理。';

        console.log(`[ServerChan] Sending reminder to user ${user.id}`);

        const result = await sendServerChanMessage(
          user.serverchan_api_key as string,
          title,
          content,
        );

        if (result.code === 0) {
          await env.DB.prepare(
            `UPDATE users SET serverchan_last_sent_at = ? WHERE id = ?`,
          )
            .bind(now.toISOString(), user.id)
            .run();
          console.log(`[ServerChan] Successfully sent to user ${user.id}`);
        } else {
          console.error(
            `[ServerChan] Failed to send to user ${user.id}:`,
            result.message,
          );
        }
      }
    }
  } catch (error) {
    console.error('[ServerChan] Check reminders error:', error);
  }
}
