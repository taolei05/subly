import type { ApiResponse, BackupFile, SettingsBackupFile } from '../types';

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
  backupSubscriptions = true,
  backupSettings = false,
): Promise<ApiResponse> {
  const response = await fetch(`${API_BASE}/backup/trigger`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      to_email: toEmail,
      to_r2: toR2,
      backup_subscriptions: backupSubscriptions,
      backup_settings: backupSettings,
    }),
  });
  return response.json();
}

export async function getBackupList(
  type: 'subscriptions' | 'settings' = 'subscriptions',
): Promise<ApiResponse<BackupFile[] | SettingsBackupFile[]>> {
  const response = await fetch(`${API_BASE}/backup/list?type=${type}`, {
    headers: getAuthHeaders(),
  });
  return response.json();
}

export async function downloadBackup(
  date: string,
  format: 'json' | 'csv' = 'json',
  type: 'subscriptions' | 'settings' = 'subscriptions',
): Promise<string | null> {
  const response = await fetch(
    `${API_BASE}/backup/download?date=${date}&format=${format}&type=${type}`,
    {
      headers: getAuthHeaders(),
    },
  );

  if (!response.ok) {
    return null;
  }

  return response.text();
}

export async function restoreBackup(
  data: Record<string, unknown>[],
): Promise<ApiResponse> {
  const response = await fetch(`${API_BASE}/subscriptions/import`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ data }),
  });
  return response.json();
}

export async function restoreSettings(
  settings: Record<string, unknown>,
): Promise<ApiResponse> {
  const response = await fetch(`${API_BASE}/settings/restore`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ settings }),
  });
  return response.json();
}
