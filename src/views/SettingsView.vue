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
              <n-icon size="20">
                <SunIcon v-if="themeStore.isDark" />
                <MoonIcon v-else />
              </n-icon>
            </template>
          </n-button>
        </div>
      </div>
    </n-layout-header>
    
    <n-layout-content class="content-wrapper">
      <n-card title="API 配置" :bordered="false">
        <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" label-width="140px">
          <n-form-item path="resend_api_key" label="Resend API Key">
            <n-input 
              v-model:value="formData.resend_api_key" 
              type="password"
              placeholder="用于发送邮件通知"
              show-password-on="click"
            />
          </n-form-item>
          
          <n-form-item path="resend_domain" label="Resend邮件域名（可选）">
            <n-input 
              v-model:value="formData.resend_domain" 
              placeholder="留空使用默认域名 resend.dev"
            />
          </n-form-item>

          <n-form-item>
             <n-button 
               size="small" 
               secondary 
               type="primary" 
               :loading="testingEmail"
               :disabled="!formData.resend_api_key"
               @click="handleTestEmail"
             >
               发送测试邮件
             </n-button>
          </n-form-item>
          
          <n-form-item path="exchangerate_api_key" label="ExchangeRate API Key">
            <n-input 
              v-model:value="formData.exchangerate_api_key" 
              type="password"
              placeholder="用于货币汇率转换"
              show-password-on="click"
            />
          </n-form-item>
          
          <n-form-item>
            <n-button type="primary" :loading="saving" @click="handleSave">
              保存设置
            </n-button>
          </n-form-item>
        </n-form>
      </n-card>
      
      <n-card title="账户信息" :bordered="false" style="margin-top: 24px;">
        <n-descriptions label-placement="left" :column="1">
          <n-descriptions-item label="用户名">
            {{ authStore.user?.username || '-' }}
          </n-descriptions-item>
          <n-descriptions-item label="通知邮箱">
            {{ authStore.user?.email || '-' }}
          </n-descriptions-item>
          <n-descriptions-item label="注册时间">
            {{ formatDate(authStore.user?.created_at) }}
          </n-descriptions-item>
        </n-descriptions>
      </n-card>
    </n-layout-content>
  </n-layout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage, type FormInst, type FormRules } from 'naive-ui';
import { useThemeStore } from '../stores/theme';
import { useAuthStore } from '../stores/auth';
import type { UserSettings } from '../types';

import SunIcon from '../assets/icons/SunIcon.vue';
import MoonIcon from '../assets/icons/MoonIcon.vue';

const router = useRouter();
const message = useMessage();
const themeStore = useThemeStore();
const authStore = useAuthStore();

const formRef = ref<FormInst | null>(null);
const saving = ref(false);
const testingEmail = ref(false);

const formData = reactive<UserSettings>({
  resend_api_key: '',
  resend_domain: '',
  exchangerate_api_key: ''
});

const rules: FormRules = {
  resend_api_key: [],
  resend_domain: [],
  exchangerate_api_key: []
};

onMounted(async () => {
  await authStore.fetchUser();
  if (authStore.user) {
    formData.resend_api_key = authStore.user.resend_api_key || '';
    formData.resend_domain = authStore.user.resend_domain || '';
    formData.exchangerate_api_key = authStore.user.exchangerate_api_key || '';
  }
});

function goBack() {
  router.push('/');
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

async function handleTestEmail() {
  if (!formData.resend_api_key) {
    message.warning('请先输入 Resend API Key');
    return;
  }

  testingEmail.value = true;
  try {
    const result = await authStore.sendTestEmail({
      resend_api_key: formData.resend_api_key,
      resend_domain: formData.resend_domain
    });
    
    if (result.success) {
      message.success(result.message || '测试邮件已发送，请查收');
    } else {
      message.error(result.message || '发送失败，请检查配置');
    }
  } finally {
    testingEmail.value = false;
  }
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
