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
			"SELECT registration_enabled FROM system_config WHERE id = 1",
		).first<{ registration_enabled: number }>();

		if (!config) {
			return successResponse({ registration_enabled: true });
		}

		return successResponse({
			registration_enabled: Boolean(config.registration_enabled),
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
		};

		const current = await env.DB.prepare(
			"SELECT * FROM system_config WHERE id = 1",
		).first<{ registration_enabled: number }>();

		const newConfig = {
			registration_enabled:
				body.registration_enabled !== undefined
					? body.registration_enabled
						? 1
						: 0
					: (current?.registration_enabled ?? 1),
		};

		await env.DB.prepare(`
			INSERT INTO system_config (id, registration_enabled, updated_at)
			VALUES (1, ?, datetime('now'))
			ON CONFLICT(id) DO UPDATE SET
				registration_enabled = excluded.registration_enabled,
				updated_at = excluded.updated_at
		`)
			.bind(newConfig.registration_enabled)
			.run();

		logger.info("System config updated", { userId: payload.userId });

		return successResponse(
			{ registration_enabled: Boolean(newConfig.registration_enabled) },
			"系统配置已更新",
		);
	} catch (error) {
		logger.error("UpdateSystemConfig error", error);
		return errorResponse("更新系统配置失败", 500);
	}
}
