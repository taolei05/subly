<template>
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
</template>

<script setup lang="ts">
import { AlertCircleOutline } from '@vicons/ionicons5';
import { type FormRules, useDialog, useMessage } from 'naive-ui';
import { h, ref } from 'vue';
import InfoIcon from '../../assets/icons/InfoIcon.vue';
import { useAuthStore } from '../../stores/auth';
import type { UserSettings } from '../../types';

const props = defineProps<{ formData: UserSettings }>();

const dialog = useDialog();
const message = useMessage();
const authStore = useAuthStore();
const testingEmail = ref(false);

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

function handleConfirm() {
  dialog.warning({
    title: '提示',
    content:
      '该域名必须通过Resend手动添加并完成DNS配置才可填入，留空使用默认域名resend.dev',
    positiveText: '我知道了',
  });
}

async function handleTestEmail() {
  if (!props.formData.resend_api_key) {
    message.warning('请先输入 Resend API Key');
    return;
  }
  testingEmail.value = true;
  try {
    const result = await authStore.sendTestEmail({
      resend_api_key: props.formData.resend_api_key,
      resend_domain: props.formData.resend_domain,
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
</script>

