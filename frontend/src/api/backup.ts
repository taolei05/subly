import type { ApiResponse, BackupFile } from '../types';

const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function triggerBackup(
  toEmail: boolean,
  toR2: boolean,
): Promise<ApiResponse> {
  const response = await fetch(`${API_BASE}/backup/trigger`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ to_email: toEmail, to_r2: toR2 }),
  });
  return response.json();
}

export async function getBackupList(): Promise<ApiResponse<BackupFile[]>> {
  const response = await fetch(`${API_BASE}/backup/list`, {
    headers: getAuthHeaders(),
  });
  return response.json();
}

export async function downloadBackup(
  date: string,
  format: 'json' | 'csv' = 'json',
): Promise<string | null> {
  const response = await fetch(
    `${API_BASE}/backup/download?date=${date}&format=${format}`,
    {
      headers: getAuthHeaders(),
    },
  );

  if (!response.ok) {
    return null;
  }

  return response.text();
}
