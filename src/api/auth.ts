import { http } from './http';
import type { LoginCredentials, RegisterData, User, UserSettings, ApiResponse } from '../types';

interface LoginResponse {
    token: string;
    user: User;
}

export const authApi = {
    login: (credentials: LoginCredentials) =>
        http.post<ApiResponse<LoginResponse>>('/auth/login', credentials),

    register: (data: RegisterData) =>
        http.post<ApiResponse>('/auth/register', data),

    logout: () =>
        http.post<ApiResponse>('/auth/logout'),

    getMe: () =>
        http.get<ApiResponse<User>>('/auth/me'),

    updateSettings: (settings: UserSettings) =>
        http.put<ApiResponse<User>>('/settings', settings),

    sendTestEmail: (data: { resend_api_key: string; resend_domain: string }) =>
        http.post<ApiResponse>('/email/test', data)
};
