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
    const legacyResult = (await legacyResponse.json()) as ServerChanResponse;
    return legacyResult;
  } catch (error) {
    return {
      code: -1,
      message: String(error),
      data: { error: 'FETCH_ERROR', errno: -1 },
    };
  }
}

export async function checkAndSendServerChanReminders(env: Env): Promise<void> {
  try {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const beijingHour = (utcHour + 8) % 24;

    const { results: users } = await env.DB.prepare(
      `SELECT * FROM users 
       WHERE (serverchan_api_key IS NOT NULL AND serverchan_api_key != '')
       AND (serverchan_notify_time = ? OR (serverchan_notify_time IS NULL AND ? = 8))`,
    )
      .bind(beijingHour, beijingHour)
      .all<User>();

    for (const user of users) {
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

        await sendServerChanMessage(
          user.serverchan_api_key as string,
          title,
          content,
        );
      }
    }
  } catch {}
}
