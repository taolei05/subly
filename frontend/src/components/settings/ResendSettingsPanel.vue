<template>
  <n-collapse-item title="Resend 邮件配置" name="resend">
    <div style="padding: 16px 0;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <span>启用邮件提醒</span>
        <n-switch v-model:value="formData.resend_enabled" :disabled="disabled" />
      </div>

      <n-form-item path="email" label="通知邮箱">
        <n-input
          v-model:value="formData.email"
          placeholder="用于接收订阅提醒"
          :disabled="disabled"
          :input-props="{ autocomplete: 'email' }"
        />
      </n-form-item>

      <n-form-item path="resend_api_key">
        <template #label>
          <div style="display: flex; align-items: center; gap: 4px;">
            API Key
            <Icon name="info" :size="18" style="cursor: pointer; color: var(--primary-color);" @click="showApiKeyHelp" />
          </div>
        </template>
        <n-input
          v-model:value="formData.resend_api_key"
          type="password"
          placeholder="用于发送邮件通知"
          show-password-on="click"
          :disabled="disabled"
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
          :disabled="disabled"
        />
      </n-form-item>

      <n-form-item path="resend_notify_hours">
        <template #label>
          指定发送时间（北京时间24小时制，可多选）
        </template>
        <n-select
          v-model:value="formData.resend_notify_hours"
          :options="hourOptions"
          multiple
          placeholder="选择发送时间点"
          :disabled="disabled"
        />
      </n-form-item>

      <n-form-item>
        <n-button
          size="small"
          secondary
          type="primary"
          :loading="testingEmail"
          :disabled="disabled || !formData.resend_api_key"
          @click="handleTestEmail"
        >
          发送测试邮件
        </n-button>
      </n-form-item>

      <n-divider />

      <n-form-item>
        <template #label>
          <div style="display: flex; align-items: center; gap: 4px;">
            自定义邮件模板
            <Icon name="info" :size="18" style="cursor: pointer; color: var(--primary-color);" @click="showTemplateHelp" />
          </div>
        </template>
        <n-button
          secondary
          :disabled="disabled"
          @click="openTemplateDialog"
        >
          {{ formData.resend_template_subject || formData.resend_template_body ? '编辑模板' : '配置模板' }}
        </n-button>
        <n-text v-if="formData.resend_template_subject || formData.resend_template_body" depth="3" style="margin-left: 12px; font-size: 12px;">
          已配置自定义模板
        </n-text>
      </n-form-item>

      <n-divider />

      <n-form-item path="site_url">
        <template #label>
          <div style="display: flex; align-items: center; gap: 4px;">
            本站链接
            <Icon name="info" :size="18" style="cursor: pointer; color: var(--primary-color);" @click="showSiteUrlHelp" />
          </div>
        </template>
        <n-input
          :value="formData.site_url"
          disabled
          placeholder="自动获取当前站点地址"
        />
      </n-form-item>
    </div>
  </n-collapse-item>
</template>

<script setup lang="ts">
import { AlertCircleOutline } from '@vicons/ionicons5';
import { useDialog, useMessage } from 'naive-ui';
import { h, ref } from 'vue';
import { useAuthStore } from '../../stores/auth';
import type { UserSettings } from '../../types';
import Icon from '../common/Icon.vue';

const props = defineProps<{ formData: UserSettings; disabled?: boolean }>();

const dialog = useDialog();
const message = useMessage();
const authStore = useAuthStore();
const testingEmail = ref(false);

// 生成 0-23 小时选项
const hourOptions = Array.from({ length: 24 }, (_, i) => ({
  label: `${i.toString().padStart(2, '0')}:00`,
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

function showSiteUrlHelp() {
  dialog.info({
    title: '本站链接',
    content: () => {
      return h('div', [
        h(
          'p',
          { style: 'margin-bottom: 12px;' },
          '此链接会自动获取您当前访问的站点地址，用于在邮件提醒中添加"查看详情"按钮。',
        ),
        h(
          'p',
          { style: 'margin-bottom: 12px;' },
          '点击邮件中的"查看详情"按钮后，将跳转到此地址查看订阅详情。',
        ),
        h(
          'p',
          { style: 'color: #666;' },
          '提示：此字段为只读，系统会自动更新为您当前访问的站点地址。',
        ),
      ]);
    },
    positiveText: '知道了',
  });
}

function showTemplateHelp() {
  dialog.info({
    title: '模板变量说明',
    content: () => {
      return h('div', [
        h(
          'p',
          { style: 'font-weight: 600; margin-bottom: 8px;' },
          '支持 HTML 格式',
        ),
        h(
          'p',
          { style: 'margin-bottom: 12px; color: #666;' },
          '邮件内容支持 HTML 标签，可以自定义样式和布局。',
        ),
        h(
          'p',
          { style: 'font-weight: 600; margin-bottom: 8px;' },
          '可用变量：',
        ),
        h('p', '• {{count}} - 即将到期的订阅数量'),
        h('p', '• {{subscriptions}} - 订阅列表（HTML表格格式）'),
        h('p', '• {{time}} - 发送时间'),
        h('p', '• {{site_url}} - 站点链接'),
      ]);
    },
    positiveText: '知道了',
  });
}

// 临时存储模板编辑值
const tempSubject = ref('');
const tempBody = ref('');

function openTemplateDialog() {
  tempSubject.value = props.formData.resend_template_subject || '';
  tempBody.value = props.formData.resend_template_body || '';

  dialog.create({
    title: '自定义邮件模板',
    style: { width: '600px' },
    content: () => {
      return h('div', { style: 'padding: 8px 0;' }, [
        h('div', { style: 'margin-bottom: 16px;' }, [
          h(
            'label',
            { style: 'display: block; margin-bottom: 8px; font-weight: 500;' },
            '邮件标题',
          ),
          h('input', {
            value: tempSubject.value,
            placeholder: '留空使用默认标题，支持变量：{{count}}',
            style:
              'width: 100%; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px;',
            onInput: (e: Event) => {
              tempSubject.value = (e.target as HTMLInputElement).value;
            },
          }),
        ]),
        h('div', { style: 'margin-bottom: 16px;' }, [
          h(
            'label',
            { style: 'display: block; margin-bottom: 8px; font-weight: 500;' },
            '邮件内容（支持 HTML）',
          ),
          h('textarea', {
            value: tempBody.value,
            placeholder:
              '留空使用默认模板，支持 HTML 和变量：{{subscriptions}}、{{count}}、{{time}}、{{site_url}}',
            style:
              'width: 100%; min-height: 150px; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px; resize: vertical;',
            onInput: (e: Event) => {
              tempBody.value = (e.target as HTMLTextAreaElement).value;
            },
          }),
        ]),
        h(
          'div',
          {
            style:
              'background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 12px;',
          },
          [
            h(
              'p',
              { style: 'font-weight: 600; margin-bottom: 8px;' },
              '可用变量：',
            ),
            h(
              'p',
              { style: 'margin: 4px 0;' },
              '• {{count}} - 即将到期的订阅数量',
            ),
            h(
              'p',
              { style: 'margin: 4px 0;' },
              '• {{subscriptions}} - 订阅列表（HTML表格）',
            ),
            h('p', { style: 'margin: 4px 0;' }, '• {{time}} - 发送时间'),
            h('p', { style: 'margin: 4px 0;' }, '• {{site_url}} - 站点链接'),
          ],
        ),
      ]);
    },
    positiveText: '保存',
    negativeText: '取消',
    onPositiveClick: () => {
      props.formData.resend_template_subject = tempSubject.value;
      props.formData.resend_template_body = tempBody.value;
    },
  });
}
</script>
