import type {
  ApiResponse,
  LoginCredentials,
  RegisterData,
  SystemConfig,
  User,
  UserProfileUpdate,
} from '../types';
import { http } from './http';

interface LoginResponse {
  token?: string;
  user?: User;
  requires_2fa?: boolean;
  user_id?: number;
}

export const authApi = {
  login: (credentials: LoginCredentials) =>
    http.post<ApiResponse<LoginResponse>>('/auth/login', credentials),

  register: (data: RegisterData) =>
    http.post<ApiResponse>('/auth/register', data),

  logout: () => http.post<ApiResponse>('/auth/logout'),

  getMe: () => http.get<ApiResponse<User>>('/auth/me'),

  updateSettings: (settings: Record<string, unknown>) =>
    http.put<ApiResponse<User>>('/settings', settings),

  updateProfile: (profile: UserProfileUpdate) =>
    http.put<ApiResponse<User>>('/auth/profile', profile),

  sendTestEmail: (data: { resend_api_key: string; resend_domain: string }) =>
    http.post<ApiResponse>('/auth/test-email', data),

  sendTestServerChan: (data: { serverchan_api_key: string }) =>
    http.post<ApiResponse>('/auth/test-serverchan', data),

  // 系统配置
  getSystemConfig: () => http.get<ApiResponse<SystemConfig>>('/system/config'),

  updateSystemConfig: (config: Partial<SystemConfig>) =>
    http.put<ApiResponse<SystemConfig>>('/system/config', config),
};
