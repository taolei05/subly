<template>
  <n-collapse-item title="数据备份" name="backup">
    <div style="padding: 16px 0;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <span>启用自动备份</span>
        <n-switch v-model:value="formData.backup_enabled" :disabled="disabled" />
      </div>

      <n-form-item label="备份频率">
        <n-select
          v-model:value="formData.backup_frequency"
          :options="frequencyOptions"
          :disabled="disabled || !formData.backup_enabled"
        />
      </n-form-item>

      <n-form-item label="备份目标">
        <n-checkbox-group v-model:value="backupTargets" :disabled="disabled || !formData.backup_enabled">
          <n-space>
            <n-checkbox value="email" label="邮箱（需配置 Resend）" />
            <n-checkbox value="r2" label="R2 云存储" />
          </n-space>
        </n-checkbox-group>
      </n-form-item>

      <n-form-item v-if="formData.backup_last_at" label="上次备份时间">
        <n-text>{{ formatBackupTime(formData.backup_last_at) }}</n-text>
      </n-form-item>

      <n-form-item>
        <n-space>
          <n-button
            secondary
            type="primary"
            :loading="backingUp"
            :disabled="disabled || (!formData.backup_to_email && !formData.backup_to_r2)"
            @click="handleManualBackup"
          >
            立即备份
          </n-button>
          <n-button
            v-if="formData.backup_to_r2"
            secondary
            :disabled="disabled"
            @click="showBackupList"
          >
            查看历史备份
          </n-button>
        </n-space>
      </n-form-item>

      <n-text depth="3" style="font-size: 12px; display: block; margin-top: 8px;">
        备份数据包含所有订阅信息，以 JSON 格式存储。邮箱备份需要先配置 Resend API Key。
      </n-text>
    </div>
  </n-collapse-item>
</template>

<script setup lang="ts">
import { useDialog, useMessage } from 'naive-ui';
import { computed, h, ref, watch } from 'vue';
import { downloadBackup, getBackupList, triggerBackup } from '../../api/backup';
import type { BackupFile, UserSettings } from '../../types';

const props = defineProps<{ formData: UserSettings; disabled?: boolean }>();

const dialog = useDialog();
const message = useMessage();
const backingUp = ref(false);

const frequencyOptions = [
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
];

// 双向绑定备份目标
const backupTargets = computed({
  get: () => {
    const targets: string[] = [];
    if (props.formData.backup_to_email) targets.push('email');
    if (props.formData.backup_to_r2) targets.push('r2');
    return targets;
  },
  set: (val: string[]) => {
    props.formData.backup_to_email = val.includes('email');
    props.formData.backup_to_r2 = val.includes('r2');
  },
});

function formatBackupTime(isoString: string): string {
  return new Date(isoString).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
  });
}

async function handleManualBackup() {
  backingUp.value = true;
  try {
    const result = await triggerBackup(
      props.formData.backup_to_email ?? false,
      props.formData.backup_to_r2 ?? false,
    );
    if (result.success) {
      message.success(result.message || '备份成功');
    } else {
      message.error(result.message || '备份失败');
    }
  } finally {
    backingUp.value = false;
  }
}

async function showBackupList() {
  const result = await getBackupList();
  if (!result.success || !result.data) {
    message.error('获取备份列表失败');
    return;
  }

  const backups = result.data as BackupFile[];

  if (backups.length === 0) {
    message.info('暂无备份记录');
    return;
  }

  dialog.info({
    title: '历史备份',
    style: { width: '500px' },
    content: () => {
      return h('div', { style: 'max-height: 400px; overflow-y: auto;' }, [
        h('table', { style: 'width: 100%; border-collapse: collapse;' }, [
          h('thead', [
            h('tr', { style: 'background: #f5f5f5;' }, [
              h('th', { style: 'padding: 8px; text-align: left;' }, '日期'),
              h('th', { style: 'padding: 8px; text-align: right;' }, '大小'),
              h('th', { style: 'padding: 8px; text-align: center;' }, '操作'),
            ]),
          ]),
          h(
            'tbody',
            backups.map((backup) =>
              h('tr', { style: 'border-bottom: 1px solid #eee;' }, [
                h('td', { style: 'padding: 8px;' }, backup.date),
                h(
                  'td',
                  { style: 'padding: 8px; text-align: right;' },
                  formatSize(backup.size),
                ),
                h('td', { style: 'padding: 8px; text-align: center;' }, [
                  h(
                    'a',
                    {
                      style: 'color: #18a058; cursor: pointer;',
                      onClick: () => handleDownload(backup.date),
                    },
                    '下载',
                  ),
                ]),
              ]),
            ),
          ),
        ]),
      ]);
    },
    positiveText: '关闭',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function handleDownload(date: string) {
  try {
    const content = await downloadBackup(date);
    if (!content) {
      message.error('下载失败');
      return;
    }

    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subly-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    message.error('下载失败');
  }
}
</script>
