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
      <!-- Demo 用户提示 -->
      <n-alert v-if="authStore.isDemo" type="warning" style="margin-bottom: 24px;">
        您正在使用演示账户，无法修改任何设置。
      </n-alert>

      <!-- 系统配置 -->
      <n-card title="系统配置" :bordered="false">
        <n-form :model="formData" :rules="rules" label-placement="top">
          <!-- 辅助功能：隐藏的用户名输入框，消除浏览器关于密码表单缺少用户名的警告 -->
          <input type="text" autocomplete="username" style="position: absolute; opacity: 0; z-index: -1; width: 0; height: 0;" />
          
          <n-collapse accordion>
            <ResendSettingsPanel :formData="formData" :disabled="authStore.isDemo" />
            <n-divider style="margin: 0;" />
            <ExchangeRateSettingsPanel :formData="formData" :disabled="authStore.isDemo" />
            <n-divider style="margin: 0;" />
            <ServerChanSettingsPanel :formData="formData" :disabled="authStore.isDemo" />
          </n-collapse>

          <div style="margin-top: 24px; display: flex; justify-content: flex-end;">
            <n-button 
              type="primary" 
              :loading="saving" 
              :disabled="authStore.isDemo"
              @click="handleSave" 
              size="large" 
              style="width: 100%;"
            >
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
          <n-descriptions-item label="角色">
            <n-tag :type="roleTagType">{{ roleLabel }}</n-tag>
          </n-descriptions-item>
        </n-descriptions>
        <template #action>
          <n-button 
            block 
            secondary 
            type="primary" 
            :disabled="authStore.isDemo"
            @click="openProfileModal"
          >
             修改账户信息 (用户名/邮箱/密码)
          </n-button>
        </template>
      </n-card>

      <!-- 安全设置 -->
      <n-card title="安全设置" :bordered="false" style="margin-top: 24px;">
        <n-form-item label="本站链接" label-placement="top">
          <template #label>
            <div style="display: flex; align-items: center; gap: 4px;">
              本站链接
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-icon size="16" style="cursor: pointer; color: var(--primary-color);">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                  </n-icon>
                </template>
                此链接会自动获取当前站点地址，用于在通知中添加"查看详情"按钮。
              </n-tooltip>
            </div>
          </template>
          <n-input
            :value="formData.site_url"
            disabled
            placeholder="自动获取当前站点地址"
          />
        </n-form-item>

        <n-form-item label="允许用户注册" label-placement="left">
          <n-switch
            v-model:value="registrationEnabled"
            :loading="updatingSystemConfig"
            :disabled="!authStore.isAdmin"
            @update:value="handleRegistrationToggle"
          />
        </n-form-item>
        <n-text depth="3" style="font-size: 12px;">
          关闭后，新用户将无法注册账号。适用于单用户场景，首次注册后可关闭此选项。
          <template v-if="!authStore.isAdmin">
            <br />（仅管理员可修改此设置）
          </template>
        </n-text>
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
import { computed, onMounted, reactive, ref } from 'vue';
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

const saving = ref(false);

const formData = reactive<UserSettings>({
  resend_api_key: '',
  resend_domain: '',
  exchangerate_api_key: '',
  email: '',
  resend_notify_hours: [8],
  resend_template_subject: '',
  resend_template_body: '',
  serverchan_api_key: '',
  serverchan_notify_hours: [8],
  serverchan_template_title: '',
  serverchan_template_body: '',
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

const profileRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, message: '用户名至少3个字符', trigger: 'blur' },
  ],
  password: [{ min: 6, message: '密码至少6个字符', trigger: 'blur' }],
};

// 角色显示
const roleLabel = computed(() => {
  const roleMap: Record<string, string> = {
    admin: '管理员',
    user: '普通用户',
    demo: '演示用户',
  };
  return roleMap[authStore.userRole] || '未知';
});

const roleTagType = computed(() => {
  const typeMap: Record<string, 'success' | 'info' | 'warning'> = {
    admin: 'success',
    user: 'info',
    demo: 'warning',
  };
  return typeMap[authStore.userRole] || 'info';
});

onMounted(async () => {
  await authStore.fetchUser();
  await authStore.fetchSystemConfig();
  registrationEnabled.value = authStore.registrationEnabled;
  if (authStore.user) {
    formData.resend_api_key = authStore.user.resend_api_key || '';
    formData.resend_domain = authStore.user.resend_domain || '';
    formData.exchangerate_api_key = authStore.user.exchangerate_api_key || '';
    formData.email = authStore.user.email || '';
    formData.resend_notify_hours = parseNotifyHours(
      authStore.user.resend_notify_hours,
    );
    formData.resend_template_subject =
      authStore.user.resend_template_subject || '';
    formData.resend_template_body = authStore.user.resend_template_body || '';
    formData.serverchan_api_key = authStore.user.serverchan_api_key || '';
    formData.serverchan_notify_hours = parseNotifyHours(
      authStore.user.serverchan_notify_hours,
    );
    formData.serverchan_template_title =
      authStore.user.serverchan_template_title || '';
    formData.serverchan_template_body =
      authStore.user.serverchan_template_body || '';
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
