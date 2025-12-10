import type { Env, Subscription } from "../types/index";
import { logger } from "../utils";

// ==================== 类型定义 ====================

export interface EmailData {
	to: string;
	subject: string;
	html: string;
}

const TYPE_LABELS: Record<string, string> = {
	domain: "域名",
	server: "服务器",
	membership: "会员",
	software: "软件",
	other: "其他",
};

// ==================== 邮件发送 ====================

export async function sendEmail(
	apiKey: string,
	domain: string,
	data: EmailData,
): Promise<boolean> {
	try {
		const fromEmail = domain
			? `Subly <noreply@${domain}>`
			: "Subly <onboarding@resend.dev>";

		const response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
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
			logger.error("Resend API error", {
				status: response.status,
				error: errorText,
			});
			return false;
		}

		return true;
	} catch (error) {
		logger.error("Send email error", error);
		return false;
	}
}

// ==================== 邮件模板 ====================

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
		.join("");

	const viewDetailsButton = siteUrl
		? `<div style="margin-top: 20px; text-align: center;">
        <a href="${siteUrl}" style="display: inline-block; background: #18a058; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 14px;">查看详情</a>
      </div>`
		: "";

	return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>订阅到期提醒</title></head>
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
          <tbody>${items}</tbody>
        </table>
        ${viewDetailsButton}
        <p style="margin-top: 20px; color: #666; font-size: 14px;">这是一封自动发送的邮件，请勿直接回复。</p>
      </div>
    </body>
    </html>
  `;
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
		return {
			should: false,
			reason: `当前时间 ${beijingHour} 点，通知时间 ${targetHour} 点`,
		};
	}

	if (!lastSentAt) {
		return { should: true, reason: "首次发送" };
	}

	const lastSent = new Date(lastSentAt);
	const now = new Date();
	const hoursSinceLastSent =
		(now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);

	if (hoursSinceLastSent >= intervalHours) {
		return {
			should: true,
			reason: `距上次发送 ${hoursSinceLastSent.toFixed(1)} 小时，超过间隔 ${intervalHours} 小时`,
		};
	}

	return {
		should: false,
		reason: `距上次发送 ${hoursSinceLastSent.toFixed(1)} 小时，未达间隔 ${intervalHours} 小时`,
	};
}

// 用于定时任务的聚合查询结果类型
interface UserResendConfig {
	user_id: number;
	site_url?: string;
	email: string;
	api_key: string;
	domain?: string;
	notify_time: number;
	notify_interval: number;
	last_sent_at?: string;
	enabled: number;
}

export async function checkAndSendEmailReminders(env: Env): Promise<void> {
	try {
		const now = new Date();
		const utcHour = now.getUTCHours();
		const beijingHour = (utcHour + 8) % 24;

		logger.info("[Email] Checking reminders", {
			utcHour,
			beijingHour,
			timestamp: now.toISOString(),
		});

		// 查询启用了 Resend 且有 API Key 的用户
		const { results: configs } = await env.DB.prepare(`
      SELECT r.user_id, u.site_url, r.email, r.api_key, r.domain, 
             r.notify_time, r.notify_interval, r.last_sent_at, r.enabled
      FROM resend_config r
      JOIN users u ON r.user_id = u.id
      WHERE r.api_key IS NOT NULL AND r.api_key != ''
        AND (r.enabled IS NULL OR r.enabled = 1)
    `).all<UserResendConfig>();

		logger.info("[Email] Found users with Resend enabled", {
			count: configs.length,
		});

		for (const config of configs) {
			const checkResult = shouldSendNotification(
				config.notify_time,
				config.notify_interval,
				config.last_sent_at,
				beijingHour,
			);

			logger.info("[Email] User notification check", {
				userId: config.user_id,
				should: checkResult.should,
				reason: checkResult.reason,
				notifyTime: config.notify_time ?? 8,
				lastSentAt: config.last_sent_at,
			});

			if (!checkResult.should) continue;

			// 使用北京时间进行日期比较
			const beijingDate = new Date(now.getTime() + 8 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0];
			const { results: subscriptions } = await env.DB.prepare(`
        SELECT * FROM subscriptions 
        WHERE user_id = ? 
          AND status = 'active' 
          AND one_time = 0
          AND date(end_date) >= date(?)
          AND date(end_date) <= date(?, '+' || remind_days || ' days')
      `)
				.bind(config.user_id, beijingDate, beijingDate)
				.all<Subscription>();

			logger.info("[Email] Found expiring subscriptions", {
				userId: config.user_id,
				count: subscriptions.length,
				subscriptions: subscriptions.map((s) => ({
					name: s.name,
					end_date: s.end_date,
					remind_days: s.remind_days,
				})),
			});

			if (subscriptions.length > 0) {
				const title = `[Subly] 您有 ${subscriptions.length} 个订阅即将到期`;
				const html = generateReminderEmail(
					subscriptions,
					config.site_url || undefined,
				);

				logger.info("[Email] Sending reminder", {
					userId: config.user_id,
					email: config.email,
					count: subscriptions.length,
				});

				const success = await sendEmail(config.api_key, config.domain || "", {
					to: config.email,
					subject: title,
					html,
				});

				if (success) {
					await env.DB.prepare(
						"UPDATE resend_config SET last_sent_at = ? WHERE user_id = ?",
					)
						.bind(now.toISOString(), config.user_id)
						.run();
					logger.info("[Email] Successfully sent", { userId: config.user_id });
				} else {
					logger.error("[Email] Failed to send", { userId: config.user_id });
				}
			} else {
				logger.info("[Email] No expiring subscriptions, skipping", {
					userId: config.user_id,
				});
			}
		}
	} catch (error) {
		logger.error("[Email] Check reminders error", error);
	}
}
