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

		// 如果没有配置记录，返回默认值
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
 * 更新系统配置（仅限第一个注册的用户）
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

		// 检查是否为第一个注册的用户（管理员）
		const firstUser = await env.DB.prepare(
			"SELECT id FROM users ORDER BY id ASC LIMIT 1",
		).first<{ id: number }>();

		if (!firstUser || firstUser.id !== payload.userId) {
			return errorResponse("仅管理员可修改系统配置", 403);
		}

		const { registration_enabled } = (await request.json()) as {
			registration_enabled?: boolean;
		};

		if (registration_enabled === undefined) {
			return errorResponse("缺少必要参数");
		}

		await env.DB.prepare(`
			INSERT INTO system_config (id, registration_enabled, updated_at)
			VALUES (1, ?, datetime('now'))
			ON CONFLICT(id) DO UPDATE SET
				registration_enabled = excluded.registration_enabled,
				updated_at = excluded.updated_at
		`)
			.bind(registration_enabled ? 1 : 0)
			.run();

		logger.info("System config updated", {
			userId: payload.userId,
			registration_enabled,
		});

		return successResponse({ registration_enabled }, "系统配置已更新");
	} catch (error) {
		logger.error("UpdateSystemConfig error", error);
		return errorResponse("更新系统配置失败", 500);
	}
}
