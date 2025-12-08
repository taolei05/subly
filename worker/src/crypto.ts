/**
 * API Key 加密工具
 * 使用 Web Crypto API 实现 AES-256-GCM 加密
 * 需求: 5.1, 5.2
 */

// 加密密钥 - 生产环境应从环境变量获取
const ENCRYPTION_KEY = 'subly-encryption-key-32-bytes!!';

/**
 * 将字符串转换为 ArrayBuffer
 */
function stringToArrayBuffer(str: string): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(str).buffer;
}

/**
 * 将 ArrayBuffer 转换为字符串
 */
function arrayBufferToString(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder();
  return decoder.decode(buffer);
}

/**
 * 将 ArrayBuffer 转换为 Base64 字符串
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * 将 Base64 字符串转换为 ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 获取加密密钥
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyData = stringToArrayBuffer(ENCRYPTION_KEY);
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * 加密 API Key
 * @param plaintext 明文 API Key
 * @returns 加密后的字符串 (格式: iv:ciphertext，均为 Base64 编码)
 */
export async function encryptApiKey(plaintext: string): Promise<string> {
  if (!plaintext) {
    return '';
  }

  const key = await getEncryptionKey();

  // 生成随机 IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 加密
  const plaintextBuffer = stringToArrayBuffer(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintextBuffer,
  );

  // 返回 iv:ciphertext 格式
  const ivBase64 = arrayBufferToBase64(iv.buffer);
  const ciphertextBase64 = arrayBufferToBase64(ciphertext);

  return `${ivBase64}:${ciphertextBase64}`;
}

/**
 * 解密 API Key
 * @param encrypted 加密后的字符串 (格式: iv:ciphertext)
 * @returns 解密后的明文 API Key
 */
export async function decryptApiKey(encrypted: string): Promise<string> {
  if (!encrypted) {
    return '';
  }

  // 检查是否是加密格式 (包含冒号分隔符)
  if (!encrypted.includes(':')) {
    // 可能是未加密的旧数据，直接返回
    return encrypted;
  }

  try {
    const [ivBase64, ciphertextBase64] = encrypted.split(':');

    const key = await getEncryptionKey();
    const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
    const ciphertext = base64ToArrayBuffer(ciphertextBase64);

    // 解密
    const plaintextBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );

    return arrayBufferToString(plaintextBuffer);
  } catch (error) {
    console.error('Decryption error:', error);
    // 解密失败，可能是未加密的旧数据
    return encrypted;
  }
}

/**
 * 检查字符串是否已加密
 * @param value 要检查的字符串
 * @returns 是否已加密
 */
export function isEncrypted(value: string): boolean {
  if (!value) {
    return false;
  }
  // 加密格式: iv:ciphertext (两部分都是 Base64)
  const parts = value.split(':');
  if (parts.length !== 2) {
    return false;
  }
  // 检查 IV 长度 (12 bytes = 16 chars in Base64)
  try {
    const ivBuffer = base64ToArrayBuffer(parts[0]);
    return ivBuffer.byteLength === 12;
  } catch {
    return false;
  }
}

/**
 * 脱敏显示 API Key
 * @param apiKey API Key (可以是加密或明文)
 * @param visibleChars 前后显示的字符数，默认 4
 * @returns 脱敏后的字符串，如 "re_1234****5678"
 */
export function maskApiKey(apiKey: string, visibleChars = 4): string {
  if (!apiKey) {
    return '';
  }

  // 如果是加密格式，只显示 "已配置"
  if (isEncrypted(apiKey)) {
    return '******（已加密）';
  }

  const len = apiKey.length;
  if (len <= visibleChars * 2) {
    return '*'.repeat(len);
  }

  const start = apiKey.slice(0, visibleChars);
  const end = apiKey.slice(-visibleChars);
  const middle = '*'.repeat(Math.min(8, len - visibleChars * 2));

  return `${start}${middle}${end}`;
}
