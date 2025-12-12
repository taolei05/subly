import type { BackupFrequency, Env, Subscription } from "../types/index";
import { logger } from "../utils";

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
        <p>您的 Subly 订阅数据已成功备份，请查收附件中的 JSON 文件。</p>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; margin-top: 16px;">
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee; color: #999; width: 100px;">备份时间</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">${backupTime}</td>
          </tr>
          <tr>
            <td style="padding: 12px; color: #999;">订阅数量</td>
            <td style="padding: 12px;">${subscriptionCount} 个</td>
          </tr>
        </table>
        <p style="margin-top: 20px; color: #666; font-size: 14px;">这是一封自动发送的备份邮件，请妥善保管备份文件。</p>
      </div>
    </body>
    </html>
  `;
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
						filename: `subly-backup-${backupData.exported_at.split("T")[0]}.json`,
						content: btoa(
							unescape(
								encodeURIComponent(JSON.stringify(backupData, null, 2)),
							),
						),
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
		const key = `backups/${userId}/${date}.json`;

		await bucket.put(key, JSON.stringify(backupData, null, 2), {
			httpMetadata: { contentType: "application/json" },
		});

		logger.info("[Backup] Saved to R2", { userId, key });
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
): Promise<{ key: string; date: string; size: number }[]> {
	if (!env.BACKUP_BUCKET) {
		return [];
	}

	try {
		const prefix = `backups/${userId}/`;
		const listed = await env.BACKUP_BUCKET.list({ prefix });

		return listed.objects.map((obj) => ({
			key: obj.key,
			date: obj.key.replace(prefix, "").replace(".json", ""),
			size: obj.size,
		}));
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
): Promise<string | null> {
	if (!env.BACKUP_BUCKET) {
		return null;
	}

	try {
		const key = `backups/${userId}/${date}.json`;
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
