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
        备份数据包含所有订阅信息，同时保存 JSON 和 CSV 两种格式。邮箱备份需要先配置 Resend API Key。
      </n-text>
    </div>
  </n-collapse-item>
</template>

<script setup lang="ts">
import { useDialog, useMessage } from 'naive-ui';
import Papa from 'papaparse';
import { computed, h, ref } from 'vue';
import VueJsonPretty from 'vue-json-pretty';
import 'vue-json-pretty/lib/styles.css';
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
    style: { width: '600px' },
    content: () => {
      return h('div', { style: 'max-height: 400px; overflow-y: auto;' }, [
        h('table', { style: 'width: 100%; border-collapse: collapse;' }, [
          h('thead', [
            h('tr', { style: 'background: #f5f5f5;' }, [
              h('th', { style: 'padding: 8px; text-align: left;' }, '日期'),
              h('th', { style: 'padding: 8px; text-align: right;' }, 'JSON'),
              h('th', { style: 'padding: 8px; text-align: right;' }, 'CSV'),
              h('th', { style: 'padding: 8px; text-align: center;' }, '下载'),
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
                  formatSize(backup.jsonSize),
                ),
                h(
                  'td',
                  { style: 'padding: 8px; text-align: right;' },
                  formatSize(backup.csvSize),
                ),
                h('td', { style: 'padding: 8px; text-align: center;' }, [
                  h(
                    'a',
                    {
                      style:
                        'color: #18a058; cursor: pointer; margin-right: 8px;',
                      onClick: () => handlePreview(backup.date, 'json'),
                    },
                    '预览',
                  ),
                  h(
                    'a',
                    {
                      style:
                        'color: #18a058; cursor: pointer; margin-right: 8px;',
                      onClick: () => handleDownload(backup.date, 'json'),
                    },
                    'JSON',
                  ),
                  h(
                    'a',
                    {
                      style: 'color: #18a058; cursor: pointer;',
                      onClick: () => handleDownload(backup.date, 'csv'),
                    },
                    'CSV',
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

async function handleDownload(date: string, format: 'json' | 'csv' = 'json') {
  try {
    const content = await downloadBackup(date, format);
    if (!content) {
      message.error('下载失败');
      return;
    }

    const mimeType = format === 'json' ? 'application/json' : 'text/csv';
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subly-backup-${date}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    message.error('下载失败');
  }
}

// 预览状态
const previewFormat = ref<'json' | 'csv'>('json');
const previewData = ref<unknown>(null);
const csvData = ref<Record<string, unknown>[]>([]);
const csvHeaders = ref<string[]>([]);

async function handlePreview(date: string, format: 'json' | 'csv' = 'json') {
  try {
    const content = await downloadBackup(date, format);
    if (!content) {
      message.error('获取备份数据失败');
      return;
    }

    previewFormat.value = format;

    if (format === 'json') {
      previewData.value = JSON.parse(content);
      showJsonPreviewDialog(date);
    } else {
      const parsed = Papa.parse(content, { header: true });
      csvData.value = parsed.data as Record<string, unknown>[];
      csvHeaders.value = parsed.meta.fields || [];
      showCsvPreviewDialog(date);
    }
  } catch {
    message.error('预览失败');
  }
}

function showJsonPreviewDialog(date: string) {
  dialog.info({
    title: `JSON 预览 - ${date}`,
    style: { width: '800px', maxWidth: '90vw' },
    content: () => {
      return h('div', { style: 'max-height: 500px; overflow: auto;' }, [
        h(VueJsonPretty, {
          data: previewData.value,
          deep: 3,
          showLength: true,
          showLine: true,
          showDoubleQuotes: true,
        }),
      ]);
    },
    positiveText: '关闭',
    negativeText: '下载',
    onNegativeClick: () => {
      handleDownload(date, 'json');
      return false;
    },
  });
}

function showCsvPreviewDialog(date: string) {
  dialog.info({
    title: `CSV 预览 - ${date}`,
    style: { width: '900px', maxWidth: '95vw' },
    content: () => {
      return h('div', { style: 'max-height: 500px; overflow: auto;' }, [
        h(
          'table',
          { style: 'width: 100%; border-collapse: collapse; font-size: 12px;' },
          [
            h('thead', [
              h(
                'tr',
                { style: 'background: #f5f5f5; position: sticky; top: 0;' },
                csvHeaders.value.map((header) =>
                  h(
                    'th',
                    {
                      style:
                        'padding: 8px; text-align: left; border: 1px solid #e0e0e0; white-space: nowrap;',
                    },
                    header,
                  ),
                ),
              ),
            ]),
            h(
              'tbody',
              csvData.value.slice(0, 100).map((row) =>
                h(
                  'tr',
                  csvHeaders.value.map((header) =>
                    h(
                      'td',
                      {
                        style:
                          'padding: 6px 8px; border: 1px solid #e0e0e0; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
                      },
                      String(row[header] ?? ''),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
        csvData.value.length > 100
          ? h(
              'p',
              { style: 'color: #999; font-size: 12px; margin-top: 8px;' },
              `显示前 100 条，共 ${csvData.value.length} 条记录`,
            )
          : null,
      ]);
    },
    positiveText: '关闭',
    negativeText: '下载',
    onNegativeClick: () => {
      handleDownload(date, 'csv');
      return false;
    },
  });
}
</script>
