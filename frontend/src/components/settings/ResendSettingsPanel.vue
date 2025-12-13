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
        <template #label>
          <div style="display: flex; align-items: center; gap: 4px;">
            自定义邮件模板
            <Icon name="info" :size="18" style="cursor: pointer; color: var(--primary-color);" @click="showTemplateHelp" />
          </div>
        </template>
        <div style="display: flex; align-items: center; gap: 8px;">
          <n-button
            secondary
            :disabled="disabled"
            @click="openTemplateDialog"
          >
            {{ formData.resend_template_subject || formData.resend_template_body ? '编辑模板' : '配置模板' }}
          </n-button>
          <n-button
            quaternary
            size="small"
            @click="showDefaultTemplate"
          >
            查看默认模板
          </n-button>
          <n-text v-if="formData.resend_template_subject || formData.resend_template_body" depth="3" style="font-size: 12px;">
            已配置自定义模板
          </n-text>
        </div>
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

const defaultEmailHtml = `<p>您有以下订阅即将到期，请及时处理：</p>
{{subscriptions}}
<table style="width: 100%; margin-top: 16px;">
  <tr>
    <td style="color: #999;">发送时间</td>
    <td>{{time}}</td>
  </tr>
  <tr>
    <td style="color: #999;">到期数量</td>
    <td>{{count}} 个</td>
  </tr>
</table>
<div style="margin-top: 20px; text-align: center;">
  <a href="{{site_url}}" style="background: #18a058; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">查看详情</a>
</div>
<p style="margin-top: 20px; color: #666; font-size: 14px;">这是一封自动发送的邮件，请勿直接回复。</p>`;

const defaultEmailPreview = `
<div style="background: #18a058; color: white; padding: 16px;">
  <h3 style="margin: 0; font-size: 18px;">Subly 订阅提醒</h3>
</div>
<div style="background: #f5f5f5; padding: 16px;">
  <p style="margin: 0 0 12px 0;">您有以下订阅即将到期，请及时处理：</p>
  <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 4px; font-size: 12px;">
    <thead>
      <tr style="background: #f8f8f8;">
        <th style="padding: 8px; text-align: left; border-bottom: 1px solid #eee;">服务名称</th>
        <th style="padding: 8px; text-align: left; border-bottom: 1px solid #eee;">类型</th>
        <th style="padding: 8px; text-align: left; border-bottom: 1px solid #eee;">到期日期</th>
      </tr>
    </thead>
    <tbody>
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">示例服务</td><td style="padding: 8px; border-bottom: 1px solid #eee;">会员</td><td style="padding: 8px; border-bottom: 1px solid #eee;">2024-12-20</td></tr>
    </tbody>
  </table>
  <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 4px; font-size: 12px; margin-top: 12px;">
    <tr><td style="padding: 8px; color: #999; width: 80px;">发送时间</td><td style="padding: 8px;">2024-12-15 08:00:00</td></tr>
    <tr><td style="padding: 8px; color: #999;">到期数量</td><td style="padding: 8px;">1 个</td></tr>
  </table>
  <div style="margin-top: 12px; text-align: center;">
    <span style="display: inline-block; background: #18a058; color: white; padding: 8px 16px; border-radius: 4px; font-size: 12px;">查看详情</span>
  </div>
  <p style="margin-top: 12px; color: #666; font-size: 12px;">这是一封自动发送的邮件，请勿直接回复。</p>
</div>`;

function showDefaultTemplate() {
  dialog.info({
    title: '默认邮件模板',
    style: { width: '900px' },
    content: () => {
      return h('div', [
        h('div', { style: 'margin-bottom: 12px;' }, [
          h('span', { style: 'font-weight: 600;' }, '默认标题：'),
          h(
            'code',
            {
              style:
                'background: #f5f5f5; padding: 4px 8px; border-radius: 4px; margin-left: 8px;',
            },
            '[Subly] 您有 {{count}} 个订阅即将到期',
          ),
        ]),
        h('div', { style: 'display: flex; gap: 16px;' }, [
          h('div', { style: 'flex: 1; min-width: 0;' }, [
            h('p', { style: 'font-weight: 600; margin-bottom: 8px;' }, '源码'),
            h(
              'pre',
              {
                style:
                  'background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 11px; overflow: auto; max-height: 400px; white-space: pre-wrap; word-break: break-all; margin: 0;',
              },
              defaultEmailHtml,
            ),
          ]),
          h('div', { style: 'flex: 1; min-width: 0;' }, [
            h('p', { style: 'font-weight: 600; margin-bottom: 8px;' }, '预览'),
            h('div', {
              style:
                'border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; max-height: 400px; overflow-y: auto;',
              innerHTML: defaultEmailPreview,
            }),
          ]),
        ]),
      ]);
    },
    positiveText: '知道了',
  });
}

// 临时存储模板编辑值
const tempSubject = ref('');
const tempBody = ref('');
const previewHtml = ref('');

function generateEmailPreview(subject: string, body: string): string {
  const sampleSubscriptions = `<table style="width: 100%; border-collapse: collapse; background: white; border-radius: 4px; font-size: 12px;">
    <thead><tr style="background: #f8f8f8;">
      <th style="padding: 8px; text-align: left; border-bottom: 1px solid #eee;">服务名称</th>
      <th style="padding: 8px; text-align: left; border-bottom: 1px solid #eee;">类型</th>
      <th style="padding: 8px; text-align: left; border-bottom: 1px solid #eee;">到期日期</th>
    </tr></thead>
    <tbody><tr><td style="padding: 8px;">示例服务</td><td style="padding: 8px;">会员</td><td style="padding: 8px;">2024-12-20</td></tr></tbody>
  </table>`;

  let html = body || defaultEmailHtml;
  html = html.replace(/\{\{subscriptions\}\}/g, sampleSubscriptions);
  html = html.replace(/\{\{count\}\}/g, '1');
  html = html.replace(/\{\{time\}\}/g, '2024-12-15 08:00:00');
  html = html.replace(/\{\{site_url\}\}/g, 'https://example.com');

  // 处理标题，替换变量
  let title = subject || '[Subly] 您有 {{count}} 个订阅即将到期';
  title = title.replace(/\{\{count\}\}/g, '1');

  return `<div style="background: #18a058; color: white; padding: 12px;"><h3 style="margin: 0; font-size: 16px;">${title}</h3></div><div style="background: #f5f5f5; padding: 12px;">${html}</div>`;
}

function updatePreview() {
  previewHtml.value = generateEmailPreview(tempSubject.value, tempBody.value);
}

function showPreviewDialog() {
  updatePreview();
  dialog.info({
    title: '邮件预览',
    style: { width: '90vw', maxWidth: '500px' },
    content: () =>
      h('div', {
        style:
          'border: 1px solid #e0e0e0; border-radius: 4px; max-height: 60vh; overflow-y: auto;',
        innerHTML: previewHtml.value,
      }),
    positiveText: '关闭',
  });
}

function isMobile(): boolean {
  return window.innerWidth < 768;
}

function openTemplateDialog() {
  tempSubject.value = props.formData.resend_template_subject || '';
  tempBody.value = props.formData.resend_template_body || '';
  updatePreview();

  const mobile = isMobile();

  dialog.create({
    title: '自定义邮件模板',
    style: { width: mobile ? '95vw' : '950px', maxWidth: '950px' },
    content: () => {
      return h('div', { style: 'padding: 8px 0;' }, [
        h('div', { style: 'margin-bottom: 12px;' }, [
          h(
            'label',
            { style: 'display: block; margin-bottom: 8px; font-weight: 500;' },
            '邮件标题',
          ),
          h('input', {
            value: tempSubject.value,
            placeholder: '留空使用默认标题，支持变量：{{count}}',
            style:
              'width: 100%; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px; box-sizing: border-box;',
            onInput: (e: Event) => {
              tempSubject.value = (e.target as HTMLInputElement).value;
              updatePreview();
            },
          }),
        ]),
        mobile
          ? h('div', [
              h(
                'label',
                {
                  style:
                    'display: block; margin-bottom: 8px; font-weight: 500;',
                },
                '邮件内容（支持 HTML）',
              ),
              h('textarea', {
                value: tempBody.value,
                placeholder: '留空使用默认模板，支持 HTML 和变量',
                style:
                  'width: 100%; height: 200px; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 12px; font-family: monospace; resize: none; box-sizing: border-box;',
                onInput: (e: Event) => {
                  tempBody.value = (e.target as HTMLTextAreaElement).value;
                },
              }),
              h(
                'button',
                {
                  style:
                    'margin-top: 12px; padding: 8px 16px; background: #18a058; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;',
                  onClick: showPreviewDialog,
                },
                '预览效果',
              ),
            ])
          : h('div', { style: 'display: flex; gap: 16px;' }, [
              h('div', { style: 'flex: 1; min-width: 0;' }, [
                h(
                  'label',
                  {
                    style:
                      'display: block; margin-bottom: 8px; font-weight: 500;',
                  },
                  '邮件内容（支持 HTML）',
                ),
                h('textarea', {
                  value: tempBody.value,
                  placeholder: '留空使用默认模板，支持 HTML 和变量',
                  style:
                    'width: 100%; height: 280px; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 12px; font-family: monospace; resize: none; box-sizing: border-box;',
                  onInput: (e: Event) => {
                    tempBody.value = (e.target as HTMLTextAreaElement).value;
                    updatePreview();
                  },
                }),
              ]),
              h('div', { style: 'flex: 1; min-width: 0;' }, [
                h(
                  'label',
                  {
                    style:
                      'display: block; margin-bottom: 8px; font-weight: 500;',
                  },
                  '预览',
                ),
                h('div', {
                  style:
                    'border: 1px solid #e0e0e0; border-radius: 4px; height: 280px; overflow-y: auto;',
                  innerHTML: previewHtml.value,
                }),
              ]),
            ]),
        h(
          'div',
          {
            style:
              'background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 11px; margin-top: 12px;',
          },
          [
            h(
              'p',
              { style: 'font-weight: 600; margin: 0 0 6px 0;' },
              '可用变量：',
            ),
            h(
              'div',
              {
                style: mobile
                  ? 'display: flex; flex-direction: column; gap: 4px;'
                  : 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px;',
              },
              [
                h('span', [h('code', '{{count}}'), ' - 即将到期的订阅数量']),
                h('span', [h('code', '{{time}}'), ' - 发送时间']),
                h('span', [
                  h('code', '{{subscriptions}}'),
                  ' - 订阅列表（HTML表格）',
                ]),
                h('span', [h('code', '{{site_url}}'), ' - 站点链接']),
              ],
            ),
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
