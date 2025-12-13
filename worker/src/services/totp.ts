/**
 * TOTP (Time-based One-Time Password) 服务
 * 实现 RFC 6238 标准的 TOTP 算法
 */

// Base32 字符集
const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * 生成随机的 TOTP 密钥 (Base32 编码)
 */
export function generateSecret(length = 20): string {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	return base32Encode(bytes);
}

/**
 * Base32 编码
 */
function base32Encode(data: Uint8Array): string {
	let result = "";
	let bits = 0;
	let value = 0;

	for (const byte of data) {
		value = (value << 8) | byte;
		bits += 8;

		while (bits >= 5) {
			result += BASE32_CHARS[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}

	if (bits > 0) {
		result += BASE32_CHARS[(value << (5 - bits)) & 31];
	}

	return result;
}

/**
 * Base32 解码
 */
function base32Decode(encoded: string): Uint8Array {
	const cleaned = encoded.toUpperCase().replace(/[^A-Z2-7]/g, "");
	const bytes: number[] = [];
	let bits = 0;
	let value = 0;

	for (const char of cleaned) {
		const index = BASE32_CHARS.indexOf(char);
		if (index === -1) continue;

		value = (value << 5) | index;
		bits += 5;

		if (bits >= 8) {
			bytes.push((value >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}

	return new Uint8Array(bytes);
}

/**
 * 生成 HMAC-SHA1
 */
async function hmacSha1(
	key: Uint8Array,
	data: Uint8Array,
): Promise<Uint8Array> {
	// 创建新的 ArrayBuffer 副本以避免类型问题
	const keyBuffer = new ArrayBuffer(key.length);
	new Uint8Array(keyBuffer).set(key);

	const dataBuffer = new ArrayBuffer(data.length);
	new Uint8Array(dataBuffer).set(data);

	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		keyBuffer,
		{ name: "HMAC", hash: "SHA-1" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBuffer);
	return new Uint8Array(signature);
}

/**
 * 将数字转换为 8 字节大端序数组
 */
function intToBytes(num: number): Uint8Array {
	const bytes = new Uint8Array(8);
	for (let i = 7; i >= 0; i--) {
		bytes[i] = num & 0xff;
		num = Math.floor(num / 256);
	}
	return bytes;
}

/**
 * 生成 TOTP 验证码
 * @param secret Base32 编码的密钥
 * @param timeStep 时间步长（秒），默认 30
 * @param digits 验证码位数，默认 6
 * @param timestamp 时间戳（毫秒），默认当前时间
 */
export async function generateTOTP(
	secret: string,
	timeStep = 30,
	digits = 6,
	timestamp?: number,
): Promise<string> {
	const time = timestamp ?? Date.now();
	const counter = Math.floor(time / 1000 / timeStep);
	const key = base32Decode(secret);
	const counterBytes = intToBytes(counter);

	const hmac = await hmacSha1(key, counterBytes);
	const offset = hmac[hmac.length - 1] & 0x0f;

	const code =
		((hmac[offset] & 0x7f) << 24) |
		((hmac[offset + 1] & 0xff) << 16) |
		((hmac[offset + 2] & 0xff) << 8) |
		(hmac[offset + 3] & 0xff);

	const otp = code % 10 ** digits;
	return otp.toString().padStart(digits, "0");
}

/**
 * 验证 TOTP 验证码
 * @param secret Base32 编码的密钥
 * @param code 用户输入的验证码
 * @param window 允许的时间窗口偏移（前后各 window 个时间步长）
 */
export async function verifyTOTP(
	secret: string,
	code: string,
	window = 1,
): Promise<boolean> {
	const timeStep = 30;
	const now = Date.now();

	// 检查当前时间窗口及前后 window 个时间步长
	for (let i = -window; i <= window; i++) {
		const timestamp = now + i * timeStep * 1000;
		const expectedCode = await generateTOTP(secret, timeStep, 6, timestamp);
		if (expectedCode === code) {
			return true;
		}
	}

	return false;
}

/**
 * 生成 TOTP URI（用于生成二维码）
 * @param secret Base32 编码的密钥
 * @param username 用户名
 * @param issuer 发行者名称（应用名）
 */
export function generateTOTPUri(
	secret: string,
	username: string,
	issuer = "Subly",
): string {
	const encodedIssuer = encodeURIComponent(issuer);
	const encodedUsername = encodeURIComponent(username);
	return `otpauth://totp/${encodedIssuer}:${encodedUsername}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}
