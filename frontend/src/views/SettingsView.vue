<template>
  <n-layout class="page-container">
    <n-layout-header bordered class="header">
      <div class="header-content">
        <div class="header-left">
          <n-button quaternary @click="goBack">
            <template #icon>
              <n-icon size="20">
                <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8l8 8l1.41-1.41L7.83 13H20v-2z"/>
                </svg>
              </n-icon>
            </template>
            返回
          </n-button>
          <h1 class="title">系统设置</h1>
        </div>
        <div class="header-right">
          <n-button quaternary circle @click="themeStore.toggleTheme">
            <template #icon>
              <Icon :name="themeStore.isDark ? 'sun' : 'moon'" :size="20" />
            </template>
          </n-button>
        </div>
      </div>
    </n-layout-header>
    
    <n-layout-content class="content-wrapper">
      <n-card title="系统配置" :bordered="false">
        <n-form ref="formRef" :model="formData" :rules="rules" label-placement="top">
          <!-- 辅助功能：隐藏的用户名输入框，消除浏览器关于密码表单缺少用户名的警告 -->
          <input type="text" autocomplete="username" style="position: absolute; opacity: 0; z-index: -1; width: 0; height: 0;" />
          
          <n-collapse accordion>
            <ResendSettingsPanel :formData="formData" />
            <ExchangeRateSettingsPanel :formData="formData" />
            <ServerChanSettingsPanel :formData="formData" />
          </n-collapse>

          <div style="margin-top: 24px; display: flex; justify-content: flex-end;">
            <n-button type="primary" :loading="saving" @click="handleSave" size="large" style="width: 100%;">
              保存所有设置
            </n-button>
          </div>
        </n-form>
      </n-card>
      
      <n-card title="账户管理" :bordered="false" style="margin-top: 24px;">
        <n-descriptions label-placement="left" :column="1">
          <n-descriptions-item label="用户名">
            {{ authStore.user?.username || '-' }}
          </n-descriptions-item>
        </n-descriptions>
        <template #action>
          <n-button block secondary type="primary" @click="openProfileModal">
             修改账户信息 (用户名/邮箱/密码)
          </n-button>
        </template>
      </n-card>

      <n-card title="安全设置" :bordered="false" style="margin-top: 24px;">
        <n-form label-placement="left">
          <n-form-item label="允许用户注册">
            <n-switch
              v-model:value="registrationEnabled"
              :loading="updatingSystemConfig"
              @update:value="handleRegistrationToggle"
            />
          </n-form-item>
          <n-text depth="3" style="font-size: 12px; display: block; margin-bottom: 16px;">
            关闭后，新用户将无法注册账号。适用于单用户场景，首次注册后可关闭此选项。
          </n-text>

          <n-divider />

          <n-form-item label="启用 Turnstile 人机验证">
            <n-switch
              v-model:value="turnstileEnabled"
              :loading="updatingSystemConfig"
              @update:value="handleTurnstileToggle"
            />
          </n-form-item>
          <n-text depth="3" style="font-size: 12px; display: block; margin-bottom: 16px;">
            启用后，用户注册时需要完成 Cloudflare Turnstile 人机验证。
          </n-text>

          <template v-if="turnstileEnabled">
            <n-form-item label="Site Key">
              <n-input
                v-model:value="turnstileSiteKey"
                placeholder="请输入 Turnstile Site Key"
              />
            </n-form-item>
            <n-form-item label="Secret Key">
              <n-input
                v-model:value="turnstileSecretKey"
                type="password"
                show-password-on="click"
                placeholder="请输入 Turnstile Secret Key"
              />
            </n-form-item>
            <n-button
              type="primary"
              :loading="savingTurnstile"
              @click="handleSaveTurnstile"
              style="width: 100%;"
            >
              保存 Turnstile 配置
            </n-button>
          </template>
        </n-form>
      </n-card>

      <!-- 修改个人信息弹窗 -->
      <n-modal
        v-model:show="showProfileModal"
        preset="card"
        :title="'修改个人信息'"
        :style="{ width: '500px' }"
      >
        <n-form
          ref="profileFormRef"
          :model="profileFormData"
          :rules="profileRules"
          label-placement="top"
        >
          <n-form-item path="username" label="用户名">
            <n-input v-model:value="profileFormData.username" placeholder="请输入用户名" />
          </n-form-item>
          
          
          
          <n-form-item path="password" label="新密码">
            <n-input
              v-model:value="profileFormData.password"
              type="password"
              show-password-on="click"
              placeholder="留空则不修改密码"
            />
          </n-form-item>
          
          <n-alert type="warning" :show-icon="true" style="margin-bottom: 24px;">
            修改用户名或密码后，您可能需要重新登录。
          </n-alert>
        </n-form>
        
        <template #footer>
          <div style="display: flex; justify-content: flex-end; gap: 12px;">
            <n-button @click="showProfileModal = false">取消</n-button>
            <n-button type="primary" :loading="updatingProfile" @click="handleUpdateProfile">
              保存修改
            </n-button>
          </div>
        </template>
      </n-modal>
    </n-layout-content>
  </n-layout>
</template>

<script setup lang="ts">
import { type FormInst, type FormRules, useMessage } from 'naive-ui';
import { h, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import Icon from '../components/common/Icon.vue';
import ExchangeRateSettingsPanel from '../components/settings/ExchangeRateSettingsPanel.vue';
import ResendSettingsPanel from '../components/settings/ResendSettingsPanel.vue';
import ServerChanSettingsPanel from '../components/settings/ServerChanSettingsPanel.vue';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import type { UserProfileUpdate, UserSettings } from '../types';

// 解析通知时间字符串为数组
function parseNotifyHours(hoursStr?: string): number[] {
  if (!hoursStr) return [8];
  return hoursStr
    .split(',')
    .map((h) => Number.parseInt(h.trim(), 10))
    .filter((h) => !Number.isNaN(h));
}

const router = useRouter();
const message = useMessage();
const themeStore = useThemeStore();
const authStore = useAuthStore();

const formRef = ref<FormInst | null>(null);
const serverChanFormRef = ref<FormInst | null>(null);
const saving = ref(false);

const formData = reactive<UserSettings>({
  resend_api_key: '',
  resend_domain: '',
  exchangerate_api_key: '',
  email: '',
  resend_notify_hours: [8],
  serverchan_api_key: '',
  serverchan_notify_hours: [8],
  site_url: '',
  resend_enabled: true,
  serverchan_enabled: true,
  exchangerate_enabled: true,
});

const rules: FormRules = {
  resend_api_key: [],
  resend_domain: [],
  exchangerate_api_key: [],
  email: [{ type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }],
  serverchan_api_key: [],
};

// 个人信息修改相关状态
const showProfileModal = ref(false);
const profileFormRef = ref<FormInst | null>(null);
const updatingProfile = ref(false);
const profileFormData = reactive<UserProfileUpdate>({
  username: '',
  email: '',
  password: '',
});

// 系统配置
const registrationEnabled = ref(true);
const updatingSystemConfig = ref(false);
const turnstileEnabled = ref(false);
const turnstileSiteKey = ref('');
const turnstileSecretKey = ref('');
const savingTurnstile = ref(false);

const profileRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, message: '用户名至少3个字符', trigger: 'blur' },
  ],
  password: [{ min: 6, message: '密码至少6个字符', trigger: 'blur' }],
};

onMounted(async () => {
  await authStore.fetchUser();
  await authStore.fetchSystemConfig();
  registrationEnabled.value = authStore.registrationEnabled;
  turnstileEnabled.value = authStore.turnstileEnabled;
  turnstileSiteKey.value = authStore.turnstileSiteKey;
  if (authStore.user) {
    formData.resend_api_key = authStore.user.resend_api_key || '';
    formData.resend_domain = authStore.user.resend_domain || '';
    formData.exchangerate_api_key = authStore.user.exchangerate_api_key || '';
    formData.email = authStore.user.email || '';
    formData.resend_notify_hours = parseNotifyHours(
      authStore.user.resend_notify_hours,
    );
    formData.serverchan_api_key = authStore.user.serverchan_api_key || '';
    formData.serverchan_notify_hours = parseNotifyHours(
      authStore.user.serverchan_notify_hours,
    );
    formData.site_url = authStore.user.site_url || '';
    // SQLite 返回数字 0/1，需要转换为布尔值
    formData.resend_enabled =
      authStore.user.resend_enabled === undefined
        ? true
        : Boolean(authStore.user.resend_enabled);
    formData.serverchan_enabled =
      authStore.user.serverchan_enabled === undefined
        ? true
        : Boolean(authStore.user.serverchan_enabled);
    formData.exchangerate_enabled =
      authStore.user.exchangerate_enabled === undefined
        ? true
        : Boolean(authStore.user.exchangerate_enabled);
  }

  // Auto-capture site URL from current browser origin and update if different
  const currentOrigin = window.location.origin;
  if (formData.site_url !== currentOrigin) {
    formData.site_url = currentOrigin;
    // Auto-save the site_url to backend with full formData
    await authStore.updateSettings(formData);
  }
});

function goBack() {
  router.push('/');
}

async function handleSave() {
  saving.value = true;
  try {
    const result = await authStore.updateSettings(formData);
    if (result.success) {
      message.success('设置已保存');
    } else {
      message.error(result.message || '保存失败');
    }
  } finally {
    saving.value = false;
  }
}

function openProfileModal() {
  if (authStore.user) {
    profileFormData.username = authStore.user.username;
    profileFormData.email = authStore.user.email;
    profileFormData.password = ''; // 密码留空
    showProfileModal.value = true;
  }
}

async function handleUpdateProfile() {
  if (!profileFormRef.value) return;

  await profileFormRef.value.validate(async (errors) => {
    if (!errors) {
      updatingProfile.value = true;
      try {
        const result = await authStore.updateProfile(profileFormData);
        if (result.success) {
          message.success('个人信息已更新');
          showProfileModal.value = false;
        } else {
          message.error(result.message || '更新失败');
        }
      } finally {
        updatingProfile.value = false;
      }
    }
  });
}

async function handleRegistrationToggle(value: boolean) {
  updatingSystemConfig.value = true;
  try {
    const result = await authStore.updateSystemConfig({
      registration_enabled: value,
    });
    if (result.success) {
      message.success(value ? '已开启用户注册' : '已关闭用户注册');
    } else {
      // 恢复原值
      registrationEnabled.value = !value;
      message.error(result.message || '更新失败');
    }
  } catch {
    registrationEnabled.value = !value;
    message.error('更新失败');
  } finally {
    updatingSystemConfig.value = false;
  }
}

async function handleTurnstileToggle(value: boolean) {
  updatingSystemConfig.value = true;
  try {
    const result = await authStore.updateSystemConfig({
      turnstile_enabled: value,
    });
    if (result.success) {
      message.success(
        value ? '已开启 Turnstile 验证' : '已关闭 Turnstile 验证',
      );
    } else {
      turnstileEnabled.value = !value;
      message.error(result.message || '更新失败');
    }
  } catch {
    turnstileEnabled.value = !value;
    message.error('更新失败');
  } finally {
    updatingSystemConfig.value = false;
  }
}

async function handleSaveTurnstile() {
  if (!turnstileSiteKey.value || !turnstileSecretKey.value) {
    message.error('请填写 Site Key 和 Secret Key');
    return;
  }
  savingTurnstile.value = true;
  try {
    const result = await authStore.updateSystemConfig({
      turnstile_site_key: turnstileSiteKey.value,
      turnstile_secret_key: turnstileSecretKey.value,
    });
    if (result.success) {
      message.success('Turnstile 配置已保存');
    } else {
      message.error(result.message || '保存失败');
    }
  } catch {
    message.error('保存失败');
  } finally {
    savingTurnstile.value = false;
  }
}
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background-color: var(--bg-color);
}

.header {
  height: 60px;
  padding: 0 24px;
  display: flex;
  align-items: center;
}

.header-content {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.content-wrapper {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

@media (max-width: 768px) {
  .header {
    padding: 0 16px;
  }
  
  .content-wrapper {
    padding: 16px;
  }
}
</style>
