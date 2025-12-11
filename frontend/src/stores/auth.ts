import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { authApi } from '../api/auth';
import type {
  ApiResponse,
  LoginCredentials,
  RegisterData,
  SystemConfig,
  User,
  UserProfileUpdate,
  UserSettings,
} from '../types';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const token = ref<string | null>(localStorage.getItem('token'));
  const systemConfig = ref<SystemConfig | null>(null);

  const isAuthenticated = computed(() => !!token.value);
  const registrationEnabled = computed(
    () => systemConfig.value?.registration_enabled ?? true,
  );

  async function login(credentials: LoginCredentials): Promise<ApiResponse> {
    try {
      const response = await authApi.login(credentials);
      if (response.success && response.data) {
        token.value = response.data.token;
        user.value = response.data.user;
        localStorage.setItem('token', response.data.token);
      }
      return response;
    } catch (error) {
      const msg = error instanceof Error ? error.message : '登录失败，请重试';
      return { success: false, message: msg };
    }
  }

  async function register(data: RegisterData): Promise<ApiResponse> {
    try {
      const response = await authApi.register(data);
      return response;
    } catch (error) {
      const msg = error instanceof Error ? error.message : '注册失败，请重试';
      return { success: false, message: msg };
    }
  }

  async function logout(): Promise<void> {
    token.value = null;
    user.value = null;
    localStorage.removeItem('token');
  }

  async function fetchUser(): Promise<void> {
    if (!token.value) return;
    try {
      const response = await authApi.getMe();
      if (response.success && response.data) {
        const data = response.data as { user: User; newToken?: string } | User;
        // 处理新的响应格式（包含 user 和可选的 newToken）
        if ('user' in data && typeof data.user === 'object') {
          user.value = data.user;
          // 如果服务器返回了新 Token，自动刷新
          if (data.newToken) {
            token.value = data.newToken;
            localStorage.setItem('token', data.newToken);
          }
        } else {
          // 兼容旧格式
          user.value = data as User;
        }
      }
    } catch (error) {
      logout();
    }
  }

  async function updateSettings(settings: UserSettings): Promise<ApiResponse> {
    try {
      // 将 notify_hours 数组转换为逗号分隔的字符串
      const payload = {
        ...settings,
        resend_notify_hours: settings.resend_notify_hours?.join(',') || '8',
        serverchan_notify_hours:
          settings.serverchan_notify_hours?.join(',') || '8',
      };
      const response = await authApi.updateSettings(payload);
      if (response.success && response.data) {
        user.value = response.data;
      }
      return response;
    } catch (error) {
      return { success: false, message: '更新设置失败' };
    }
  }

  async function updateProfile(
    profile: UserProfileUpdate,
  ): Promise<ApiResponse> {
    try {
      const response = await authApi.updateProfile(profile);
      if (response.success && response.data) {
        user.value = response.data;
      }
      return response;
    } catch (error) {
      return { success: false, message: '更新个人信息失败' };
    }
  }

  async function sendTestEmail(data: {
    resend_api_key: string;
    resend_domain: string;
  }): Promise<ApiResponse> {
    try {
      return await authApi.sendTestEmail(data);
    } catch (error) {
      return { success: false, message: '发送测试邮件失败' };
    }
  }

  async function sendTestServerChan(data: {
    serverchan_api_key: string;
  }): Promise<ApiResponse> {
    try {
      return await authApi.sendTestServerChan(data);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : '发送 Server酱测试消息失败';
      return { success: false, message: msg };
    }
  }

  async function fetchSystemConfig(): Promise<void> {
    try {
      const response = await authApi.getSystemConfig();
      if (response.success && response.data) {
        systemConfig.value = response.data;
      }
    } catch (error) {
      // 默认允许注册
      systemConfig.value = { registration_enabled: true };
    }
  }

  async function updateSystemConfig(
    config: Partial<SystemConfig>,
  ): Promise<ApiResponse> {
    try {
      const response = await authApi.updateSystemConfig(config);
      if (response.success && response.data) {
        systemConfig.value = response.data;
      }
      return response;
    } catch (error) {
      return { success: false, message: '更新系统配置失败' };
    }
  }

  return {
    user,
    token,
    systemConfig,
    isAuthenticated,
    registrationEnabled,
    login,
    register,
    logout,
    fetchUser,
    updateSettings,
    updateProfile,
    sendTestEmail,
    sendTestServerChan,
    fetchSystemConfig,
    updateSystemConfig,
  };
});
