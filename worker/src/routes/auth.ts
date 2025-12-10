import type {
	Env,
	UpdateSettingsRequest,
	UserWithConfig,
} from "../types/index";
import {
	errorResponse,
	generateToken,
	hashPassword,
	isValidSiteUrl,
	logger,
	shouldRefreshToken,
	successResponse,
	USER_WITH_CONFIG_QUERY,
	validateRequest,
	verifyPassword,
	verifyToken,
} from "../utils";

export { sendTestEmail } from "./email";
export { sendTestServerChan } from "./serverchan";

// ==================== 验证 Schema ====================
const registerSchema = {
	username: {
		required: true,
		type: "string" as const,
		minLength: 3,
		maxLength: 50,
	},
	password: {
		required: true,
		type: "string" as const,
		minLength: 6,
		maxLength: 100,
	},
	email: { type: "string" as const },
};

const loginSchema = {
	username: { required: true, type: "string" as const },
	password: { required: true, type: "string" as const },
};

// ==================== 用户认证 ====================

/**
 * 用户注册
 */
export async function register(request: Request, env: Env): Promise<Response> {
	try {
		const body = await request.json();
		const validation = validateRequest<{
			username: string;
			password: string;
			email?: string;
		}>(body, registerSchema);

		if (!validation.valid) {
			return errorResponse(validation.error);
		}

		const { username, password, email } = validation.data;

		const existing = await env.DB.prepare(
			"SELECT id FROM users WHERE username = ?",
		)
			.bind(username)
			.first();

		if (existing) {
			return errorResponse("用户名已存在");
		}

		const hashedPassword = await hashPassword(password);

		// 创建用户
		const result = await env.DB.prepare(
			"INSERT INTO users (username, password) VALUES (?, ?)",
		)
			.bind(username, hashedPassword)
			.run();

		const userId = result.meta.last_row_id;

		// 创建关联的配置记录
		await env.DB.batch([
			env.DB.prepare(
				"INSERT INTO resend_config (user_id, email) VALUES (?, ?)",
			).bind(userId, email ?? ""),
			env.DB.prepare("INSERT INTO serverchan_config (user_id) VALUES (?)").bind(
				userId,
			),
			env.DB.prepare(
				"INSERT INTO exchangerate_config (user_id) VALUES (?)",
			).bind(userId),
		]);

		logger.info("User registered", { username });
		return successResponse(null, "注册成功");
	} catch (error) {
		logger.error("Register error", error);
		return errorResponse("注册失败，请重试", 500);
	}
}

/**
 * 用户登录
 */
export async function login(request: Request, env: Env): Promise<Response> {
	try {
		const body = await request.json();
		const validation = validateRequest<{ username: string; password: string }>(
			body,
			loginSchema,
		);

		if (!validation.valid) {
			return errorResponse(validation.error);
		}

		const { username, password } = validation.data;

		const user = await env.DB.prepare(
			"SELECT id, username, password FROM users WHERE username = ?",
		)
			.bind(username)
			.first<{ id: number; username: string; password: string }>();

		if (!user) {
			return errorResponse("用户不存在");
		}

		const isValid = await verifyPassword(password, user.password);
		if (!isValid) {
			return errorResponse("用户密码错误");
		}

		const token = await generateToken(user.id, user.username);

		// 获取完整用户信息
		const userWithConfig = await env.DB.prepare(
			`${USER_WITH_CONFIG_QUERY} WHERE u.id = ?`,
		)
			.bind(user.id)
			.first<UserWithConfig>();

		logger.info("User logged in", { userId: user.id, username });
		return successResponse({
			token,
			user: userWithConfig,
		});
	} catch (error) {
		logger.error("Login error", error);
		return errorResponse("登录失败，请重试", 500);
	}
}

/**
 * 获取当前用户信息
 */
export async function getMe(request: Request, env: Env): Promise<Response> {
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

		const user = await env.DB.prepare(
			`${USER_WITH_CONFIG_QUERY} WHERE u.id = ?`,
		)
			.bind(payload.userId)
			.first<UserWithConfig>();

		if (!user) {
			return errorResponse("用户不存在", 404);
		}

		const needRefresh = await shouldRefreshToken(token);
		const response: { user: UserWithConfig; newToken?: string } = { user };

		if (needRefresh) {
			response.newToken = await generateToken(payload.userId, payload.username);
			logger.info("Token refreshed", { userId: payload.userId });
		}

		return successResponse(response);
	} catch (error) {
		logger.error("GetMe error", error);
		return errorResponse("获取用户信息失败", 500);
	}
}

// ==================== 用户设置 ====================

/**
 * 更新用户设置（包含所有 API 配置）
 */
export async function updateSettings(
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

		const settings = (await request.json()) as UpdateSettingsRequest;

		// 验证站点 URL
		if (
			settings.site_url !== undefined &&
			settings.site_url !== "" &&
			!isValidSiteUrl(settings.site_url)
		) {
			return errorResponse("站点链接格式无效，必须以 http:// 或 https:// 开头");
		}

		// 获取当前配置
		const current = await env.DB.prepare(
			`${USER_WITH_CONFIG_QUERY} WHERE u.id = ?`,
		)
			.bind(payload.userId)
			.first<UserWithConfig>();

		// 更新用户表
		if (settings.site_url !== undefined) {
			await env.DB.prepare("UPDATE users SET site_url = ? WHERE id = ?")
				.bind(settings.site_url, payload.userId)
				.run();
		}

		// 更新 Resend 配置
		await env.DB.prepare(`
      UPDATE resend_config SET 
        email = ?, api_key = ?, domain = ?, enabled = ?, notify_time = ?, notify_interval = ?
      WHERE user_id = ?
    `)
			.bind(
				settings.email ?? current?.email ?? "",
				settings.resend_api_key ?? current?.resend_api_key ?? "",
				settings.resend_domain ?? current?.resend_domain ?? "",
				settings.resend_enabled !== undefined
					? settings.resend_enabled
						? 1
						: 0
					: (current?.resend_enabled ?? 1),
				settings.resend_notify_time ?? current?.resend_notify_time ?? 8,
				settings.resend_notify_interval ??
					current?.resend_notify_interval ??
					24,
				payload.userId,
			)
			.run();

		// 更新 Server酱 配置
		await env.DB.prepare(`
      UPDATE serverchan_config SET 
        api_key = ?, enabled = ?, notify_time = ?, notify_interval = ?
      WHERE user_id = ?
    `)
			.bind(
				settings.serverchan_api_key ?? current?.serverchan_api_key ?? "",
				settings.serverchan_enabled !== undefined
					? settings.serverchan_enabled
						? 1
						: 0
					: (current?.serverchan_enabled ?? 1),
				settings.serverchan_notify_time ?? current?.serverchan_notify_time ?? 8,
				settings.serverchan_notify_interval ??
					current?.serverchan_notify_interval ??
					24,
				payload.userId,
			)
			.run();

		// 更新 ExchangeRate 配置
		await env.DB.prepare(`
      UPDATE exchangerate_config SET api_key = ?, enabled = ? WHERE user_id = ?
    `)
			.bind(
				settings.exchangerate_api_key ?? current?.exchangerate_api_key ?? "",
				settings.exchangerate_enabled !== undefined
					? settings.exchangerate_enabled
						? 1
						: 0
					: (current?.exchangerate_enabled ?? 1),
				payload.userId,
			)
			.run();

		const user = await env.DB.prepare(
			`${USER_WITH_CONFIG_QUERY} WHERE u.id = ?`,
		)
			.bind(payload.userId)
			.first<UserWithConfig>();

		logger.info("Settings updated", { userId: payload.userId });
		return successResponse(user, "设置已更新");
	} catch (error) {
		logger.error("UpdateSettings error", error);
		return errorResponse("更新设置失败", 500);
	}
}

/**
 * 更新用户个人信息（用户名、邮箱、密码）
 */
export async function updateProfile(
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

		const { username, email, password } = (await request.json()) as {
			username?: string;
			email?: string;
			password?: string;
		};

		if (!username || !email) {
			return errorResponse("用户名和邮箱不能为空");
		}

		if (username.length < 3) {
			return errorResponse("用户名至少3个字符");
		}

		const existing = await env.DB.prepare(
			"SELECT id FROM users WHERE username = ? AND id != ?",
		)
			.bind(username, payload.userId)
			.first();

		if (existing) {
			return errorResponse("用户名已存在");
		}

		// 更新用户名
		let query = "UPDATE users SET username = ?";
		const params: (string | number)[] = [username];

		if (password && password.length >= 6) {
			const hashedPassword = await hashPassword(password);
			query += ", password = ?";
			params.push(hashedPassword);
		} else if (password && password.length < 6) {
			return errorResponse("密码至少6个字符");
		}

		query += " WHERE id = ?";
		params.push(payload.userId);

		await env.DB.prepare(query)
			.bind(...params)
			.run();

		// 更新邮箱到 resend_config
		await env.DB.prepare("UPDATE resend_config SET email = ? WHERE user_id = ?")
			.bind(email, payload.userId)
			.run();

		const user = await env.DB.prepare(
			`${USER_WITH_CONFIG_QUERY} WHERE u.id = ?`,
		)
			.bind(payload.userId)
			.first<UserWithConfig>();

		logger.info("Profile updated", { userId: payload.userId });
		return successResponse(user, "个人信息已更新");
	} catch (error) {
		logger.error("UpdateProfile error", error);
		return errorResponse("更新个人信息失败", 500);
	}
}
