/**
 * 两步验证 (2FA/TOTP) 路由
 */
import { generateSecret, generateTOTPUri, verifyTOTP } from "../services/totp";
import type { Env } from "../types/index";
import { errorResponse, logger, successResponse, verifyToken } from "../utils";

/**
 * 生成 TOTP 设置信息（密钥和二维码 URI）
 * 用户启用 2FA 前调用此接口获取设置信息
 */
export async function setupTOTP(request: Request, env: Env): Promise<Response> {
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
		const user = await env.DB.prepare(
			"SELECT role, username, totp_enabled FROM users WHERE id = ?",
		)
			.bind(payload.userId)
			.first<{ role: string; username: string; totp_enabled: number }>();

		if (!user) {
			return errorResponse("用户不存在", 404);
		}

		// demo 用户不能启用 2FA
		if (user.role === "demo") {
			return errorResponse("演示账户不能启用两步验证", 403);
		}

		// 如果已启用，不允许重新设置
		if (user.totp_enabled) {
			return errorResponse("两步验证已启用，请先禁用后再重新设置", 400);
		}

		// 生成新的密钥
		const secret = generateSecret();
		const uri = generateTOTPUri(secret, user.username);

		// 临时保存密钥（未启用状态）
		await env.DB.prepare("UPDATE users SET totp_secret = ? WHERE id = ?")
			.bind(secret, payload.userId)
			.run();

		logger.info("TOTP setup initiated", { userId: payload.userId });

		return successResponse({
			secret,
			uri,
		});
	} catch (error) {
		logger.error("SetupTOTP error", error);
		return errorResponse("设置两步验证失败", 500);
	}
}

/**
 * 验证并启用 TOTP
 * 用户输入验证码确认后启用 2FA
 */
export async function enableTOTP(
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

		const { code } = (await request.json()) as { code: string };

		if (!code || code.length !== 6) {
			return errorResponse("请输入6位验证码");
		}

		// 获取用户信息和临时密钥
		const user = await env.DB.prepare(
			"SELECT role, totp_secret, totp_enabled FROM users WHERE id = ?",
		)
			.bind(payload.userId)
			.first<{ role: string; totp_secret: string; totp_enabled: number }>();

		if (!user) {
			return errorResponse("用户不存在", 404);
		}

		if (user.role === "demo") {
			return errorResponse("演示账户不能启用两步验证", 403);
		}

		if (user.totp_enabled) {
			return errorResponse("两步验证已启用", 400);
		}

		if (!user.totp_secret) {
			return errorResponse("请先获取两步验证设置信息", 400);
		}

		// 验证码验证
		const isValid = await verifyTOTP(user.totp_secret, code);
		if (!isValid) {
			return errorResponse("验证码错误，请重试");
		}

		// 启用 2FA
		await env.DB.prepare("UPDATE users SET totp_enabled = 1 WHERE id = ?")
			.bind(payload.userId)
			.run();

		logger.info("TOTP enabled", { userId: payload.userId });

		return successResponse(null, "两步验证已启用");
	} catch (error) {
		logger.error("EnableTOTP error", error);
		return errorResponse("启用两步验证失败", 500);
	}
}

/**
 * 禁用 TOTP
 * 需要验证当前验证码
 */
export async function disableTOTP(
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

		const { code } = (await request.json()) as { code: string };

		if (!code || code.length !== 6) {
			return errorResponse("请输入6位验证码");
		}

		// 获取用户信息
		const user = await env.DB.prepare(
			"SELECT role, totp_secret, totp_enabled FROM users WHERE id = ?",
		)
			.bind(payload.userId)
			.first<{ role: string; totp_secret: string; totp_enabled: number }>();

		if (!user) {
			return errorResponse("用户不存在", 404);
		}

		if (user.role === "demo") {
			return errorResponse("演示账户不能修改两步验证设置", 403);
		}

		if (!user.totp_enabled) {
			return errorResponse("两步验证未启用", 400);
		}

		// 验证码验证
		const isValid = await verifyTOTP(user.totp_secret, code);
		if (!isValid) {
			return errorResponse("验证码错误，请重试");
		}

		// 禁用 2FA 并清除密钥
		await env.DB.prepare(
			"UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?",
		)
			.bind(payload.userId)
			.run();

		logger.info("TOTP disabled", { userId: payload.userId });

		return successResponse(null, "两步验证已禁用");
	} catch (error) {
		logger.error("DisableTOTP error", error);
		return errorResponse("禁用两步验证失败", 500);
	}
}

/**
 * 验证 TOTP（登录时使用）
 */
export async function verifyTOTPCode(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const { userId, code } = (await request.json()) as {
			userId: number;
			code: string;
		};

		if (!userId || !code || code.length !== 6) {
			return errorResponse("参数错误");
		}

		// 获取用户信息
		const user = await env.DB.prepare(
			"SELECT totp_secret, totp_enabled FROM users WHERE id = ?",
		)
			.bind(userId)
			.first<{ totp_secret: string; totp_enabled: number }>();

		if (!user) {
			return errorResponse("用户不存在", 404);
		}

		if (!user.totp_enabled || !user.totp_secret) {
			return errorResponse("两步验证未启用", 400);
		}

		// 验证码验证
		const isValid = await verifyTOTP(user.totp_secret, code);
		if (!isValid) {
			return errorResponse("验证码错误，请重试");
		}

		return successResponse({ valid: true });
	} catch (error) {
		logger.error("VerifyTOTP error", error);
		return errorResponse("验证失败", 500);
	}
}
