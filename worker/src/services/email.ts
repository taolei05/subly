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

function generateSubscriptionsTable(subscriptions: Subscription[]): string {
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

	return `<table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: #f8f8f8;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #eee;">服务名称</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #eee;">类型</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #eee;">到期日期</th>
        </tr>
      </thead>
      <tbody>${items}</tbody>
    </table>`;
}

function replaceTemplateVariables(
	template: string,
	variables: Record<string, string>,
): string {
	let result = template;
	for (const [key, value] of Object.entries(variables)) {
		result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
	}
	return result;
}

export function generateEmailSubject(
	subscriptions: Subscription[],
	templateSubject?: string,
): string {
	if (templateSubject) {
		return replaceTemplateVariables(templateSubject, {
			count: String(subscriptions.length),
		});
	}
	return `[Subly] 您有 ${subscriptions.length} 个订阅即将到期`;
}

export function generateReminderEmail(
	subscriptions: Subscription[],
	siteUrl?: string,
	templateBody?: string,
): string {
	const sendTime = new Date().toLocaleString("zh-CN", {
		timeZone: "Asia/Shanghai",
	});

	const subscriptionsTable = generateSubscriptionsTable(subscriptions);

	// 如果有自定义模板，使用自定义模板
	if (templateBody) {
		const variables = {
			subscriptions: subscriptionsTable,
			count: String(subscriptions.length),
			time: sendTime,
			site_url: siteUrl || "",
		};
		const customContent = replaceTemplateVariables(templateBody, variables);

		return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>订阅到期提醒</title></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #18a058; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Subly 订阅提醒</h1>
      </div>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px;">
        ${customContent}
      </div>
    </body>
    </html>
  `;
	}

	// 默认模板
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
        ${subscriptionsTable}
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; margin-top: 16px;">
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee; color: #999; width: 100px;">发送时间</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${sendTime}</td>
          </tr>
          <tr>
            <td style="padding: 12px; color: #999;">到期数量</td>
            <td style="padding: 12px;">${subscriptions.length} 个</td>
          </tr>
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
	notifyHours: string | null | undefined,
	lastSentAt: string | null | undefined,
	beijingHour: number,
): { should: boolean; reason: string } {
	const hoursStr = notifyHours ?? "8";
	const targetHours = hoursStr
		.split(",")
		.map((h) => Number.parseInt(h.trim(), 10));

	if (!targetHours.includes(beijingHour)) {
		return {
			should: false,
			reason: `当前时间 ${beijingHour} 点，不在通知时间 [${hoursStr}] 内`,
		};
	}

	if (!lastSentAt) {
		return { should: true, reason: "首次发送" };
	}

	// 检查今天这个小时是否已发送过
	const lastSent = new Date(lastSentAt);
	const now = new Date();
	const lastSentBeijing = new Date(lastSent.getTime() + 8 * 60 * 60 * 1000);
	const nowBeijing = new Date(now.getTime() + 8 * 60 * 60 * 1000);

	const sameDay =
		lastSentBeijing.toISOString().split("T")[0] ===
		nowBeijing.toISOString().split("T")[0];
	const sameHour = lastSentBeijing.getUTCHours() === beijingHour;

	if (sameDay && sameHour) {
		return {
			should: false,
			reason: `今天 ${beijingHour} 点已发送过`,
		};
	}

	return { should: true, reason: `${beijingHour} 点触发发送` };
}

// 用于定时任务的聚合查询结果类型
interface UserResendConfig {
	user_id: number;
	site_url?: string;
	email: string;
	api_key: string;
	domain?: string;
	notify_hours?: string;
	last_sent_at?: string;
	enabled: number;
	template_subject?: string;
	template_body?: string;
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
             r.notify_hours, r.last_sent_at, r.enabled,
             r.template_subject, r.template_body
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
				config.notify_hours,
				config.last_sent_at,
				beijingHour,
			);

			logger.info("[Email] User notification check", {
				userId: config.user_id,
				should: checkResult.should,
				reason: checkResult.reason,
				notifyHours: config.notify_hours ?? "8",
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
				const title = generateEmailSubject(
					subscriptions,
					config.template_subject || undefined,
				);
				const html = generateReminderEmail(
					subscriptions,
					config.site_url || undefined,
					config.template_body || undefined,
				);

				logger.info("[Email] Sending reminder", {
					userId: config.user_id,
					email: config.email,
					count: subscriptions.length,
					hasCustomTemplate: !!(
						config.template_subject || config.template_body
					),
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
