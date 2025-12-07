import type { JWTPayload } from './types';

const JWT_SECRET = 'subly-secret-key-change-in-production';
const JWT_EXPIRY = 7 * 24 * 60 * 60; // 7 天

// 简单的 Base64 URL 编码
function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

// 创建 HMAC 签名
async function createSignature(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
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
  const header = { alg: 'HS256', typ: 'JWT' };
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
    const parts = token.split('.');
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

// 简易密码哈希 (生产环境应使用 bcrypt 或 argon2)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + JWT_SECRET);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 验证密码
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const computedHash = await hashPassword(password);
  return computedHash === hash;
}

// CORS 头
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// JSON 响应辅助函数
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// 错误响应
export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ success: false, message }, status);
}

// 成功响应
export function successResponse<T>(data?: T, message?: string): Response {
  return jsonResponse({ success: true, data, message });
}
