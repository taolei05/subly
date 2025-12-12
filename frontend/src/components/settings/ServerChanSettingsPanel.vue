<template>
  <n-collapse-item title="Server酱 (微信通知)" name="serverchan">
    <div style="padding: 16px 0;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <span>启用微信提醒</span>
        <n-switch v-model:value="formData.serverchan_enabled" :disabled="disabled" />
      </div>

      <n-form-item path="serverchan_api_key">
        <template #label>
          <div style="display: flex; align-items: center; gap: 4px;">
            SendKey
            <Icon name="info" :size="18" style="cursor: pointer; color: var(--primary-color);" @click="showServerChanHelp" />
          </div>
        </template>
        <n-input
          v-model:value="formData.serverchan_api_key"
          type="password"
          placeholder="用于微信通知"
          show-password-on="click"
          :disabled="disabled"
          :input-props="{ autocomplete: 'new-password' }"
        />
      </n-form-item>

      <n-form-item path="serverchan_notify_hours">
        <template #label>
          指定发送时间（北京时间24小时制，可多选）
        </template>
        <n-select
          v-model:value="formData.serverchan_notify_hours"
          :options="hourOptions"
          multiple
          placeholder="选择发送时间点"
          :disabled="disabled"
        />
      </n-form-item>

      <n-form-item>
        <template #label>
          <div style="display: flex; align-items: center; gap: 4px;">
            自定义通知模板
            <Icon name="info" :size="18" style="cursor: pointer; color: var(--primary-color);" @click="showTemplateHelp" />
          </div>
        </template>
        <div style="display: flex; align-items: center; gap: 8px;">
          <n-button
            secondary
            :disabled="disabled"
            @click="openTemplateDialog"
          >
            {{ formData.serverchan_template_title || formData.serverchan_template_body ? '编辑模板' : '配置模板' }}
          </n-button>
          <n-button
            quaternary
            size="small"
            @click="showDefaultTemplate"
          >
            查看默认模板
          </n-button>
          <n-text v-if="formData.serverchan_template_title || formData.serverchan_template_body" depth="3" style="font-size: 12px;">
            已配置自定义模板
          </n-text>
        </div>
      </n-form-item>

      <n-form-item>
        <n-button
          size="small"
          secondary
          type="primary"
          :loading="testingServerChan"
          :disabled="disabled || !formData.serverchan_api_key"
          @click="handleTestServerChan"
        >
          发送测试消息
        </n-button>
      </n-form-item>
    </div>
  </n-collapse-item>
</template>

<script setup lang="ts">
import MarkdownIt from 'markdown-it';
import { useDialog, useMessage } from 'naive-ui';
import { h, ref } from 'vue';
import { useAuthStore } from '../../stores/auth';
import type { UserSettings } from '../../types';
import Icon from '../common/Icon.vue';

const md = new MarkdownIt();

const props = defineProps<{ formData: UserSettings; disabled?: boolean }>();
const dialog = useDialog();
const message = useMessage();
const authStore = useAuthStore();
const testingServerChan = ref(false);

// 生成 0-23 小时选项
const hourOptions = Array.from({ length: 24 }, (_, i) => ({
  label: `${i.toString().padStart(2, '0')}:00`,
  value: i,
}));

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

async function handleTestServerChan() {
  if (!props.formData.serverchan_api_key) {
    message.warning('请先输入 Server酱 SendKey');
    return;
  }
  testingServerChan.value = true;
  try {
    const result = await authStore.sendTestServerChan({
      serverchan_api_key: props.formData.serverchan_api_key,
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

function showTemplateHelp() {
  dialog.info({
    title: '模板变量说明',
    content: () => {
      return h('div', [
        h(
          'p',
          { style: 'font-weight: 600; margin-bottom: 8px;' },
          '支持 Markdown 格式',
        ),
        h(
          'p',
          { style: 'margin-bottom: 12px; color: #666;' },
          '消息内容支持 Markdown 语法，如标题、加粗、链接、表格等。',
        ),
        h(
          'p',
          { style: 'font-weight: 600; margin-bottom: 8px;' },
          '可用变量：',
        ),
        h('p', '• {{count}} - 即将到期的订阅数量'),
        h('p', '• {{subscriptions}} - 订阅列表（Markdown表格格式）'),
        h('p', '• {{time}} - 发送时间'),
        h('p', '• {{site_url}} - 站点链接'),
      ]);
    },
    positiveText: '知道了',
  });
}

const defaultMarkdownTemplate = `## ⏰ 订阅到期提醒

您有以下订阅即将到期，请及时处理：

| 服务名称 | 类型 | 到期日期 |
| :--- | :--- | :--- |
| 示例服务 | 会员 | 2024-12-20 |

---

**发送时间**：2024-12-15 08:00:00
**到期数量**：1 个

[👉 查看详情](https://example.com)

---

*这是一条自动发送的消息，请勿直接回复。*`;

function showDefaultTemplate() {
  const renderedHtml = md.render(defaultMarkdownTemplate);

  dialog.info({
    title: '默认通知模板',
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
            h(
              'p',
              { style: 'font-weight: 600; margin-bottom: 8px;' },
              '源码 (Markdown)',
            ),
            h(
              'pre',
              {
                style:
                  'background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 11px; overflow: auto; max-height: 400px; white-space: pre-wrap; word-break: break-all; margin: 0;',
              },
              defaultMarkdownTemplate,
            ),
          ]),
          h('div', { style: 'flex: 1; min-width: 0;' }, [
            h('p', { style: 'font-weight: 600; margin-bottom: 8px;' }, '预览'),
            h('div', {
              style:
                'border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; max-height: 400px; overflow-y: auto; background: white;',
              innerHTML: renderedHtml,
            }),
          ]),
        ]),
      ]);
    },
    positiveText: '知道了',
  });
}

// 临时存储模板编辑值
const tempTitle = ref('');
const tempBody = ref('');
const previewHtml = ref('');

function generateMarkdownPreview(body: string): string {
  const sampleSubscriptions = `| 服务名称 | 类型 | 到期日期 |
| :--- | :--- | :--- |
| 示例服务 | 会员 | 2024-12-20 |`;

  let markdown = body || defaultMarkdownTemplate;
  markdown = markdown.replace(/\{\{subscriptions\}\}/g, sampleSubscriptions);
  markdown = markdown.replace(/\{\{count\}\}/g, '1');
  markdown = markdown.replace(/\{\{time\}\}/g, '2024-12-15 08:00:00');
  markdown = markdown.replace(/\{\{site_url\}\}/g, 'https://example.com');

  return md.render(markdown);
}

function updatePreview() {
  previewHtml.value = generateMarkdownPreview(tempBody.value);
}

function openTemplateDialog() {
  tempTitle.value = props.formData.serverchan_template_title || '';
  tempBody.value = props.formData.serverchan_template_body || '';
  updatePreview();

  dialog.create({
    title: '自定义通知模板',
    style: { width: '950px' },
    content: () => {
      return h('div', { style: 'padding: 8px 0;' }, [
        h('div', { style: 'margin-bottom: 12px;' }, [
          h(
            'label',
            { style: 'display: block; margin-bottom: 8px; font-weight: 500;' },
            '消息标题',
          ),
          h('input', {
            value: tempTitle.value,
            placeholder: '留空使用默认标题，支持变量：{{count}}',
            style:
              'width: 100%; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px;',
            onInput: (e: Event) => {
              tempTitle.value = (e.target as HTMLInputElement).value;
            },
          }),
        ]),
        h('div', { style: 'display: flex; gap: 16px;' }, [
          h('div', { style: 'flex: 1; min-width: 0;' }, [
            h(
              'label',
              {
                style: 'display: block; margin-bottom: 8px; font-weight: 500;',
              },
              '消息内容（支持 Markdown）',
            ),
            h('textarea', {
              value: tempBody.value,
              placeholder: '留空使用默认模板，支持 Markdown 和变量',
              style:
                'width: 100%; height: 280px; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 12px; font-family: monospace; resize: none;',
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
                style: 'display: block; margin-bottom: 8px; font-weight: 500;',
              },
              '预览',
            ),
            h('div', {
              style:
                'border: 1px solid #e0e0e0; border-radius: 4px; height: 280px; overflow-y: auto; padding: 12px; background: white;',
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
                style:
                  'display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px;',
              },
              [
                h('span', [h('code', '{{count}}'), ' - 即将到期的订阅数量']),
                h('span', [h('code', '{{time}}'), ' - 发送时间']),
                h('span', [
                  h('code', '{{subscriptions}}'),
                  ' - 订阅列表（Markdown表格）',
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
      props.formData.serverchan_template_title = tempTitle.value;
      props.formData.serverchan_template_body = tempBody.value;
    },
  });
}
</script>
