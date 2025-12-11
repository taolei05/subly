import type { Env } from "../types/index";
import { errorResponse, logger, successResponse, verifyToken } from "../utils";

/**
 * 获取系统配置（公开接口）
 */
export async function getSystemConfig(
	_request: Request,
	env: Env,
): Promise<Response> {
	try {
		const config = await env.DB.prepare(
			"SELECT registration_enabled, turnstile_enabled, turnstile_site_key FROM system_config WHERE id = 1",
		).first<{
			registration_enabled: number;
			turnstile_enabled: number;
			turnstile_site_key?: string;
		}>();

		// 如果没有配置记录，返回默认值
		if (!config) {
			return successResponse({
				registration_enabled: true,
				turnstile_enabled: false,
				turnstile_site_key: "",
			});
		}

		return successResponse({
			registration_enabled: Boolean(config.registration_enabled),
			turnstile_enabled: Boolean(config.turnstile_enabled),
			turnstile_site_key: config.turnstile_site_key || "",
		});
	} catch (error) {
		logger.error("GetSystemConfig error", error);
		return errorResponse("获取系统配置失败", 500);
	}
}

/**
 * 更新系统配置（需要认证）
 */
export async function updateSystemConfig(
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

		const body = (await request.json()) as {
			registration_enabled?: boolean;
			turnstile_enabled?: boolean;
			turnstile_site_key?: string;
			turnstile_secret_key?: string;
		};

		// 获取当前配置
		const current = await env.DB.prepare(
			"SELECT * FROM system_config WHERE id = 1",
		).first<{
			registration_enabled: number;
			turnstile_enabled: number;
			turnstile_site_key?: string;
			turnstile_secret_key?: string;
		}>();

		const newConfig = {
			registration_enabled:
				body.registration_enabled !== undefined
					? body.registration_enabled
						? 1
						: 0
					: (current?.registration_enabled ?? 1),
			turnstile_enabled:
				body.turnstile_enabled !== undefined
					? body.turnstile_enabled
						? 1
						: 0
					: (current?.turnstile_enabled ?? 0),
			turnstile_site_key:
				body.turnstile_site_key ?? current?.turnstile_site_key ?? "",
			turnstile_secret_key:
				body.turnstile_secret_key ?? current?.turnstile_secret_key ?? "",
		};

		await env.DB.prepare(`
			INSERT INTO system_config (id, registration_enabled, turnstile_enabled, turnstile_site_key, turnstile_secret_key, updated_at)
			VALUES (1, ?, ?, ?, ?, datetime('now'))
			ON CONFLICT(id) DO UPDATE SET
				registration_enabled = excluded.registration_enabled,
				turnstile_enabled = excluded.turnstile_enabled,
				turnstile_site_key = excluded.turnstile_site_key,
				turnstile_secret_key = excluded.turnstile_secret_key,
				updated_at = excluded.updated_at
		`)
			.bind(
				newConfig.registration_enabled,
				newConfig.turnstile_enabled,
				newConfig.turnstile_site_key,
				newConfig.turnstile_secret_key,
			)
			.run();

		logger.info("System config updated", { userId: payload.userId });

		return successResponse(
			{
				registration_enabled: Boolean(newConfig.registration_enabled),
				turnstile_enabled: Boolean(newConfig.turnstile_enabled),
				turnstile_site_key: newConfig.turnstile_site_key,
			},
			"系统配置已更新",
		);
	} catch (error) {
		logger.error("UpdateSystemConfig error", error);
		return errorResponse("更新系统配置失败", 500);
	}
}

/**
 * 验证 Turnstile Token
 */
export async function verifyTurnstile(
	turnstileToken: string,
	secretKey: string,
	ip?: string,
): Promise<boolean> {
	try {
		const formData = new FormData();
		formData.append("secret", secretKey);
		formData.append("response", turnstileToken);
		if (ip) {
			formData.append("remoteip", ip);
		}

		const response = await fetch(
			"https://challenges.cloudflare.com/turnstile/v0/siteverify",
			{
				method: "POST",
				body: formData,
			},
		);

		const result = (await response.json()) as { success: boolean };
		return result.success;
	} catch (error) {
		logger.error("Turnstile verification error", error);
		return false;
	}
}
