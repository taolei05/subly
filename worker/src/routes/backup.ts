import {
	downloadR2Backup,
	listR2Backups,
	listR2SettingsBackups,
	manualBackup,
	manualSettingsBackup,
} from "../services/backup";
import type { Env } from "../types/index";
import { errorResponse, logger, successResponse, verifyToken } from "../utils";

/**
 * 手动触发备份
 */
export async function triggerBackup(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const authHeader = request.headers.get("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return errorResponse("未授权", 401);
		}

		const token = authHeader.slice(7);
		const payload = await verifyToken(token);
		if (!payload) {
			return errorResponse("Token 无效或已过期", 401);
		}

		// 检查用户角色
		const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?")
			.bind(payload.userId)
			.first<{ role: string }>();

		if (!user) {
			return errorResponse("用户不存在", 404);
		}

		if (user.role === "demo") {
			return errorResponse("演示账户不能执行备份", 403);
		}

		const { to_email, to_r2, backup_subscriptions, backup_settings } =
			(await request.json()) as {
				to_email?: boolean;
				to_r2?: boolean;
				backup_subscriptions?: boolean;
				backup_settings?: boolean;
			};

		if (!to_email && !to_r2) {
			return errorResponse("请至少选择一种备份方式");
		}

		// 默认备份订阅信息（兼容旧版本）
		const shouldBackupSubscriptions = backup_subscriptions !== false;
		const shouldBackupSettings = backup_settings === true;

		if (!shouldBackupSubscriptions && !shouldBackupSettings) {
			return errorResponse("请至少选择一种备份内容");
		}

		const results: string[] = [];
		const isAdmin = user.role === "admin";

		// 备份订阅信息
		if (shouldBackupSubscriptions) {
			const result = await manualBackup(
				env,
				payload.userId,
				to_email ?? false,
				to_r2 ?? false,
			);
			results.push(`订阅信息：${result.message}`);
		}

		// 备份系统设置
		if (shouldBackupSettings) {
			const result = await manualSettingsBackup(
				env,
				payload.userId,
				isAdmin,
				to_email ?? false,
				to_r2 ?? false,
			);
			results.push(`系统设置：${result.message}`);
		}

		const allSuccess = results.every((r) => r.includes("成功"));
		return allSuccess
			? successResponse(null, results.join("；"))
			: errorResponse(results.join("；"));
	} catch (error) {
		logger.error("TriggerBackup error", error);
		return errorResponse("备份失败，请重试", 500);
	}
}

/**
 * 获取 R2 备份列表
 */
export async function getBackupList(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const authHeader = request.headers.get("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return errorResponse("未授权", 401);
		}

		const token = authHeader.slice(7);
		const payload = await verifyToken(token);
		if (!payload) {
			return errorResponse("Token 无效或已过期", 401);
		}

		const url = new URL(request.url);
		const type = url.searchParams.get("type") || "subscriptions";

		if (type === "settings") {
			const backups = await listR2SettingsBackups(env, payload.userId);
			return successResponse(backups);
		}

		const backups = await listR2Backups(env, payload.userId);
		return successResponse(backups);
	} catch (error) {
		logger.error("GetBackupList error", error);
		return errorResponse("获取备份列表失败", 500);
	}
}

/**
 * 下载 R2 备份
 */
export async function downloadBackup(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const authHeader = request.headers.get("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return errorResponse("未授权", 401);
		}

		const token = authHeader.slice(7);
		const payload = await verifyToken(token);
		if (!payload) {
			return errorResponse("Token 无效或已过期", 401);
		}

		const url = new URL(request.url);
		const date = url.searchParams.get("date");
		const format = (url.searchParams.get("format") || "json") as "json" | "csv";

		if (!date) {
			return errorResponse("缺少日期参数");
		}

		// 验证日期格式，防止路径遍历攻击
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			return errorResponse("日期格式无效，应为 YYYY-MM-DD");
		}

		if (format !== "json" && format !== "csv") {
			return errorResponse("格式参数无效，仅支持 json 或 csv");
		}

		const type = (url.searchParams.get("type") || "subscriptions") as
			| "subscriptions"
			| "settings";

		const content = await downloadR2Backup(
			env,
			payload.userId,
			date,
			format,
			type,
		);

		if (!content) {
			return errorResponse("备份文件不存在", 404);
		}

		const contentType = format === "json" ? "application/json" : "text/csv";
		const prefix = type === "settings" ? "subly-settings" : "subly-backup";

		return new Response(content, {
			headers: {
				"Content-Type": contentType,
				"Content-Disposition": `attachment; filename="${prefix}-${date}.${format}"`,
			},
		});
	} catch (error) {
		logger.error("DownloadBackup error", error);
		return errorResponse("下载备份失败", 500);
	}
}
