import type { ApiResponse, Attachment } from '../types';

const API_BASE = '/api';

async function uploadRequest<T>(
  endpoint: string,
  formData: FormData,
): Promise<T> {
  const token = localStorage.getItem('token');

  const headers: HeadersInit = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: '请求失败' }));
    throw new Error(error.message || '请求失败');
  }

  return response.json();
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: '请求失败' }));
    throw new Error(error.message || '请求失败');
  }

  return response.json();
}

export const attachmentApi = {
  // 获取订阅的所有附件
  getBySubscription: (subscriptionId: number) =>
    request<ApiResponse<Attachment[]>>(
      `/subscriptions/${subscriptionId}/attachments`,
    ),

  // 上传附件
  upload: (subscriptionId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return uploadRequest<ApiResponse<Attachment>>(
      `/subscriptions/${subscriptionId}/attachments`,
      formData,
    );
  },

  // 获取附件下载/预览 URL
  getUrl: (attachmentId: number, download = false) => {
    const token = localStorage.getItem('token');
    // 开发环境使用完整的后端地址
    const isDev =
      window.location.port === '3000' || window.location.port === '3001';
    const base = isDev ? 'http://localhost:8787' : '';
    return `${base}/api/attachments/${attachmentId}?token=${token}${download ? '&download=true' : ''}`;
  },

  // 获取附件内容（用于预览）
  getBlob: async (attachmentId: number): Promise<Blob> => {
    const token = localStorage.getItem('token');
    const isDev =
      window.location.port === '3000' || window.location.port === '3001';
    const base = isDev ? 'http://localhost:8787' : '';
    const url = `${base}/api/attachments/${attachmentId}?token=${token}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('获取文件失败');
    }
    return response.blob();
  },

  // 删除附件
  delete: (attachmentId: number) =>
    request<ApiResponse>(`/attachments/${attachmentId}`, { method: 'DELETE' }),
};
