<template>
  <n-collapse-item title="ExchangeRate 汇率配置" name="exchangerate">
    <div style="padding: 16px 0;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <span>启用汇率转换</span>
        <n-switch v-model:value="formData.exchangerate_enabled" />
      </div>

      <n-alert v-if="!formData.exchangerate_enabled" type="info" :show-icon="true" style="margin-bottom: 16px;">
        汇率转换已关闭，系统将使用内置的默认汇率进行货币换算。
      </n-alert>

      <n-form-item path="exchangerate_api_key">
        <template #label>
          <div style="display: flex; align-items: center; gap: 4px;">
            API Key
            <Icon name="info" :size="18" style="cursor: pointer; color: var(--primary-color);" @click="showExchangeRateHelp" />
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

      <n-form-item>
        <n-space>
          <n-button
            size="small"
            secondary
            type="primary"
            :loading="testingExchangeRate"
            :disabled="!formData.exchangerate_api_key"
            @click="handleTestExchangeRate"
          >
            测试汇率 API
          </n-button>
          <n-button
            size="small"
            secondary
            @click="showDefaultRates"
          >
            查看默认汇率
          </n-button>
        </n-space>
      </n-form-item>
    </div>
  </n-collapse-item>
</template>

<script setup lang="ts">
import { useDialog, useMessage } from 'naive-ui';
import { h, ref } from 'vue';
import { subscriptionApi } from '../../api/subscription';
import type { UserSettings } from '../../types';
import Icon from '../common/Icon.vue';

const props = defineProps<{ formData: UserSettings }>();
const dialog = useDialog();
const message = useMessage();
const testingExchangeRate = ref(false);

// 默认汇率（与后端保持一致）
const DEFAULT_RATES = {
  CNY: 1,
  HKD: 1.09,
  USD: 0.14,
  EUR: 0.13,
  GBP: 0.11,
};

function showDefaultRates() {
  const format = (n: number) => n.toFixed(4);
  dialog.info({
    title: '默认汇率（基准：人民币 CNY）',
    content: () => {
      return h('div', [
        h(
          'p',
          { style: 'margin-bottom: 12px; color: #666;' },
          '以下为系统内置的默认汇率（1 CNY 可兑换）：',
        ),
        h(
          'div',
          {
            style: 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px;',
          },
          [
            h('div', [
              h('strong', 'CNY'),
              h(
                'span',
                { style: 'margin-left: 8px;' },
                format(DEFAULT_RATES.CNY),
              ),
            ]),
            h('div', [
              h('strong', 'HKD'),
              h(
                'span',
                { style: 'margin-left: 8px;' },
                format(DEFAULT_RATES.HKD),
              ),
            ]),
            h('div', [
              h('strong', 'USD'),
              h(
                'span',
                { style: 'margin-left: 8px;' },
                format(DEFAULT_RATES.USD),
              ),
            ]),
            h('div', [
              h('strong', 'EUR'),
              h(
                'span',
                { style: 'margin-left: 8px;' },
                format(DEFAULT_RATES.EUR),
              ),
            ]),
            h('div', [
              h('strong', 'GBP'),
              h(
                'span',
                { style: 'margin-left: 8px;' },
                format(DEFAULT_RATES.GBP),
              ),
            ]),
          ],
        ),
        h(
          'p',
          { style: 'margin-top: 12px; color: #999; font-size: 12px;' },
          '提示：关闭汇率转换功能或未配置 API Key 时将使用此默认汇率。',
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

async function handleTestExchangeRate() {
  if (!props.formData.exchangerate_api_key) {
    message.warning('请先输入 ExchangeRate API Key');
    return;
  }
  testingExchangeRate.value = true;
  try {
    const res = await subscriptionApi.getExchangeRates();
    if (res?.success && res?.source === 'exchangerate-api') {
      message.success('测试成功，已从 ExchangeRate-API 获取汇率');

      const rates = res?.data?.rates || {};
      const format = (n: number | undefined) =>
        typeof n === 'number' ? n.toFixed(4) : '-';

      dialog.info({
        title: '实时汇率（基准：人民币 CNY）',
        content: () => {
          return h('div', [
            h(
              'p',
              { style: 'margin-bottom: 12px; color: #666;' },
              '以下为 1 CNY 可兑换的各币种数值：',
            ),
            h(
              'div',
              {
                style:
                  'display: grid; grid-template-columns: 1fr 1fr; gap: 8px;',
              },
              [
                h('div', [
                  h('strong', 'CNY'),
                  h('span', { style: 'margin-left: 8px;' }, format(rates.CNY)),
                ]),
                h('div', [
                  h('strong', 'HKD'),
                  h('span', { style: 'margin-left: 8px;' }, format(rates.HKD)),
                ]),
                h('div', [
                  h('strong', 'USD'),
                  h('span', { style: 'margin-left: 8px;' }, format(rates.USD)),
                ]),
                h('div', [
                  h('strong', 'EUR'),
                  h('span', { style: 'margin-left: 8px;' }, format(rates.EUR)),
                ]),
                h('div', [
                  h('strong', 'GBP'),
                  h('span', { style: 'margin-left: 8px;' }, format(rates.GBP)),
                ]),
              ],
            ),
          ]);
        },
        positiveText: '知道了',
      });
    } else if (res?.success && res?.source === 'default') {
      message.warning('使用默认汇率，请先保存 API Key 后再测试');
    } else {
      message.error(res?.message || '测试失败，请检查 API Key');
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '测试失败，请稍后再试';
    message.error(msg);
  } finally {
    testingExchangeRate.value = false;
  }
}
</script>
