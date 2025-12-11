import type { JWTPayload } from "../types/index";

// JWT 密钥从环境变量获取，运行时通过 setJwtSecret 设置
let JWT_SECRET = "";
const JWT_EXPIRY = 7 * 24 * 60 * 60; // 7 天
const TOKEN_REFRESH_THRESHOLD = 24 * 60 * 60; // 24小时内过期则刷新

/**
 * 设置 JWT 密钥（应在 worker 启动时调用）
 */
export function setJwtSecret(secret: string): void {
	if (!secret || secret.length < 32) {
		throw new Error("JWT_SECRET 必须至少 32 个字符");
	}
	JWT_SECRET = secret;
}

/**
 * 获取 JWT 密钥（内部使用）
 */
function getJwtSecret(): string {
	if (!JWT_SECRET) {
		throw new Error("JWT_SECRET 未设置，请在环境变量中配置");
	}
	return JWT_SECRET;
}

// 简单的 Base64 URL 编码
function base64UrlEncode(str: string): string {
	return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(str: string): string {
	str = str.replace(/-/g, "+").replace(/_/g, "/");
	while (str.length % 4) str += "=";
	return atob(str);
}

// 创建 HMAC 签名
async function createSignature(data: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(getJwtSecret()),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
	return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

// 验证签名
async function verifySignature(
	data: string,
	signature: string,
): Promise<boolean> {
	const expectedSignature = await createSignature(data);
	return signature === expectedSignature;
}

// 生成 JWT Token
export async function generateToken(
	userId: number,
	username: string,
): Promise<string> {
	const header = { alg: "HS256", typ: "JWT" };
	const payload: JWTPayload = {
		userId,
		username,
		exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY,
	};

	const headerStr = base64UrlEncode(JSON.stringify(header));
	const payloadStr = base64UrlEncode(JSON.stringify(payload));
	const signature = await createSignature(`${headerStr}.${payloadStr}`);

	return `${headerStr}.${payloadStr}.${signature}`;
}

// 验证 JWT Token
export async function verifyToken(token: string): Promise<JWTPayload | null> {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return null;

		const [headerStr, payloadStr, signature] = parts;
		const isValid = await verifySignature(
			`${headerStr}.${payloadStr}`,
			signature,
		);
		if (!isValid) return null;

		const payload: JWTPayload = JSON.parse(base64UrlDecode(payloadStr));
		if (payload.exp < Math.floor(Date.now() / 1000)) return null;

		return payload;
	} catch {
		return null;
	}
}

// 检查是否需要刷新 Token
export async function shouldRefreshToken(token: string): Promise<boolean> {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return false;

		const payload: JWTPayload = JSON.parse(base64UrlDecode(parts[1]));
		const now = Math.floor(Date.now() / 1000);
		const timeUntilExpiry = payload.exp - now;

		return timeUntilExpiry > 0 && timeUntilExpiry < TOKEN_REFRESH_THRESHOLD;
	} catch {
		return false;
	}
}

// 密码哈希使用 PBKDF2（Cloudflare Workers 支持）
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
	const encoder = new TextEncoder();
	// 生成随机盐值
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

	// 导入密码作为密钥
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);

	// 使用 PBKDF2 派生密钥
	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: salt,
			iterations: PBKDF2_ITERATIONS,
			hash: "SHA-256",
		},
		keyMaterial,
		256,
	);

	// 将盐值和哈希值组合存储
	const hashArray = Array.from(new Uint8Array(derivedBits));
	const saltHex = Array.from(salt)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	const hashHex = hashArray
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	return `${saltHex}:${hashHex}`;
}

// 验证密码
export async function verifyPassword(
	password: string,
	storedHash: string,
): Promise<boolean> {
	const encoder = new TextEncoder();

	// 检查是否是新格式（包含盐值）
	if (storedHash.includes(":")) {
		const [saltHex, hashHex] = storedHash.split(":");
		const saltBytes = saltHex.match(/.{2}/g);
		if (!saltBytes) {
			return false;
		}
		const salt = new Uint8Array(
			saltBytes.map((byte) => Number.parseInt(byte, 16)),
		);

		const keyMaterial = await crypto.subtle.importKey(
			"raw",
			encoder.encode(password),
			"PBKDF2",
			false,
			["deriveBits"],
		);

		const derivedBits = await crypto.subtle.deriveBits(
			{
				name: "PBKDF2",
				salt: salt,
				iterations: PBKDF2_ITERATIONS,
				hash: "SHA-256",
			},
			keyMaterial,
			256,
		);

		const computedHashHex = Array.from(new Uint8Array(derivedBits))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		return computedHashHex === hashHex;
	}

	// 兼容旧格式（无盐值的 SHA-256）- 用于迁移期间
	const data = encoder.encode(password + getJwtSecret());
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const computedHash = Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	return computedHash === storedHash;
}
