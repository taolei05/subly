<template>
  <n-data-table
    :columns="computedColumns"
    :data="subscriptions"
    :row-key="(row: Subscription) => row.id"
    :bordered="false"
    :scroll-x="700"
    :checked-row-keys="selectable ? selectedIds : undefined"
    @update:checked-row-keys="handleCheckedChange"
    striped
  >
    <template #empty>
      <n-empty description="暂无订阅数据" />
    </template>
  </n-data-table>
</template>

<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui';
import { NButton, NEmpty, NIcon, NPopconfirm, NSpace, NTag } from 'naive-ui';
import { computed, h } from 'vue';
import Icon from '../common/Icon.vue';
import { TYPE_LABELS, CURRENCY_SYMBOLS } from '../../constants';
import type { Subscription } from '../../types';

const props = defineProps<{
  subscriptions: Subscription[];
  selectable?: boolean;
  selectedIds?: number[];
}>();

const emit = defineEmits<{
  edit: [subscription: Subscription];
  delete: [subscription: Subscription];
  'toggle-status': [subscription: Subscription];
  'update:selectedIds': [ids: number[]];
}>();

function handleCheckedChange(keys: (string | number)[]) {
  emit('update:selectedIds', keys as number[]);
}

const typeLabels = TYPE_LABELS;
const currencySymbols = CURRENCY_SYMBOLS;

function getStatusType(
  subscription: Subscription,
): 'success' | 'warning' | 'error' | 'default' {
  if (subscription.status === 'inactive') return 'default';
  if (subscription.one_time) return 'success';

  const now = new Date();
  const endDate = new Date(subscription.end_date);
  const daysLeft = Math.ceil(
    (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysLeft < 0) return 'error';
  if (daysLeft <= 7) return 'warning';
  return 'success';
}

function getStatusText(subscription: Subscription): string {
  if (subscription.status === 'inactive') return '已停用';
  if (subscription.one_time) return '永久有效';

  const now = new Date();
  const endDate = new Date(subscription.end_date);
  const daysLeft = Math.ceil(
    (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysLeft < 0) return '已过期';
  if (daysLeft <= 7) return '即将到期';
  return '正常';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

const baseColumns: DataTableColumns<Subscription> = [
  {
    title: '服务名称',
    key: 'name',
    // 移除宽度和固定，使其自适应填充剩余空间
    minWidth: 150,
    ellipsis: { tooltip: true },
  },
  {
    title: '类型',
    key: 'type',
    minWidth: 100,
    render(row) {
      return typeLabels[row.type] || row.type;
    },
  },
  {
    title: '详情',
    key: 'type_detail',
    minWidth: 120,
    render(row) {
      return row.type_detail || '-';
    },
  },
  {
    title: '价格',
    key: 'price',
    minWidth: 120,
    render(row) {
      return `${currencySymbols[row.currency]}${row.price.toFixed(2)}`;
    },
  },
  {
    title: '到期日期',
    key: 'end_date',
    minWidth: 120,
    render(row) {
      return row.one_time ? '永久' : formatDate(row.end_date);
    },
  },
  {
    title: '续订类型',
    key: 'renew_type',
    minWidth: 100,
    render(row) {
      if (row.one_time) {
        return h(
          NTag,
          { size: 'small', type: 'success' },
          { default: () => '一次性买断' },
        );
      }
      const renewLabels: Record<
        string,
        { label: string; type: 'info' | 'warning' | 'default' }
      > = {
        auto: { label: '自动续订', type: 'info' },
        manual: { label: '手动续订', type: 'warning' },
        none: { label: '不续订', type: 'default' },
      };
      const config = renewLabels[row.renew_type] || renewLabels.none;
      return h(
        NTag,
        { size: 'small', type: config.type },
        { default: () => config.label },
      );
    },
  },
  {
    title: '状态',
    key: 'status',
    minWidth: 100,
    render(row) {
      return h(
        NTag,
        {
          type: getStatusType(row),
          size: 'small',
          round: true,
          style: { cursor: 'pointer' },
          onClick: () => emit('toggle-status', row),
        },
        { default: () => getStatusText(row) },
      );
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 100, // 增加宽度
    fixed: 'right',
    render(row) {
      return h(
        NSpace,
        {
          size: 'small',
          wrap: false, // 禁止换行
          style: { flexWrap: 'nowrap' },
        },
        {
          default: () => [
            h(
              NButton,
              {
                size: 'small',
                quaternary: true,
                onClick: () => emit('edit', row),
              },
              { icon: () => h(Icon, { name: 'edit' }) },
            ),
            h(
              NPopconfirm,
              {
                onPositiveClick: () => emit('delete', row),
              },
              {
                trigger: () =>
                  h(
                    NButton,
                    {
                      size: 'small',
                      quaternary: true,
                      type: 'error',
                    },
                    { icon: () => h(Icon, { name: 'delete' }) },
                  ),
                default: () => '确定删除此订阅吗？',
              },
            ),
          ],
        },
      );
    },
  },
];

const computedColumns = computed(() => {
  if (props.selectable) {
    return [{ type: 'selection' as const }, ...baseColumns];
  }
  return baseColumns;
});
</script>

<style scoped>
</style>
