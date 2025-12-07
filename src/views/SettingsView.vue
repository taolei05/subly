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
      <n-card title="系统配置" :bordered="false">
        <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" label-width="140px">
          <!-- 辅助功能：隐藏的用户名输入框，消除浏览器关于密码表单缺少用户名的警告 -->
          <input type="text" autocomplete="username" style="position: absolute; opacity: 0; z-index: -1; width: 0; height: 0;" />
          
          <n-collapse accordion>
            <!-- Resend 配置 -->
            <n-collapse-item title="Resend 邮件配置" name="resend">
              <div style="padding: 16px 0;">
                <n-form-item path="email" label="通知邮箱">
                  <n-input 
                    v-model:value="formData.email"
                    placeholder="用于接收订阅提醒"
                    :input-props="{ autocomplete: 'email' }"
                  />
                </n-form-item>

                <n-form-item path="resend_api_key">
                  <template #label>
                    <div style="display: flex; align-items: center; gap: 4px;">
                      API Key
                      <n-icon size="16" style="cursor: pointer; color: var(--primary-color);" @click="showApiKeyHelp">
                        <InfoIcon />
                      </n-icon>
                    </div>
                  </template>
                  <n-input 
                    v-model:value="formData.resend_api_key" 
                    type="password"
                    placeholder="用于发送邮件通知"
                    show-password-on="click"
                    :input-props="{ autocomplete: 'new-password' }"
                  />
                </n-form-item>
                
                <n-form-item path="resend_domain">
                  <template #label>
                    邮件域名（可选）
                    <n-icon size="18" style="margin-left: 4px; vertical-align: text-bottom; cursor: pointer" @click="handleConfirm">
                      <AlertCircleOutline />
                    </n-icon>
                  </template>
                  <n-input 
                    v-model:value="formData.resend_domain" 
                    placeholder="留空使用默认域名resend.dev"
                  />
                </n-form-item>

                <n-form-item path="resend_notify_time">
                  <template #label>
                    自动发送时间 (北京时间)
                  </template>
                  <n-select
                    v-model:value="formData.resend_notify_time"
                    :options="hourOptions"
                    placeholder="请选择时间 (默认 8 点)"
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
              </div>
            </n-collapse-item>

            <!-- ExchangeRate 配置 -->
            <n-collapse-item title="ExchangeRate 汇率配置" name="exchangerate">
              <div style="padding: 16px 0;">
                <n-form-item path="exchangerate_api_key">
                  <template #label>
                    <div style="display: flex; align-items: center; gap: 4px;">
                      API Key
                      <n-icon size="16" style="cursor: pointer; color: var(--primary-color);" @click="showExchangeRateHelp">
                        <InfoIcon />
                      </n-icon>
                    </div>
                  </template>
                  <n-input 
                    v-model:value="formData.exchangerate_api_key" 
                    type="password"
                    placeholder="用于货币汇率转换"
                    show-password-on="click"
                    :input-props="{ autocomplete: 'new-password' }"
                  />
                </n-form-item>
              </div>
            </n-collapse-item>

            <!-- Server酱 配置 -->
            <n-collapse-item title="Server酱 (微信通知)" name="serverchan">
              <div style="padding: 16px 0;">
                <n-form-item path="serverchan_api_key">
                  <template #label>
                    <div style="display: flex; align-items: center; gap: 4px;">
                      SendKey
                      <n-icon size="16" style="cursor: pointer; color: var(--primary-color);" @click="showServerChanHelp">
                        <InfoIcon />
                      </n-icon>
                    </div>
                  </template>
                  <n-input 
                    v-model:value="formData.serverchan_api_key" 
                    type="password"
                    placeholder="用于微信通知"
                    show-password-on="click"
                    :input-props="{ autocomplete: 'new-password' }"
                  />
                </n-form-item>

                <n-form-item path="serverchan_notify_time">
                  <template #label>
                    自动发送时间 (北京时间)
                  </template>
                  <n-select
                    v-model:value="formData.serverchan_notify_time"
                    :options="hourOptions"
                    placeholder="请选择时间 (默认 8 点)"
                  />
                </n-form-item>

                <n-form-item>
                   <n-button 
                     size="small" 
                     secondary 
                     type="primary" 
                     :loading="testingServerChan"
                     :disabled="!formData.serverchan_api_key"
                     @click="handleTestServerChan"
                   >
                     发送测试消息
                   </n-button>
                </n-form-item>
              </div>
            </n-collapse-item>
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
          label-placement="left"
          label-width="80px"
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
import { AlertCircleOutline } from '@vicons/ionicons5';
import { type FormInst, type FormRules, useDialog, useMessage } from 'naive-ui';
import { h, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import InfoIcon from '../assets/icons/InfoIcon.vue';
import MoonIcon from '../assets/icons/MoonIcon.vue';
import SunIcon from '../assets/icons/SunIcon.vue';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';
import type { UserProfileUpdate, UserSettings } from '../types';

const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const themeStore = useThemeStore();
const authStore = useAuthStore();

const formRef = ref<FormInst | null>(null);
const serverChanFormRef = ref<FormInst | null>(null);
const saving = ref(false);
const testingEmail = ref(false);
const testingServerChan = ref(false);

const formData = reactive<UserSettings>({
  resend_api_key: '',
  resend_domain: '',
  exchangerate_api_key: '',
  email: '',
  resend_notify_time: 8,
  serverchan_api_key: '',
  serverchan_notify_time: 8,
});

const rules: FormRules = {
  resend_api_key: [],
  resend_domain: [],
  exchangerate_api_key: [],
  email: [{ type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }],
  resend_notify_time: [],
  serverchan_api_key: [],
  serverchan_notify_time: [],
};

const hourOptions = Array.from({ length: 24 }, (_, i) => ({
  label: `${String(i).padStart(2, '0')}:00`,
  value: i,
}));

function showApiKeyHelp() {
  dialog.info({
    title: 'Resend API Key',
    content: () => {
      return h('div', [
        h(
          'p',
          { style: 'font-weight: 600; margin-bottom: 8px;' },
          '什么是 Resend？',
        ),
        h(
          'p',
          { style: 'margin-bottom: 12px;' },
          'Resend 是一个现代化的电子邮件发送服务，Subly 使用它来发送订阅到期提醒邮件。',
        ),
        h(
          'p',
          { style: 'font-weight: 600; margin-bottom: 8px;' },
          '如何获取 Key：',
        ),
        h('p', '1. 访问 resend.com 并登录您的账户。'),
        h('p', '2. 在左侧菜单中点击 "API Keys"。'),
        h('p', '3. 点击右上角的 "Create API Key" 按钮。'),
        h(
          'p',
          '4. 输入名称并设置权限（Sending access 即可），创建后复制生成的 Key（以 re_ 开头）。',
        ),
        h(
          'p',
          { style: 'margin-top: 12px; color: #666;' },
          '提示：如果没有自定义域名，Resend只能发送测试邮件到您注册Resend账户的邮箱。',
        ),
      ]);
    },
    positiveText: '知道了',
  });
}

function showExchangeRateHelp() {
  dialog.info({
    title: 'ExchangeRate API Key',
    content: () => {
      return h('div', [
        h(
          'p',
          { style: 'font-weight: 600; margin-bottom: 8px;' },
          '什么是 ExchangeRate-API？',
        ),
        h(
          'p',
          { style: 'margin-bottom: 12px;' },
          'ExchangeRate-API 是一个汇率转换服务，Subly 使用它来自动更新不同货币之间的汇率，以便准确统计总支出。',
        ),
        h(
          'p',
          { style: 'font-weight: 600; margin-bottom: 8px;' },
          '如何获取 Key：',
        ),
        h('p', '1. 访问 exchangerate-api.com 并注册账号。'),
        h('p', '2. 登录后在 Dashboard 页面即可看到您的 API Key。'),
        h('p', '3. 免费版每月提供 1500 次请求，足够个人使用。'),
        h(
          'p',
          { style: 'margin-top: 12px; color: #666;' },
          '提示：API Key 通常是一串 24 位的字符。',
        ),
      ]);
    },
    positiveText: '知道了',
  });
}

function showServerChanHelp() {
  dialog.info({
    title: 'Server酱 SendKey',
    content: () => {
      return h('div', [
        h(
          'p',
          { style: 'font-weight: 600; margin-bottom: 8px;' },
          '什么是 Server酱？',
        ),
        h(
          'p',
          { style: 'margin-bottom: 12px;' },
          'Server酱是一个消息推送服务，可以将通知直接发送到您的微信。',
        ),
        h(
          'p',
          { style: 'font-weight: 600; margin-bottom: 8px;' },
          '如何获取 SendKey：',
        ),
        h('p', '1. 访问 sct.ftqq.com 并使用微信扫码登录。'),
        h('p', '2. 点击顶部菜单的 "SendKey"。'),
        h('p', '3. 复制您的 SendKey（以 SCT 开头）。'),
        h(
          'p',
          { style: 'margin-top: 12px; color: #666;' },
          '提示：请确保已关注 "方糖" 公众号以接收消息。',
        ),
      ]);
    },
    positiveText: '知道了',
  });
}

// 个人信息修改相关状态
const showProfileModal = ref(false);
const profileFormRef = ref<FormInst | null>(null);
const updatingProfile = ref(false);
const profileFormData = reactive<UserProfileUpdate>({
  username: '',
  email: '',
  password: '',
});

const profileRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, message: '用户名至少3个字符', trigger: 'blur' },
  ],
  password: [{ min: 6, message: '密码至少6个字符', trigger: 'blur' }],
};

onMounted(async () => {
  await authStore.fetchUser();
  if (authStore.user) {
    formData.resend_api_key = authStore.user.resend_api_key || '';
    formData.resend_domain = authStore.user.resend_domain || '';
    formData.exchangerate_api_key = authStore.user.exchangerate_api_key || '';
    formData.email = authStore.user.email || '';
    formData.resend_notify_time = authStore.user.resend_notify_time ?? 8;
    formData.serverchan_api_key = authStore.user.serverchan_api_key || '';
    formData.serverchan_notify_time = authStore.user.serverchan_notify_time ?? 8;
  }
});

function goBack() {
  router.push('/');
}

function handleConfirm() {
  dialog.warning({
    title: '提示',
    content:
      '该域名必须通过Resend手动添加并完成DNS配置才可填入，留空使用默认域名resend.dev',
    positiveText: '我知道了',
  });
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
      resend_domain: formData.resend_domain,
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

async function handleTestServerChan() {
  if (!formData.serverchan_api_key) {
    message.warning('请先输入 Server酱 SendKey');
    return;
  }

  testingServerChan.value = true;
  try {
    const result = await authStore.sendTestServerChan({
      serverchan_api_key: formData.serverchan_api_key,
    });

    if (result.success) {
      message.success(result.message || '测试消息已发送，请在微信查看');
    } else {
      message.error(result.message || '发送失败，请检查 SendKey');
    }
  } finally {
    testingServerChan.value = false;
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
