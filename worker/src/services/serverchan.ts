import type { Env, Subscription, User } from '../types';

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
    const legacyResult = (await legacyResponse.json()) as ServerChanResponse;
    return legacyResult;
  } catch (error) {
    console.error('[ServerChan] Send error:', error);
    return {
      code: -1,
      message: String(error),
      data: { error: 'FETCH_ERROR', errno: -1 },
    };
  }
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

export async function checkAndSendServerChanReminders(env: Env): Promise<void> {
  try {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const beijingHour = (utcHour + 8) % 24;

    console.log(
      `[ServerChan] Checking reminders at Beijing hour: ${beijingHour}`,
    );

    // 获取所有配置了 ServerChan 且启用了微信提醒的用户
    const { results: users } = await env.DB.prepare(
      `SELECT * FROM users 
       WHERE serverchan_api_key IS NOT NULL AND serverchan_api_key != ''
       AND (serverchan_enabled IS NULL OR serverchan_enabled = 1)`,
    ).all<User>();

    console.log(
      `[ServerChan] Found ${users.length} users with ServerChan enabled`,
    );

    for (const user of users) {
      // 检查是否应该发送通知
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

      // 获取该用户即将到期的订阅
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
          // 更新上次发送时间
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
