import type { Env } from "../types/index";
import { logger } from "../utils";

// ==================== 配置常量 ====================

// IP 级别限制配置
const IP_RATE_LIMIT = {
	// 短期限制：每分钟最多 10 次请求
	SHORT_WINDOW_MS: 60 * 1000,
	SHORT_MAX_ATTEMPTS: 10,
	// 中期限制：每小时最多 60 次请求
	MEDIUM_WINDOW_MS: 60 * 60 * 1000,
	MEDIUM_MAX_ATTEMPTS: 60,
	// 长期限制：每天最多 200 次请求
	LONG_WINDOW_MS: 24 * 60 * 60 * 1000,
	LONG_MAX_ATTEMPTS: 200,
};

// 用户名级别限制配置（防止针对特定账户的暴力破解）
const USERNAME_RATE_LIMIT = {
	// 每 15 分钟最多 5 次失败尝试
	WINDOW_MS: 15 * 60 * 1000,
	MAX_ATTEMPTS: 5,
	// 锁定时间（渐进式）
	LOCKOUT_MULTIPLIER: 2, // 每次锁定时间翻倍
	INITIAL_LOCKOUT_MS: 5 * 60 * 1000, // 初始锁定 5 分钟
	MAX_LOCKOUT_MS: 24 * 60 * 60 * 1000, // 最大锁定 24 小时
};

// 注册限制配置
const REGISTER_RATE_LIMIT = {
	// 每个 IP 每小时最多注册 3 个账户
	WINDOW_MS: 60 * 60 * 1000,
	MAX_ATTEMPTS: 3,
};

// ==================== 类型定义 ====================

interface RateLimitRecord {
	attempts: number;
	first_attempt_at: number;
	last_attempt_at: number;
	lockout_until?: number;
	lockout_count?: number;
}

interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	reset_at: number;
	retry_after?: number;
	message?: string;
}

// ==================== 数据库操作 ====================

async function getRateLimitRecord(
	env: Env,
	key: string,
): Promise<RateLimitRecord | null> {
	try {
		const result = await env.DB.prepare(
			"SELECT * FROM rate_limits WHERE key = ?",
		)
			.bind(key)
			.first<{
				key: string;
				attempts: number;
				first_attempt_at: number;
				last_attempt_at: number;
				lockout_until: number | null;
				lockout_count: number | null;
			}>();

		if (!result) return null;

		return {
			attempts: result.attempts,
			first_attempt_at: result.first_attempt_at,
			last_attempt_at: result.last_attempt_at,
			lockout_until: result.lockout_until ?? undefined,
			lockout_count: result.lockout_count ?? undefined,
		};
	} catch {
		// 表可能不存在，返回 null
		return null;
	}
}

async function setRateLimitRecord(
	env: Env,
	key: string,
	record: RateLimitRecord,
): Promise<void> {
	try {
		await env.DB.prepare(`
			INSERT INTO rate_limits (key, attempts, first_attempt_at, last_attempt_at, lockout_until, lockout_count)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(key) DO UPDATE SET
				attempts = excluded.attempts,
				first_attempt_at = excluded.first_attempt_at,
				last_attempt_at = excluded.last_attempt_at,
				lockout_until = excluded.lockout_until,
				lockout_count = excluded.lockout_count
		`)
			.bind(
				key,
				record.attempts,
				record.first_attempt_at,
				record.last_attempt_at,
				record.lockout_until ?? null,
				record.lockout_count ?? null,
			)
			.run();
	} catch (error) {
		logger.error("[RateLimit] Failed to set record", { key, error });
	}
}

async function deleteRateLimitRecord(env: Env, key: string): Promise<void> {
	try {
		await env.DB.prepare("DELETE FROM rate_limits WHERE key = ?")
			.bind(key)
			.run();
	} catch {
		// 忽略删除错误
	}
}

// ==================== 核心限制逻辑 ====================

/**
 * 检查 IP 级别的频率限制
 */
export async function checkIpRateLimit(
	env: Env,
	ip: string,
	action: "login" | "register",
): Promise<RateLimitResult> {
	const now = Date.now();
	const keyPrefix = `ip:${action}:${ip}`;

	// 检查短期限制（每分钟）
	const shortKey = `${keyPrefix}:short`;
	const shortResult = await checkWindowLimit(
		env,
		shortKey,
		now,
		IP_RATE_LIMIT.SHORT_WINDOW_MS,
		IP_RATE_LIMIT.SHORT_MAX_ATTEMPTS,
	);
	if (!shortResult.allowed) {
		return {
			...shortResult,
			message: `请求过于频繁，请 ${Math.ceil((shortResult.retry_after || 0) / 1000)} 秒后重试`,
		};
	}

	// 检查中期限制（每小时）
	const mediumKey = `${keyPrefix}:medium`;
	const mediumResult = await checkWindowLimit(
		env,
		mediumKey,
		now,
		IP_RATE_LIMIT.MEDIUM_WINDOW_MS,
		IP_RATE_LIMIT.MEDIUM_MAX_ATTEMPTS,
	);
	if (!mediumResult.allowed) {
		return {
			...mediumResult,
			message: `该 IP 请求次数过多，请 ${Math.ceil((mediumResult.retry_after || 0) / 60000)} 分钟后重试`,
		};
	}

	// 检查长期限制（每天）
	const longKey = `${keyPrefix}:long`;
	const longResult = await checkWindowLimit(
		env,
		longKey,
		now,
		IP_RATE_LIMIT.LONG_WINDOW_MS,
		IP_RATE_LIMIT.LONG_MAX_ATTEMPTS,
	);
	if (!longResult.allowed) {
		return {
			...longResult,
			message: `该 IP 今日请求次数已达上限，请明天再试`,
		};
	}

	return {
		allowed: true,
		remaining: Math.min(
			shortResult.remaining,
			mediumResult.remaining,
			longResult.remaining,
		),
		reset_at: Math.min(
			shortResult.reset_at,
			mediumResult.reset_at,
			longResult.reset_at,
		),
	};
}

/**
 * 检查用户名级别的频率限制（仅用于登录失败）
 */
export async function checkUsernameRateLimit(
	env: Env,
	username: string,
): Promise<RateLimitResult> {
	const now = Date.now();
	const key = `username:login:${username.toLowerCase()}`;

	const record = await getRateLimitRecord(env, key);

	// 检查是否在锁定期内
	if (record?.lockout_until && record.lockout_until > now) {
		const retryAfter = record.lockout_until - now;
		return {
			allowed: false,
			remaining: 0,
			reset_at: record.lockout_until,
			retry_after: retryAfter,
			message: `账户已被临时锁定，请 ${formatDuration(retryAfter)} 后重试`,
		};
	}

	// 检查窗口期内的失败次数
	if (record) {
		const windowStart = now - USERNAME_RATE_LIMIT.WINDOW_MS;

		// 如果记录在窗口期外，重置
		if (record.first_attempt_at < windowStart) {
			await deleteRateLimitRecord(env, key);
			return {
				allowed: true,
				remaining: USERNAME_RATE_LIMIT.MAX_ATTEMPTS,
				reset_at: now + USERNAME_RATE_LIMIT.WINDOW_MS,
			};
		}

		// 检查是否超过最大尝试次数
		if (record.attempts >= USERNAME_RATE_LIMIT.MAX_ATTEMPTS) {
			// 计算锁定时间（渐进式）
			const lockoutCount = (record.lockout_count || 0) + 1;
			const lockoutDuration = Math.min(
				USERNAME_RATE_LIMIT.INITIAL_LOCKOUT_MS *
					USERNAME_RATE_LIMIT.LOCKOUT_MULTIPLIER ** (lockoutCount - 1),
				USERNAME_RATE_LIMIT.MAX_LOCKOUT_MS,
			);
			const lockoutUntil = now + lockoutDuration;

			// 更新锁定状态
			await setRateLimitRecord(env, key, {
				...record,
				lockout_until: lockoutUntil,
				lockout_count: lockoutCount,
			});

			logger.warn("[RateLimit] Username locked", {
				username,
				lockoutCount,
				lockoutDuration,
			});

			return {
				allowed: false,
				remaining: 0,
				reset_at: lockoutUntil,
				retry_after: lockoutDuration,
				message: `登录失败次数过多，账户已被锁定 ${formatDuration(lockoutDuration)}`,
			};
		}

		return {
			allowed: true,
			remaining: USERNAME_RATE_LIMIT.MAX_ATTEMPTS - record.attempts,
			reset_at: record.first_attempt_at + USERNAME_RATE_LIMIT.WINDOW_MS,
		};
	}

	return {
		allowed: true,
		remaining: USERNAME_RATE_LIMIT.MAX_ATTEMPTS,
		reset_at: now + USERNAME_RATE_LIMIT.WINDOW_MS,
	};
}

/**
 * 检查注册频率限制
 */
export async function checkRegisterRateLimit(
	env: Env,
	ip: string,
): Promise<RateLimitResult> {
	const now = Date.now();

	// 检查每小时限制
	const hourlyKey = `ip:register:${ip}:hourly`;
	const hourlyResult = await checkWindowLimit(
		env,
		hourlyKey,
		now,
		REGISTER_RATE_LIMIT.WINDOW_MS,
		REGISTER_RATE_LIMIT.MAX_ATTEMPTS,
	);
	if (!hourlyResult.allowed) {
		return {
			...hourlyResult,
			message: `注册过于频繁，请 ${Math.ceil((hourlyResult.retry_after || 0) / 60000)} 分钟后重试`,
		};
	}

	return {
		allowed: true,
		remaining: hourlyResult.remaining,
		reset_at: hourlyResult.reset_at,
	};
}

// ==================== 记录操作 ====================

/**
 * 记录 IP 请求（成功或失败都记录）
 */
export async function recordIpAttempt(
	env: Env,
	ip: string,
	action: "login" | "register",
): Promise<void> {
	const now = Date.now();
	const keyPrefix = `ip:${action}:${ip}`;

	// 记录到所有时间窗口
	await Promise.all([
		incrementAttempt(
			env,
			`${keyPrefix}:short`,
			now,
			IP_RATE_LIMIT.SHORT_WINDOW_MS,
		),
		incrementAttempt(
			env,
			`${keyPrefix}:medium`,
			now,
			IP_RATE_LIMIT.MEDIUM_WINDOW_MS,
		),
		incrementAttempt(
			env,
			`${keyPrefix}:long`,
			now,
			IP_RATE_LIMIT.LONG_WINDOW_MS,
		),
	]);
}

/**
 * 记录登录失败（用于用户名级别限制）
 */
export async function recordLoginFailure(
	env: Env,
	username: string,
): Promise<void> {
	const now = Date.now();
	const key = `username:login:${username.toLowerCase()}`;

	const record = await getRateLimitRecord(env, key);

	if (record) {
		const windowStart = now - USERNAME_RATE_LIMIT.WINDOW_MS;

		// 如果记录在窗口期外，重置
		if (record.first_attempt_at < windowStart) {
			await setRateLimitRecord(env, key, {
				attempts: 1,
				first_attempt_at: now,
				last_attempt_at: now,
				lockout_count: record.lockout_count, // 保留锁定计数
			});
		} else {
			await setRateLimitRecord(env, key, {
				...record,
				attempts: record.attempts + 1,
				last_attempt_at: now,
			});
		}
	} else {
		await setRateLimitRecord(env, key, {
			attempts: 1,
			first_attempt_at: now,
			last_attempt_at: now,
		});
	}

	logger.info("[RateLimit] Login failure recorded", { username });
}

/**
 * 登录成功后清除用户名的失败记录
 */
export async function clearLoginFailures(
	env: Env,
	username: string,
): Promise<void> {
	const key = `username:login:${username.toLowerCase()}`;
	await deleteRateLimitRecord(env, key);
	logger.info("[RateLimit] Login failures cleared", { username });
}

/**
 * 记录注册成功
 */
export async function recordRegisterSuccess(
	env: Env,
	ip: string,
): Promise<void> {
	const now = Date.now();

	await incrementAttempt(
		env,
		`ip:register:${ip}:hourly`,
		now,
		REGISTER_RATE_LIMIT.WINDOW_MS,
	);
}

// ==================== 辅助函数 ====================

async function checkWindowLimit(
	env: Env,
	key: string,
	now: number,
	windowMs: number,
	maxAttempts: number,
): Promise<RateLimitResult> {
	const record = await getRateLimitRecord(env, key);

	if (!record) {
		return {
			allowed: true,
			remaining: maxAttempts,
			reset_at: now + windowMs,
		};
	}

	const windowStart = now - windowMs;

	// 如果记录在窗口期外，允许并重置
	if (record.first_attempt_at < windowStart) {
		await deleteRateLimitRecord(env, key);
		return {
			allowed: true,
			remaining: maxAttempts,
			reset_at: now + windowMs,
		};
	}

	const remaining = maxAttempts - record.attempts;
	const resetAt = record.first_attempt_at + windowMs;

	if (remaining <= 0) {
		return {
			allowed: false,
			remaining: 0,
			reset_at: resetAt,
			retry_after: resetAt - now,
		};
	}

	return {
		allowed: true,
		remaining,
		reset_at: resetAt,
	};
}

async function incrementAttempt(
	env: Env,
	key: string,
	now: number,
	windowMs: number,
): Promise<void> {
	const record = await getRateLimitRecord(env, key);
	const windowStart = now - windowMs;

	if (record && record.first_attempt_at >= windowStart) {
		await setRateLimitRecord(env, key, {
			...record,
			attempts: record.attempts + 1,
			last_attempt_at: now,
		});
	} else {
		await setRateLimitRecord(env, key, {
			attempts: 1,
			first_attempt_at: now,
			last_attempt_at: now,
		});
	}
}

function formatDuration(ms: number): string {
	const seconds = Math.ceil(ms / 1000);
	if (seconds < 60) return `${seconds} 秒`;

	const minutes = Math.ceil(seconds / 60);
	if (minutes < 60) return `${minutes} 分钟`;

	const hours = Math.ceil(minutes / 60);
	if (hours < 24) return `${hours} 小时`;

	const days = Math.ceil(hours / 24);
	return `${days} 天`;
}

// ==================== 清理过期记录 ====================

/**
 * 清理过期的频率限制记录（可在定时任务中调用）
 */
export async function cleanupExpiredRecords(env: Env): Promise<number> {
	try {
		const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 小时前

		const result = await env.DB.prepare(`
			DELETE FROM rate_limits 
			WHERE last_attempt_at < ? 
			AND (lockout_until IS NULL OR lockout_until < ?)
		`)
			.bind(cutoff, Date.now())
			.run();

		const deleted = result.meta.changes || 0;
		if (deleted > 0) {
			logger.info("[RateLimit] Cleaned up expired records", { deleted });
		}
		return deleted;
	} catch {
		return 0;
	}
}

// ==================== 获取客户端 IP ====================

export function getClientIp(request: Request): string {
	// Cloudflare 提供的真实 IP
	const cfIp = request.headers.get("CF-Connecting-IP");
	if (cfIp) return cfIp;

	// 其他代理头
	const xForwardedFor = request.headers.get("X-Forwarded-For");
	if (xForwardedFor) {
		return xForwardedFor.split(",")[0].trim();
	}

	const xRealIp = request.headers.get("X-Real-IP");
	if (xRealIp) return xRealIp;

	// 默认返回未知
	return "unknown";
}
