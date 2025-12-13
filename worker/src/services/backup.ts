import type {
	BackupFrequency,
	Env,
	Subscription,
	UserRole,
} from "../types/index";
import { logger, USER_WITH_CONFIG_QUERY } from "../utils";

// ==================== 类型定义 ====================

interface UserBackupConfig {
	user_id: number;
	username: string;
	email: string;
	resend_api_key?: string;
	resend_domain?: string;
	backup_enabled: number;
	backup_frequency: BackupFrequency;
	backup_to_email: number;
	backup_to_r2: number;
	backup_last_at?: string;
}

// 系统设置备份数据
interface SettingsBackupData {
	version: string;
	exported_at: string;
	user: {
		id: number;
		username: string;
		role: UserRole;
	};
	settings: {
		resend?: {
			email?: string;
			api_key?: string;
			domain?: string;
			enabled?: number;
			notify_hours?: string;
			template_subject?: string;
			template_body?: string;
		};
		serverchan?: {
			api_key?: string;
			enabled?: number;
			notify_hours?: string;
			template_title?: string;
			template_body?: string;
		};
		exchangerate?: {
			api_key?: string;
			enabled?: number;
		};
		backup?: {
			enabled?: number;
			frequency?: string;
			to_email?: number;
			to_r2?: number;
		};
		// 安全设置（仅管理员）
		security?: {
			site_url?: string;
			registration_enabled?: boolean;
		};
	};
}

interface BackupData {
	version: string;
	exported_at: string;
	user: {
		id: number;
		username: string;
	};
	subscriptions: Subscription[];
}

// ==================== 备份逻辑 ====================

function shouldBackup(
	frequency: BackupFrequency,
	lastBackupAt?: string,
): { should: boolean; reason: string } {
	if (!lastBackupAt) {
		return { should: true, reason: "首次备份" };
	}

	const lastBackup = new Date(lastBackupAt);
	const now = new Date();
	const diffMs = now.getTime() - lastBackup.getTime();
	const diffDays = diffMs / (1000 * 60 * 60 * 24);

	const intervals: Record<BackupFrequency, number> = {
		daily: 1,
		weekly: 7,
		monthly: 30,
	};

	const requiredDays = intervals[frequency];

	if (diffDays >= requiredDays) {
		return {
			should: true,
			reason: `距上次备份已过 ${Math.floor(diffDays)} 天`,
		};
	}

	return {
		should: false,
		reason: `距上次备份 ${Math.floor(diffDays)} 天，未到 ${requiredDays} 天`,
	};
}

function generateBackupData(
	userId: number,
	username: string,
	subscriptions: Subscription[],
): BackupData {
	return {
		version: "1.0",
		exported_at: new Date().toISOString(),
		user: { id: userId, username },
		subscriptions,
	};
}

// CSV 字段转义
function escapeCsvField(
	field: string | number | boolean | null | undefined,
): string {
	if (field === null || field === undefined) return "";
	const str = String(field);
	if (str.includes(",") || str.includes('"') || str.includes("\n")) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

// 生成 CSV 格式备份
function generateBackupCsv(subscriptions: Subscription[]): string {
	const headers = [
		"id",
		"name",
		"type",
		"type_detail",
		"price",
		"currency",
		"start_date",
		"end_date",
		"remind_days",
		"renew_type",
		"one_time",
		"status",
		"notes",
		"created_at",
		"updated_at",
	];

	const rows = subscriptions.map((sub) =>
		[
			sub.id,
			escapeCsvField(sub.name),
			sub.type,
			escapeCsvField(sub.type_detail),
			sub.price,
			sub.currency,
			sub.start_date,
			sub.end_date,
			sub.remind_days,
			sub.renew_type,
			sub.one_time ? 1 : 0,
			sub.status,
			escapeCsvField(sub.notes),
			sub.created_at,
			sub.updated_at,
		].join(","),
	);

	return [headers.join(","), ...rows].join("\n");
}

function generateBackupEmailHtml(
	username: string,
	subscriptionCount: number,
	backupTime: string,
): string {
	return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Subly 数据备份</title></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #18a058; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Subly 数据备份</h1>
      </div>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px;">
        <p>您好，${username}！</p>
        <p>您的 Subly 订阅数据已成功备份，请查收附件中的备份文件（JSON 和 CSV 格式）。</p>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; margin-top: 16px;">
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee; color: #999; width: 100px;">备份时间</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${backupTime}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee; color: #999;">订阅数量</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${subscriptionCount} 个</td>
          </tr>
          <tr>
            <td style="padding: 12px; color: #999;">附件格式</td>
            <td style="padding: 12px;">JSON（完整数据）、CSV（表格数据）</td>
          </tr>
        </table>
        <p style="margin-top: 20px; color: #666; font-size: 14px;">这是一封自动发送的备份邮件，请妥善保管备份文件。</p>
      </div>
    </body>
    </html>
  `;
}

// 将字符串转为 base64（支持 UTF-8）
function toBase64(str: string): string {
	const encoder = new TextEncoder();
	const data = encoder.encode(str);
	let binary = "";
	for (let i = 0; i < data.length; i++) {
		binary += String.fromCharCode(data[i]);
	}
	return btoa(binary);
}

async function sendBackupEmail(
	apiKey: string,
	domain: string,
	email: string,
	username: string,
	backupData: BackupData,
): Promise<boolean> {
	try {
		const fromEmail = domain
			? `Subly <noreply@${domain}>`
			: "Subly <onboarding@resend.dev>";

		const backupTime = new Date().toLocaleString("zh-CN", {
			timeZone: "Asia/Shanghai",
		});

		const dateStr = backupData.exported_at.split("T")[0];
		const csvContent = generateBackupCsv(backupData.subscriptions);

		const response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from: fromEmail,
				to: email,
				subject: `[Subly] 数据备份 - ${backupTime}`,
				html: generateBackupEmailHtml(
					username,
					backupData.subscriptions.length,
					backupTime,
				),
				attachments: [
					{
						filename: `subly-backup-${dateStr}.json`,
						content: toBase64(JSON.stringify(backupData, null, 2)),
					},
					{
						filename: `subly-backup-${dateStr}.csv`,
						content: toBase64(csvContent),
					},
				],
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			logger.error("[Backup] Email send error", {
				status: response.status,
				error: errorText,
			});
			return false;
		}

		return true;
	} catch (error) {
		logger.error("[Backup] Email send error", error);
		return false;
	}
}

async function saveBackupToR2(
	bucket: R2Bucket,
	userId: number,
	backupData: BackupData,
): Promise<boolean> {
	try {
		const date = backupData.exported_at.split("T")[0];
		const jsonKey = `backups/${userId}/${date}.json`;
		const csvKey = `backups/${userId}/${date}.csv`;

		// 保存 JSON 格式
		await bucket.put(jsonKey, JSON.stringify(backupData, null, 2), {
			httpMetadata: { contentType: "application/json" },
		});

		// 保存 CSV 格式
		const csvContent = generateBackupCsv(backupData.subscriptions);
		await bucket.put(csvKey, csvContent, {
			httpMetadata: { contentType: "text/csv" },
		});

		logger.info("[Backup] Saved to R2", { userId, jsonKey, csvKey });
		return true;
	} catch (error) {
		logger.error("[Backup] R2 save error", error);
		return false;
	}
}

// ==================== 定时任务 ====================

export async function checkAndRunBackups(env: Env): Promise<void> {
	try {
		logger.info("[Backup] Starting backup check");

		// 查询启用了备份的用户
		const { results: configs } = await env.DB.prepare(`
      SELECT 
        u.id as user_id,
        u.username,
        u.backup_enabled,
        u.backup_frequency,
        u.backup_to_email,
        u.backup_to_r2,
        u.backup_last_at,
        r.email,
        r.api_key as resend_api_key,
        r.domain as resend_domain
      FROM users u
      LEFT JOIN resend_config r ON u.id = r.user_id
      WHERE u.backup_enabled = 1
    `).all<UserBackupConfig>();

		logger.info("[Backup] Found users with backup enabled", {
			count: configs.length,
		});

		for (const config of configs) {
			const checkResult = shouldBackup(
				config.backup_frequency || "weekly",
				config.backup_last_at,
			);

			logger.info("[Backup] User backup check", {
				userId: config.user_id,
				should: checkResult.should,
				reason: checkResult.reason,
			});

			if (!checkResult.should) continue;

			// 获取用户的所有订阅
			const { results: subscriptions } = await env.DB.prepare(
				"SELECT * FROM subscriptions WHERE user_id = ?",
			)
				.bind(config.user_id)
				.all<Subscription>();

			const backupData = generateBackupData(
				config.user_id,
				config.username,
				subscriptions,
			);

			let emailSuccess = false;
			let r2Success = false;

			// 备份到邮箱
			if (config.backup_to_email && config.resend_api_key && config.email) {
				emailSuccess = await sendBackupEmail(
					config.resend_api_key,
					config.resend_domain || "",
					config.email,
					config.username,
					backupData,
				);
				logger.info("[Backup] Email backup result", {
					userId: config.user_id,
					success: emailSuccess,
				});
			}

			// 备份到 R2
			if (config.backup_to_r2 && env.BACKUP_BUCKET) {
				r2Success = await saveBackupToR2(
					env.BACKUP_BUCKET,
					config.user_id,
					backupData,
				);
				logger.info("[Backup] R2 backup result", {
					userId: config.user_id,
					success: r2Success,
				});
			}

			// 如果任一备份成功，更新最后备份时间
			if (emailSuccess || r2Success) {
				await env.DB.prepare("UPDATE users SET backup_last_at = ? WHERE id = ?")
					.bind(new Date().toISOString(), config.user_id)
					.run();
			}
		}

		logger.info("[Backup] Backup check completed");
	} catch (error) {
		logger.error("[Backup] Check error", error);
	}
}

// ==================== 手动备份 ====================

export async function manualBackup(
	env: Env,
	userId: number,
	toEmail: boolean,
	toR2: boolean,
): Promise<{ success: boolean; message: string }> {
	try {
		// 获取用户信息
		const user = await env.DB.prepare(`
      SELECT 
        u.id, u.username,
        r.email, r.api_key as resend_api_key, r.domain as resend_domain
      FROM users u
      LEFT JOIN resend_config r ON u.id = r.user_id
      WHERE u.id = ?
    `)
			.bind(userId)
			.first<{
				id: number;
				username: string;
				email?: string;
				resend_api_key?: string;
				resend_domain?: string;
			}>();

		if (!user) {
			return { success: false, message: "用户不存在" };
		}

		// 获取订阅数据
		const { results: subscriptions } = await env.DB.prepare(
			"SELECT * FROM subscriptions WHERE user_id = ?",
		)
			.bind(userId)
			.all<Subscription>();

		const backupData = generateBackupData(userId, user.username, subscriptions);

		const results: string[] = [];

		// 备份到邮箱
		if (toEmail) {
			if (!user.resend_api_key || !user.email) {
				results.push("邮箱备份失败：未配置 Resend API Key 或邮箱");
			} else {
				const success = await sendBackupEmail(
					user.resend_api_key,
					user.resend_domain || "",
					user.email,
					user.username,
					backupData,
				);
				results.push(success ? "邮箱备份成功" : "邮箱备份失败");
			}
		}

		// 备份到 R2
		if (toR2) {
			if (!env.BACKUP_BUCKET) {
				results.push("R2 备份失败：未配置存储桶");
			} else {
				const success = await saveBackupToR2(
					env.BACKUP_BUCKET,
					userId,
					backupData,
				);
				results.push(success ? "R2 备份成功" : "R2 备份失败");
			}
		}

		// 更新最后备份时间
		if (results.some((r) => r.includes("成功"))) {
			await env.DB.prepare("UPDATE users SET backup_last_at = ? WHERE id = ?")
				.bind(new Date().toISOString(), userId)
				.run();
		}

		const allSuccess = results.every((r) => r.includes("成功"));
		return {
			success: allSuccess,
			message: results.join("；"),
		};
	} catch (error) {
		logger.error("[Backup] Manual backup error", error);
		return { success: false, message: "备份失败，请重试" };
	}
}

// ==================== 获取 R2 备份列表 ====================

export async function listR2Backups(
	env: Env,
	userId: number,
): Promise<{ date: string; jsonSize: number; csvSize: number }[]> {
	if (!env.BACKUP_BUCKET) {
		return [];
	}

	try {
		const prefix = `backups/${userId}/`;
		const listed = await env.BACKUP_BUCKET.list({ prefix });

		// 按日期分组
		const backupMap = new Map<string, { jsonSize: number; csvSize: number }>();

		for (const obj of listed.objects) {
			const filename = obj.key.replace(prefix, "");
			const date = filename.replace(/\.(json|csv)$/, "");
			const isJson = filename.endsWith(".json");

			if (!backupMap.has(date)) {
				backupMap.set(date, { jsonSize: 0, csvSize: 0 });
			}

			const entry = backupMap.get(date);
			if (entry) {
				if (isJson) {
					entry.jsonSize = obj.size;
				} else {
					entry.csvSize = obj.size;
				}
			}
		}

		return Array.from(backupMap.entries())
			.map(([date, sizes]) => ({ date, ...sizes }))
			.sort((a, b) => b.date.localeCompare(a.date));
	} catch (error) {
		logger.error("[Backup] List R2 backups error", error);
		return [];
	}
}

// ==================== 下载 R2 备份 ====================

export async function downloadR2Backup(
	env: Env,
	userId: number,
	date: string,
	format: "json" | "csv" = "json",
	type: "subscriptions" | "settings" = "subscriptions",
): Promise<string | null> {
	if (!env.BACKUP_BUCKET) {
		return null;
	}

	try {
		const folder = type === "settings" ? "settings" : "backups";
		const key = `${folder}/${userId}/${date}.${format}`;
		const object = await env.BACKUP_BUCKET.get(key);

		if (!object) {
			return null;
		}

		return await object.text();
	} catch (error) {
		logger.error("[Backup] Download R2 backup error", error);
		return null;
	}
}

// ==================== 系统设置备份 ====================

async function generateSettingsBackupData(
	env: Env,
	userId: number,
	isAdmin: boolean,
): Promise<SettingsBackupData> {
	// 获取用户完整配置
	const user = await env.DB.prepare(`${USER_WITH_CONFIG_QUERY} WHERE u.id = ?`)
		.bind(userId)
		.first<{
			id: number;
			username: string;
			role: UserRole;
			site_url?: string;
			email?: string;
			resend_api_key?: string;
			resend_domain?: string;
			resend_enabled?: number;
			resend_notify_hours?: string;
			resend_template_subject?: string;
			resend_template_body?: string;
			serverchan_api_key?: string;
			serverchan_enabled?: number;
			serverchan_notify_hours?: string;
			serverchan_template_title?: string;
			serverchan_template_body?: string;
			exchangerate_api_key?: string;
			exchangerate_enabled?: number;
			backup_enabled?: number;
			backup_frequency?: string;
			backup_to_email?: number;
			backup_to_r2?: number;
		}>();

	if (!user) {
		throw new Error("用户不存在");
	}

	const backupData: SettingsBackupData = {
		version: "1.0",
		exported_at: new Date().toISOString(),
		user: {
			id: user.id,
			username: user.username,
			role: user.role,
		},
		settings: {
			resend: {
				email: user.email,
				api_key: user.resend_api_key,
				domain: user.resend_domain,
				enabled: user.resend_enabled,
				notify_hours: user.resend_notify_hours,
				template_subject: user.resend_template_subject,
				template_body: user.resend_template_body,
			},
			serverchan: {
				api_key: user.serverchan_api_key,
				enabled: user.serverchan_enabled,
				notify_hours: user.serverchan_notify_hours,
				template_title: user.serverchan_template_title,
				template_body: user.serverchan_template_body,
			},
			exchangerate: {
				api_key: user.exchangerate_api_key,
				enabled: user.exchangerate_enabled,
			},
			backup: {
				enabled: user.backup_enabled,
				frequency: user.backup_frequency,
				to_email: user.backup_to_email,
				to_r2: user.backup_to_r2,
			},
		},
	};

	// 仅管理员可备份安全设置
	if (isAdmin) {
		const systemConfig = await env.DB.prepare(
			"SELECT registration_enabled FROM system_config WHERE id = 1",
		).first<{ registration_enabled: number }>();

		backupData.settings.security = {
			site_url: user.site_url,
			registration_enabled: systemConfig
				? Boolean(systemConfig.registration_enabled)
				: true,
		};
	}

	return backupData;
}

async function saveSettingsBackupToR2(
	bucket: R2Bucket,
	userId: number,
	backupData: SettingsBackupData,
): Promise<boolean> {
	try {
		const date = backupData.exported_at.split("T")[0];
		const jsonKey = `settings/${userId}/${date}.json`;

		await bucket.put(jsonKey, JSON.stringify(backupData, null, 2), {
			httpMetadata: { contentType: "application/json" },
		});

		logger.info("[Backup] Settings saved to R2", { userId, jsonKey });
		return true;
	} catch (error) {
		logger.error("[Backup] Settings R2 save error", error);
		return false;
	}
}

export async function manualSettingsBackup(
	env: Env,
	userId: number,
	isAdmin: boolean,
	toEmail: boolean,
	toR2: boolean,
): Promise<{ success: boolean; message: string }> {
	try {
		const user = await env.DB.prepare(`
      SELECT u.id, u.username, r.email, r.api_key as resend_api_key, r.domain as resend_domain
      FROM users u
      LEFT JOIN resend_config r ON u.id = r.user_id
      WHERE u.id = ?
    `)
			.bind(userId)
			.first<{
				id: number;
				username: string;
				email?: string;
				resend_api_key?: string;
				resend_domain?: string;
			}>();

		if (!user) {
			return { success: false, message: "用户不存在" };
		}

		const backupData = await generateSettingsBackupData(env, userId, isAdmin);
		const results: string[] = [];

		// 备份到邮箱
		if (toEmail) {
			if (!user.resend_api_key || !user.email) {
				results.push("邮箱备份失败：未配置 Resend API Key 或邮箱");
			} else {
				const success = await sendSettingsBackupEmail(
					user.resend_api_key,
					user.resend_domain || "",
					user.email,
					user.username,
					backupData,
				);
				results.push(success ? "邮箱备份成功" : "邮箱备份失败");
			}
		}

		// 备份到 R2
		if (toR2) {
			if (!env.BACKUP_BUCKET) {
				results.push("R2 备份失败：未配置存储桶");
			} else {
				const success = await saveSettingsBackupToR2(
					env.BACKUP_BUCKET,
					userId,
					backupData,
				);
				results.push(success ? "R2 备份成功" : "R2 备份失败");
			}
		}

		const allSuccess = results.every((r) => r.includes("成功"));
		return {
			success: allSuccess,
			message: results.join("；"),
		};
	} catch (error) {
		logger.error("[Backup] Manual settings backup error", error);
		return { success: false, message: "备份失败，请重试" };
	}
}

async function sendSettingsBackupEmail(
	apiKey: string,
	domain: string,
	email: string,
	username: string,
	backupData: SettingsBackupData,
): Promise<boolean> {
	try {
		const fromEmail = domain
			? `Subly <noreply@${domain}>`
			: "Subly <onboarding@resend.dev>";

		const backupTime = new Date().toLocaleString("zh-CN", {
			timeZone: "Asia/Shanghai",
		});

		const dateStr = backupData.exported_at.split("T")[0];
		const hasSecuritySettings = !!backupData.settings.security;

		const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Subly 系统设置备份</title></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #2080f0; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Subly 系统设置备份</h1>
      </div>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px;">
        <p>您好，${username}！</p>
        <p>您的 Subly 系统设置已成功备份，请查收附件中的备份文件。</p>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; margin-top: 16px;">
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee; color: #999; width: 100px;">备份时间</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${backupTime}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee; color: #999;">备份内容</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">Resend、Server酱、汇率、备份配置${hasSecuritySettings ? "、安全设置" : ""}</td>
          </tr>
          <tr>
            <td style="padding: 12px; color: #999;">附件格式</td>
            <td style="padding: 12px;">JSON</td>
          </tr>
        </table>
        <p style="margin-top: 20px; color: #666; font-size: 14px;">这是一封自动发送的备份邮件，请妥善保管备份文件。</p>
      </div>
    </body>
    </html>
  `;

		const response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from: fromEmail,
				to: email,
				subject: `[Subly] 系统设置备份 - ${backupTime}`,
				html,
				attachments: [
					{
						filename: `subly-settings-${dateStr}.json`,
						content: toBase64(JSON.stringify(backupData, null, 2)),
					},
				],
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			logger.error("[Backup] Settings email send error", {
				status: response.status,
				error: errorText,
			});
			return false;
		}

		return true;
	} catch (error) {
		logger.error("[Backup] Settings email send error", error);
		return false;
	}
}

// ==================== 获取系统设置备份列表 ====================

export async function listR2SettingsBackups(
	env: Env,
	userId: number,
): Promise<{ date: string; jsonSize: number }[]> {
	if (!env.BACKUP_BUCKET) {
		return [];
	}

	try {
		const prefix = `settings/${userId}/`;
		const listed = await env.BACKUP_BUCKET.list({ prefix });

		return listed.objects
			.filter((obj) => obj.key.endsWith(".json"))
			.map((obj) => ({
				date: obj.key.replace(prefix, "").replace(".json", ""),
				jsonSize: obj.size,
			}))
			.sort((a, b) => b.date.localeCompare(a.date));
	} catch (error) {
		logger.error("[Backup] List R2 settings backups error", error);
		return [];
	}
}
