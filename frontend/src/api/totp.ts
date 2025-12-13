import type { ApiResponse } from '../types';

const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface TOTPSetupResponse {
  secret: string;
  uri: string;
}

/**
 * 获取 TOTP 设置信息（密钥和二维码 URI）
 */
export async function setupTOTP(): Promise<ApiResponse<TOTPSetupResponse>> {
  const response = await fetch(`${API_BASE}/auth/2fa/setup`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return response.json();
}

/**
 * 启用 TOTP
 */
export async function enableTOTP(code: string): Promise<ApiResponse> {
  const response = await fetch(`${API_BASE}/auth/2fa/enable`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ code }),
  });
  return response.json();
}

/**
 * 禁用 TOTP
 */
export async function disableTOTP(code: string): Promise<ApiResponse> {
  const response = await fetch(`${API_BASE}/auth/2fa/disable`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ code }),
  });
  return response.json();
}
