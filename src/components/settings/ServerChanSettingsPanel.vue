<template>
  <n-collapse-item title="Server酱 (微信通知)" name="serverchan">
    <div style="padding: 16px 0;">
      <n-form-item>
        <template #label>
          启用微信提醒
        </template>
        <n-switch v-model:value="formData.serverchan_enabled" />
      </n-form-item>

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
        <n-time-picker
          v-model:value="notifyTimeValue"
          format="HH:mm"
          :hours="Array.from({ length: 24 }, (_, i) => i)"
          :minutes="[0]"
          :actions="null"
          style="width: 100%"
          @update:value="handleTimeChange"
        />
      </n-form-item>

      <n-form-item path="serverchan_notify_interval">
        <template #label>
          发送频率
        </template>
        <n-select
          v-model:value="formData.serverchan_notify_interval"
          :options="intervalOptions"
          placeholder="请选择频率 (默认每24小时)"
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
</template>

<script setup lang="ts">
import { useDialog, useMessage } from 'naive-ui';
import { computed, h, ref } from 'vue';
import InfoIcon from '../../assets/icons/InfoIcon.vue';
import { useAuthStore } from '../../stores/auth';
import type { UserSettings } from '../../types';

const props = defineProps<{ formData: UserSettings }>();
const dialog = useDialog();
const message = useMessage();
const authStore = useAuthStore();
const testingServerChan = ref(false);

// 将小时数转换为时间戳（毫秒）
const notifyTimeValue = computed(() => {
  const hour = props.formData.serverchan_notify_time ?? 8;
  return hour * 60 * 60 * 1000;
});

function handleTimeChange(value: number | null) {
  if (value !== null) {
    const hour = Math.floor(value / (60 * 60 * 1000));
    props.formData.serverchan_notify_time = hour;
  }
}

const intervalOptions = [
  { label: '每1小时', value: 1 },
  { label: '每2小时', value: 2 },
  { label: '每3小时', value: 3 },
  { label: '每6小时', value: 6 },
  { label: '每12小时', value: 12 },
  { label: '每24小时 (每天)', value: 24 },
];

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
</script>
