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
		// 检查是否允许注册
		const config = await env.DB.prepare(
			"SELECT registration_enabled FROM system_config WHERE id = 1",
		).first<{ registration_enabled: number }>();

		// 如果配置存在且禁用注册，则拒绝
		if (config && !config.registration_enabled) {
			return errorResponse("注册功能已关闭");
		}

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

		// 检查是否为第一个用户（自动成为管理员）
		const userCount = await env.DB.prepare(
			"SELECT COUNT(*) as count FROM users",
		).first<{ count: number }>();
		const role = userCount?.count === 0 ? "admin" : "user";

		// 创建用户
		const result = await env.DB.prepare(
			"INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
		)
			.bind(username, hashedPassword, role)
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
 * 更新用户设置
 * - admin: 可修改所有配置
 * - user: 只能修改通知邮箱
 * - demo: 不能修改任何设置
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

		// 获取用户角色
		const currentUser = await env.DB.prepare(
			"SELECT role FROM users WHERE id = ?",
		)
			.bind(payload.userId)
			.first<{ role: string }>();

		if (!currentUser) {
			return errorResponse("用户不存在", 404);
		}

		const { role } = currentUser;

		// demo 用户不能修改任何设置
		if (role === "demo") {
			return errorResponse("演示账户不能修改设置", 403);
		}

		const settings = (await request.json()) as UpdateSettingsRequest;
		const isAdmin = role === "admin";

		// 非管理员尝试修改受限配置时返回错误
		if (!isAdmin) {
			const restrictedFields = [
				"resend_api_key",
				"resend_domain",
				"resend_enabled",
				"resend_notify_hours",
				"serverchan_api_key",
				"serverchan_enabled",
				"serverchan_notify_hours",
				"exchangerate_api_key",
				"exchangerate_enabled",
				"site_url",
			];
			const hasRestrictedField = restrictedFields.some(
				(field) => settings[field as keyof UpdateSettingsRequest] !== undefined,
			);
			if (hasRestrictedField) {
				return errorResponse("仅管理员可修改 API 配置", 403);
			}
		}

		// 验证站点 URL（仅管理员可修改）
		if (
			isAdmin &&
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

		// 更新用户表（仅管理员可修改 site_url）
		if (isAdmin && settings.site_url !== undefined) {
			await env.DB.prepare("UPDATE users SET site_url = ? WHERE id = ?")
				.bind(settings.site_url, payload.userId)
				.run();
		}

		// 更新 Resend 配置
		if (isAdmin) {
			// 管理员可修改所有字段
			await env.DB.prepare(`
				INSERT INTO resend_config (user_id, email, api_key, domain, enabled, notify_hours)
				VALUES (?, ?, ?, ?, ?, ?)
				ON CONFLICT(user_id) DO UPDATE SET
					email = excluded.email,
					api_key = excluded.api_key,
					domain = excluded.domain,
					enabled = excluded.enabled,
					notify_hours = excluded.notify_hours
			`)
				.bind(
					payload.userId,
					settings.email ?? current?.email ?? "",
					settings.resend_api_key ?? current?.resend_api_key ?? "",
					settings.resend_domain ?? current?.resend_domain ?? "",
					settings.resend_enabled !== undefined
						? settings.resend_enabled
							? 1
							: 0
						: (current?.resend_enabled ?? 1),
					settings.resend_notify_hours ?? current?.resend_notify_hours ?? "8",
				)
				.run();
		} else if (settings.email !== undefined) {
			// 普通用户只能修改通知邮箱
			await env.DB.prepare(
				"UPDATE resend_config SET email = ? WHERE user_id = ?",
			)
				.bind(settings.email, payload.userId)
				.run();
		}

		// 更新 Server酱 配置（仅管理员）
		if (isAdmin) {
			await env.DB.prepare(`
				INSERT INTO serverchan_config (user_id, api_key, enabled, notify_hours)
				VALUES (?, ?, ?, ?)
				ON CONFLICT(user_id) DO UPDATE SET
					api_key = excluded.api_key,
					enabled = excluded.enabled,
					notify_hours = excluded.notify_hours
			`)
				.bind(
					payload.userId,
					settings.serverchan_api_key ?? current?.serverchan_api_key ?? "",
					settings.serverchan_enabled !== undefined
						? settings.serverchan_enabled
							? 1
							: 0
						: (current?.serverchan_enabled ?? 1),
					settings.serverchan_notify_hours ??
						current?.serverchan_notify_hours ??
						"8",
				)
				.run();
		}

		// 更新 ExchangeRate 配置（仅管理员）
		if (isAdmin) {
			await env.DB.prepare(`
				INSERT INTO exchangerate_config (user_id, api_key, enabled)
				VALUES (?, ?, ?)
				ON CONFLICT(user_id) DO UPDATE SET
					api_key = excluded.api_key,
					enabled = excluded.enabled
			`)
				.bind(
					payload.userId,
					settings.exchangerate_api_key ?? current?.exchangerate_api_key ?? "",
					settings.exchangerate_enabled !== undefined
						? settings.exchangerate_enabled
							? 1
							: 0
						: (current?.exchangerate_enabled ?? 1),
				)
				.run();
		}

		const user = await env.DB.prepare(
			`${USER_WITH_CONFIG_QUERY} WHERE u.id = ?`,
		)
			.bind(payload.userId)
			.first<UserWithConfig>();

		logger.info("Settings updated", { userId: payload.userId, role });
		return successResponse(user, "设置已更新");
	} catch (error) {
		logger.error("UpdateSettings error", error);
		return errorResponse("更新设置失败", 500);
	}
}

/**
 * 更新用户个人信息（用户名、邮箱、密码）
 * - demo 用户不能修改个人信息
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

		// 检查用户角色
		const currentUser = await env.DB.prepare(
			"SELECT role FROM users WHERE id = ?",
		)
			.bind(payload.userId)
			.first<{ role: string }>();

		if (!currentUser) {
			return errorResponse("用户不存在", 404);
		}

		// demo 用户不能修改个人信息
		if (currentUser.role === "demo") {
			return errorResponse("演示账户不能修改个人信息", 403);
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
