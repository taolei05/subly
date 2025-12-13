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

      <n-form-item label="备份内容">
        <n-checkbox-group v-model:value="backupContents" :disabled="disabled">
          <n-space>
            <n-checkbox value="subscriptions" label="订阅信息" />
            <n-checkbox value="settings" label="系统设置" />
          </n-space>
        </n-checkbox-group>
        <n-text v-if="!isAdmin" depth="3" style="font-size: 12px; display: block; margin-top: 4px;">
          注：安全设置仅管理员可备份
        </n-text>
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
            :disabled="disabled || (!formData.backup_to_email && !formData.backup_to_r2) || backupContents.length === 0"
            @click="handleManualBackup"
          >
            立即备份
          </n-button>
          <n-button
            secondary
            :disabled="disabled"
            @click="showBackupList"
          >
            查看历史备份
          </n-button>
        </n-space>
      </n-form-item>

      <n-divider style="margin: 16px 0;" />

      <n-form-item label="数据恢复">
        <n-space vertical style="width: 100%;">
          <n-text depth="3" style="font-size: 12px;">
            从备份文件恢复订阅数据。支持 JSON 和 CSV 格式。恢复将导入备份中的订阅，不会删除现有数据。
          </n-text>
          <n-space>
            <n-button
              secondary
              :disabled="disabled"
              :loading="restoring"
              @click="handleRestoreFromFile"
            >
              从文件恢复
            </n-button>
            <n-button
              secondary
              :disabled="disabled"
              @click="showRestoreFromR2"
            >
              从云存储恢复
            </n-button>
          </n-space>
        </n-space>
      </n-form-item>

      <n-text depth="3" style="font-size: 12px; display: block; margin-top: 8px;">
        订阅信息备份同时保存 JSON 和 CSV 两种格式，系统设置仅保存 JSON 格式。邮箱备份需要先配置 Resend API Key。
      </n-text>
    </div>
  </n-collapse-item>
</template>

<script setup lang="ts">
import {
  NCheckbox,
  NCheckboxGroup,
  NSpace,
  NTabPane,
  NTabs,
  useDialog,
  useMessage,
} from 'naive-ui';
import Papa from 'papaparse';
import { computed, h, ref } from 'vue';
import VueJsonPretty from 'vue-json-pretty';
import 'vue-json-pretty/lib/styles.css';
import {
  downloadBackup,
  getBackupList,
  restoreBackup,
  restoreSettings,
  triggerBackup,
} from '../../api/backup';
import { useAuthStore } from '../../stores/auth';
import type { BackupFile, SettingsBackupFile, UserSettings } from '../../types';

const props = defineProps<{ formData: UserSettings; disabled?: boolean }>();
const emit = defineEmits<{ restored: [] }>();

const dialog = useDialog();
const message = useMessage();
const authStore = useAuthStore();
const backingUp = ref(false);
const restoring = ref(false);

const isAdmin = computed(() => authStore.isAdmin);

const frequencyOptions = [
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
];

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

const backupContents = ref<string[]>(['subscriptions']);
const activeTab = ref<'subscriptions' | 'settings'>('subscriptions');
const subscriptionBackups = ref<BackupFile[]>([]);
const settingsBackups = ref<SettingsBackupFile[]>([]);
const previewData = ref<unknown>(null);
const csvData = ref<Record<string, unknown>[]>([]);
const csvHeaders = ref<string[]>([]);

function formatBackupTime(isoString: string): string {
  return new Date(isoString).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function handleManualBackup() {
  backingUp.value = true;
  try {
    const result = await triggerBackup(
      props.formData.backup_to_email ?? false,
      props.formData.backup_to_r2 ?? false,
      backupContents.value.includes('subscriptions'),
      backupContents.value.includes('settings'),
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
  const [subResult, settingsResult] = await Promise.all([
    getBackupList('subscriptions'),
    getBackupList('settings'),
  ]);

  subscriptionBackups.value = (subResult.data as BackupFile[]) || [];
  settingsBackups.value = (settingsResult.data as SettingsBackupFile[]) || [];

  if (
    subscriptionBackups.value.length === 0 &&
    settingsBackups.value.length === 0
  ) {
    message.info('暂无备份记录');
    return;
  }

  openBackupDialog();
}

function openBackupDialog() {
  dialog.info({
    title: '历史备份',
    style: { width: '750px', maxWidth: '95vw' },
    content: () => renderBackupTabs(),
    positiveText: '关闭',
  });
}

function renderBackupTabs() {
  return h(
    NTabs,
    {
      type: 'line',
      value: activeTab.value,
      onUpdateValue: (val: 'subscriptions' | 'settings') => {
        activeTab.value = val;
      },
    },
    () => [
      h(
        NTabPane,
        {
          name: 'subscriptions',
          tab: `订阅信息 (${subscriptionBackups.value.length})`,
        },
        () => renderSubscriptionBackups(),
      ),
      h(
        NTabPane,
        {
          name: 'settings',
          tab: `系统设置 (${settingsBackups.value.length})`,
        },
        () => renderSettingsBackups(),
      ),
    ],
  );
}

function renderSubscriptionBackups() {
  if (subscriptionBackups.value.length === 0) {
    return h(
      'div',
      { style: 'text-align: center; color: #999; padding: 40px;' },
      '暂无订阅信息备份',
    );
  }
  return h('div', { style: 'max-height: 350px; overflow-y: auto;' }, [
    h('table', { style: 'width: 100%; border-collapse: collapse;' }, [
      h('thead', [
        h('tr', { style: 'background: #f5f5f5;' }, [
          h('th', { style: 'padding: 8px; text-align: left;' }, '日期'),
          h('th', { style: 'padding: 8px; text-align: right;' }, 'JSON'),
          h('th', { style: 'padding: 8px; text-align: right;' }, 'CSV'),
          h('th', { style: 'padding: 8px; text-align: center;' }, '预览'),
          h('th', { style: 'padding: 8px; text-align: center;' }, '下载'),
        ]),
      ]),
      h(
        'tbody',
        subscriptionBackups.value.map((backup) =>
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
                  style: 'color: #18a058; cursor: pointer; margin-right: 8px;',
                  onClick: () =>
                    handlePreview(backup.date, 'json', 'subscriptions'),
                },
                'JSON',
              ),
              h(
                'a',
                {
                  style: 'color: #18a058; cursor: pointer;',
                  onClick: () =>
                    handlePreview(backup.date, 'csv', 'subscriptions'),
                },
                'CSV',
              ),
            ]),
            h('td', { style: 'padding: 8px; text-align: center;' }, [
              h(
                'a',
                {
                  style: 'color: #18a058; cursor: pointer; margin-right: 8px;',
                  onClick: () =>
                    handleDownload(backup.date, 'json', 'subscriptions'),
                },
                'JSON',
              ),
              h(
                'a',
                {
                  style: 'color: #18a058; cursor: pointer;',
                  onClick: () =>
                    handleDownload(backup.date, 'csv', 'subscriptions'),
                },
                'CSV',
              ),
            ]),
          ]),
        ),
      ),
    ]),
  ]);
}

function renderSettingsBackups() {
  if (settingsBackups.value.length === 0) {
    return h(
      'div',
      { style: 'text-align: center; color: #999; padding: 40px;' },
      '暂无系统设置备份',
    );
  }
  return h('div', { style: 'max-height: 350px; overflow-y: auto;' }, [
    h('table', { style: 'width: 100%; border-collapse: collapse;' }, [
      h('thead', [
        h('tr', { style: 'background: #f5f5f5;' }, [
          h('th', { style: 'padding: 8px; text-align: left;' }, '日期'),
          h('th', { style: 'padding: 8px; text-align: right;' }, '大小'),
          h('th', { style: 'padding: 8px; text-align: center;' }, '预览'),
          h('th', { style: 'padding: 8px; text-align: center;' }, '下载'),
        ]),
      ]),
      h(
        'tbody',
        settingsBackups.value.map((backup) =>
          h('tr', { style: 'border-bottom: 1px solid #eee;' }, [
            h('td', { style: 'padding: 8px;' }, backup.date),
            h(
              'td',
              { style: 'padding: 8px; text-align: right;' },
              formatSize(backup.jsonSize),
            ),
            h('td', { style: 'padding: 8px; text-align: center;' }, [
              h(
                'a',
                {
                  style: 'color: #18a058; cursor: pointer;',
                  onClick: () => handlePreview(backup.date, 'json', 'settings'),
                },
                'JSON',
              ),
            ]),
            h('td', { style: 'padding: 8px; text-align: center;' }, [
              h(
                'a',
                {
                  style: 'color: #18a058; cursor: pointer;',
                  onClick: () =>
                    handleDownload(backup.date, 'json', 'settings'),
                },
                'JSON',
              ),
            ]),
          ]),
        ),
      ),
    ]),
  ]);
}

async function handleDownload(
  date: string,
  format: 'json' | 'csv',
  type: 'subscriptions' | 'settings',
) {
  try {
    const content = await downloadBackup(date, format, type);
    if (!content) {
      message.error('下载失败');
      return;
    }
    const mimeType = format === 'json' ? 'application/json' : 'text/csv';
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type === 'settings' ? 'subly-settings' : 'subly-backup'}-${date}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    message.error('下载失败');
  }
}

async function handlePreview(
  date: string,
  format: 'json' | 'csv',
  type: 'subscriptions' | 'settings',
) {
  try {
    const content = await downloadBackup(date, format, type);
    if (!content) {
      message.error('获取备份数据失败');
      return;
    }
    if (format === 'json') {
      previewData.value = JSON.parse(content);
      showJsonPreviewDialog(date, type);
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

function showJsonPreviewDialog(
  date: string,
  type: 'subscriptions' | 'settings',
) {
  dialog.info({
    title: `${type === 'settings' ? '系统设置' : '订阅信息'}预览 - ${date}`,
    style: { width: '800px', maxWidth: '90vw' },
    content: () =>
      h('div', { style: 'max-height: 500px; overflow: auto;' }, [
        h(VueJsonPretty, {
          data: previewData.value,
          deep: 3,
          showLength: true,
          showLine: true,
          showDoubleQuotes: true,
        }),
      ]),
    positiveText: '关闭',
    negativeText: '下载',
    onNegativeClick: () => {
      handleDownload(date, 'json', type);
      return false;
    },
  });
}

function showCsvPreviewDialog(date: string) {
  dialog.info({
    title: `CSV 预览 - ${date}`,
    style: { width: '900px', maxWidth: '95vw' },
    content: () =>
      h('div', { style: 'max-height: 500px; overflow: auto;' }, [
        h(
          'table',
          { style: 'width: 100%; border-collapse: collapse; font-size: 12px;' },
          [
            h('thead', [
              h(
                'tr',
                { style: 'background: #f5f5f5; position: sticky; top: 0;' },
                csvHeaders.value.map((hdr) =>
                  h(
                    'th',
                    {
                      style:
                        'padding: 8px; text-align: left; border: 1px solid #e0e0e0; white-space: nowrap;',
                    },
                    hdr,
                  ),
                ),
              ),
            ]),
            h(
              'tbody',
              csvData.value.slice(0, 100).map((row) =>
                h(
                  'tr',
                  csvHeaders.value.map((hdr) =>
                    h(
                      'td',
                      {
                        style:
                          'padding: 6px 8px; border: 1px solid #e0e0e0; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
                      },
                      String(row[hdr] ?? ''),
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
      ]),
    positiveText: '关闭',
    negativeText: '下载',
    onNegativeClick: () => {
      handleDownload(date, 'csv', 'subscriptions');
      return false;
    },
  });
}

// ==================== 数据恢复功能 ====================

// 解析的备份文件数据
const parsedFileData = ref<{
  subscriptions?: Record<string, unknown>[];
  settings?: Record<string, unknown>;
} | null>(null);
const restoreSource = ref<'file' | 'r2'>('file');
const selectedR2Date = ref<string>('');

function handleRestoreFromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.csv';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();

      if (file.name.endsWith('.csv')) {
        // CSV 只能是订阅数据
        const parsed = Papa.parse(text, { header: true });
        const data = parsed.data as Record<string, unknown>[];
        if (!Array.isArray(data) || data.length === 0) {
          message.error('备份文件为空或格式错误');
          return;
        }
        parsedFileData.value = { subscriptions: data };
        restoreSource.value = 'file';
        showRestoreTypeDialog();
      } else {
        // JSON 可能包含订阅或设置
        const parsed = JSON.parse(text);
        const fileData: {
          subscriptions?: Record<string, unknown>[];
          settings?: Record<string, unknown>;
        } = {};

        // 检测订阅数据
        if (parsed.subscriptions && Array.isArray(parsed.subscriptions)) {
          fileData.subscriptions = parsed.subscriptions;
        } else if (Array.isArray(parsed)) {
          fileData.subscriptions = parsed;
        }

        // 检测设置数据
        if (parsed.settings && typeof parsed.settings === 'object') {
          fileData.settings = parsed.settings;
        }

        if (!fileData.subscriptions && !fileData.settings) {
          message.error('备份文件格式错误，未找到有效数据');
          return;
        }

        parsedFileData.value = fileData;
        restoreSource.value = 'file';
        showRestoreTypeDialog();
      }
    } catch {
      message.error('文件解析失败，请检查格式');
    }
  };
  input.click();
}

function showRestoreTypeDialog() {
  const hasSubscriptions = !!parsedFileData.value?.subscriptions?.length;
  const hasSettings = !!parsedFileData.value?.settings;

  const restoreTypes = ref<string[]>([]);
  if (hasSubscriptions) restoreTypes.value.push('subscriptions');
  if (hasSettings) restoreTypes.value.push('settings');

  dialog.info({
    title: '选择恢复内容',
    style: { width: '400px' },
    content: () =>
      h('div', { style: 'padding: 16px 0;' }, [
        h(
          'p',
          { style: 'margin-bottom: 12px; color: #666;' },
          '请选择要恢复的数据类型：',
        ),
        h(
          NCheckboxGroup,
          {
            value: restoreTypes.value,
            onUpdateValue: (val: (string | number)[]) => {
              restoreTypes.value = val as string[];
            },
          },
          () =>
            h(NSpace, { vertical: true }, () => [
              hasSubscriptions
                ? h(
                    NCheckbox,
                    { value: 'subscriptions' },
                    () =>
                      `订阅信息 (${parsedFileData.value?.subscriptions?.length} 条)`,
                  )
                : null,
              hasSettings
                ? h(NCheckbox, { value: 'settings' }, () => '系统设置')
                : null,
            ]),
        ),
        !hasSubscriptions && !hasSettings
          ? h('p', { style: 'color: #999;' }, '备份文件中没有可恢复的数据')
          : null,
      ]),
    positiveText: '确认恢复',
    negativeText: '取消',
    positiveButtonProps: { disabled: !hasSubscriptions && !hasSettings },
    onPositiveClick: async () => {
      if (restoreTypes.value.length === 0) {
        message.warning('请至少选择一种恢复内容');
        return false;
      }
      await executeRestore(restoreTypes.value);
    },
  });
}

async function executeRestore(types: string[]) {
  restoring.value = true;
  try {
    const results: string[] = [];

    // 恢复订阅数据
    if (
      types.includes('subscriptions') &&
      parsedFileData.value?.subscriptions
    ) {
      const result = await restoreBackup(parsedFileData.value.subscriptions);
      results.push(
        result.success
          ? '订阅信息恢复成功'
          : `订阅信息恢复失败：${result.message}`,
      );
      if (result.success) emit('restored');
    }

    // 恢复系统设置
    if (types.includes('settings') && parsedFileData.value?.settings) {
      const result = await restoreSettings(parsedFileData.value.settings);
      results.push(
        result.success
          ? '系统设置恢复成功'
          : `系统设置恢复失败：${result.message}`,
      );
      if (result.success) emit('restored');
    }

    const allSuccess = results.every((r) => r.includes('成功'));
    if (allSuccess) {
      message.success(results.join('；'));
    } else {
      message.warning(results.join('；'));
    }
  } finally {
    restoring.value = false;
    parsedFileData.value = null;
  }
}

async function showRestoreFromR2() {
  // 同时获取订阅和设置备份列表
  const [subResult, settingsResult] = await Promise.all([
    getBackupList('subscriptions'),
    getBackupList('settings'),
  ]);

  const subBackups = (subResult.data as BackupFile[]) || [];
  const settingsBackupsList =
    (settingsResult.data as SettingsBackupFile[]) || [];

  // 合并所有日期
  const allDates = new Set<string>();
  for (const b of subBackups) {
    allDates.add(b.date);
  }
  for (const b of settingsBackupsList) {
    allDates.add(b.date);
  }

  if (allDates.size === 0) {
    message.info('云存储中暂无备份记录');
    return;
  }

  // 构建日期到备份类型的映射
  const dateMap = new Map<
    string,
    {
      hasSubscriptions: boolean;
      hasSettings: boolean;
      subSize: number;
      settingsSize: number;
    }
  >();
  for (const date of allDates) {
    const sub = subBackups.find((b) => b.date === date);
    const settings = settingsBackupsList.find((b) => b.date === date);
    dateMap.set(date, {
      hasSubscriptions: !!sub,
      hasSettings: !!settings,
      subSize: sub?.jsonSize || 0,
      settingsSize: settings?.jsonSize || 0,
    });
  }

  const sortedDates = Array.from(allDates).sort((a, b) => b.localeCompare(a));

  dialog.info({
    title: '从云存储恢复',
    style: { width: '550px', maxWidth: '95vw' },
    content: () =>
      h('div', { style: 'max-height: 350px; overflow-y: auto;' }, [
        h(
          'p',
          { style: 'margin-bottom: 12px; color: #666; font-size: 13px;' },
          '选择要恢复的备份：',
        ),
        h('table', { style: 'width: 100%; border-collapse: collapse;' }, [
          h('thead', [
            h('tr', { style: 'background: #f5f5f5;' }, [
              h('th', { style: 'padding: 8px; text-align: left;' }, '日期'),
              h('th', { style: 'padding: 8px; text-align: center;' }, '订阅'),
              h('th', { style: 'padding: 8px; text-align: center;' }, '设置'),
              h('th', { style: 'padding: 8px; text-align: center;' }, '操作'),
            ]),
          ]),
          h(
            'tbody',
            sortedDates.map((date) => {
              const info = dateMap.get(date);
              if (!info) return null;
              return h('tr', { style: 'border-bottom: 1px solid #eee;' }, [
                h('td', { style: 'padding: 8px;' }, date),
                h(
                  'td',
                  {
                    style: `padding: 8px; text-align: center; color: ${info.hasSubscriptions ? '#18a058' : '#999'}`,
                  },
                  info.hasSubscriptions ? formatSize(info.subSize) : '-',
                ),
                h(
                  'td',
                  {
                    style: `padding: 8px; text-align: center; color: ${info.hasSettings ? '#18a058' : '#999'}`,
                  },
                  info.hasSettings ? formatSize(info.settingsSize) : '-',
                ),
                h('td', { style: 'padding: 8px; text-align: center;' }, [
                  h(
                    'a',
                    {
                      style: 'color: #18a058; cursor: pointer;',
                      onClick: () =>
                        handleRestoreFromR2(
                          date,
                          info.hasSubscriptions,
                          info.hasSettings,
                        ),
                    },
                    '恢复',
                  ),
                ]),
              ]);
            }),
          ),
        ]),
      ]),
    positiveText: '关闭',
  });
}

async function handleRestoreFromR2(
  date: string,
  hasSubscriptions: boolean,
  hasSettings: boolean,
) {
  selectedR2Date.value = date;
  restoreSource.value = 'r2';

  // 获取备份数据
  const fileData: {
    subscriptions?: Record<string, unknown>[];
    settings?: Record<string, unknown>;
  } = {};

  if (hasSubscriptions) {
    try {
      const content = await downloadBackup(date, 'json', 'subscriptions');
      if (content) {
        const parsed = JSON.parse(content);
        fileData.subscriptions = parsed.subscriptions || parsed;
      }
    } catch {
      /* ignore */
    }
  }

  if (hasSettings) {
    try {
      const content = await downloadBackup(date, 'json', 'settings');
      if (content) {
        const parsed = JSON.parse(content);
        fileData.settings = parsed.settings;
      }
    } catch {
      /* ignore */
    }
  }

  if (!fileData.subscriptions?.length && !fileData.settings) {
    message.error('获取备份数据失败');
    return;
  }

  parsedFileData.value = fileData;
  showRestoreTypeDialog();
}
</script>
