import type { Env, Subscription } from "../types/index";
import { logger } from "../utils";

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
		params.append("title", title);
		params.append("desp", content);

		const postResponse = await fetch(baseUrl, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params,
		});
		const postResult = (await postResponse.json()) as ServerChanResponse;
		if (postResult.code === 0) return postResult;

		const getUrl = `${baseUrl}?${params.toString()}`;
		const getResponse = await fetch(getUrl, { method: "GET" });
		const getResult = (await getResponse.json()) as ServerChanResponse;
		if (getResult.code === 0) return getResult;

		const legacyParams = new URLSearchParams();
		legacyParams.append("text", title);
		legacyParams.append("desp", content);
		const legacyUrl = `https://sc.ftqq.com/${token}.send?${legacyParams.toString()}`;
		const legacyResponse = await fetch(legacyUrl, { method: "GET" });
		return (await legacyResponse.json()) as ServerChanResponse;
	} catch (error) {
		logger.error("[ServerChan] Send error", error);
		return {
			code: -1,
			message: String(error),
			data: { error: "FETCH_ERROR", errno: -1 },
		};
	}
}

// ==================== 消息模板 ====================

const TYPE_LABELS: Record<string, string> = {
	domain: "域名",
	server: "服务器",
	membership: "会员",
	software: "软件",
	other: "其他",
};

function generateSubscriptionsMarkdown(subscriptions: Subscription[]): string {
	const tableRows = subscriptions
		.map(
			(sub) =>
				`| ${sub.name} | ${TYPE_LABELS[sub.type] || sub.type} | ${sub.end_date} |`,
		)
		.join("\n");

	return `| 服务名称 | 类型 | 到期日期 |
| :--- | :--- | :--- |
${tableRows}`;
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

export function generateServerChanTitle(
	subscriptions: Subscription[],
	templateTitle?: string,
): string {
	if (templateTitle) {
		return replaceTemplateVariables(templateTitle, {
			count: String(subscriptions.length),
		});
	}
	return `[Subly] 您有 ${subscriptions.length} 个订阅即将到期`;
}

function generateReminderContent(
	subscriptions: Subscription[],
	siteUrl?: string,
	templateBody?: string,
): string {
	const sendTime = new Date().toLocaleString("zh-CN", {
		timeZone: "Asia/Shanghai",
	});

	const subscriptionsTable = generateSubscriptionsMarkdown(subscriptions);

	// 如果有自定义模板，使用自定义模板
	if (templateBody) {
		return replaceTemplateVariables(templateBody, {
			subscriptions: subscriptionsTable,
			count: String(subscriptions.length),
			time: sendTime,
			site_url: siteUrl || "",
		});
	}

	// 默认模板
	return `
## ⏰ 订阅到期提醒

您有以下订阅即将到期，请及时处理：

${subscriptionsTable}

---

**发送时间**：${sendTime}  
**到期数量**：${subscriptions.length} 个

${siteUrl ? `[👉 查看详情](${siteUrl})` : ""}

---

*这是一条自动发送的消息，请勿直接回复。*
`.trim();
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
interface UserServerChanConfig {
	user_id: number;
	site_url?: string;
	api_key: string;
	notify_hours?: string;
	last_sent_at?: string;
	enabled: number;
	template_title?: string;
	template_body?: string;
}

export async function checkAndSendServerChanReminders(env: Env): Promise<void> {
	try {
		const now = new Date();
		const utcHour = now.getUTCHours();
		const beijingHour = (utcHour + 8) % 24;

		logger.info("[ServerChan] Checking reminders", {
			utcHour,
			beijingHour,
			timestamp: now.toISOString(),
		});

		const { results: configs } = await env.DB.prepare(`
      SELECT s.user_id, u.site_url, s.api_key, s.notify_hours, s.last_sent_at, s.enabled,
             s.template_title, s.template_body
      FROM serverchan_config s
      JOIN users u ON s.user_id = u.id
      WHERE s.api_key IS NOT NULL AND s.api_key != ''
        AND (s.enabled IS NULL OR s.enabled = 1)
    `).all<UserServerChanConfig>();

		logger.info("[ServerChan] Found users with ServerChan enabled", {
			count: configs.length,
		});

		for (const config of configs) {
			const checkResult = shouldSendNotification(
				config.notify_hours,
				config.last_sent_at,
				beijingHour,
			);

			logger.info("[ServerChan] User notification check", {
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

			logger.info("[ServerChan] Found expiring subscriptions", {
				userId: config.user_id,
				count: subscriptions.length,
				subscriptions: subscriptions.map((s) => ({
					name: s.name,
					end_date: s.end_date,
					remind_days: s.remind_days,
				})),
			});

			if (subscriptions.length > 0) {
				const title = generateServerChanTitle(
					subscriptions,
					config.template_title || undefined,
				);
				const content = generateReminderContent(
					subscriptions,
					config.site_url,
					config.template_body || undefined,
				);

				logger.info("[ServerChan] Sending reminder", {
					userId: config.user_id,
					count: subscriptions.length,
					hasCustomTemplate: !!(config.template_title || config.template_body),
				});

				const result = await sendServerChanMessage(
					config.api_key,
					title,
					content,
				);

				if (result.code === 0) {
					await env.DB.prepare(
						"UPDATE serverchan_config SET last_sent_at = ? WHERE user_id = ?",
					)
						.bind(now.toISOString(), config.user_id)
						.run();
					logger.info("[ServerChan] Successfully sent", {
						userId: config.user_id,
					});
				} else {
					logger.error("[ServerChan] Failed to send", {
						userId: config.user_id,
						message: result.message,
					});
				}
			} else {
				logger.info("[ServerChan] No expiring subscriptions, skipping", {
					userId: config.user_id,
				});
			}
		}
	} catch (error) {
		logger.error("[ServerChan] Check reminders error", error);
	}
}
