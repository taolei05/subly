<template>
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
</template>

<script setup lang="ts">
import { useDialog } from 'naive-ui';
import { h } from 'vue';
import InfoIcon from '../../assets/icons/InfoIcon.vue';
import type { UserSettings } from '../../types';

const props = defineProps<{ formData: UserSettings }>();
const dialog = useDialog();

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
</script>

