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
import { CURRENCY_SYMBOLS, TYPE_LABELS } from '../../constants';
import type { Subscription } from '../../types';
import Icon from '../common/Icon.vue';

const props = defineProps<{
  subscriptions: Subscription[];
  selectable?: boolean;
  selectedIds?: number[];
  readonly?: boolean;
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
    minWidth: 150,
    ellipsis: { tooltip: true },
    render(row) {
      if (row.url) {
        return h(
          'a',
          {
            href: row.url,
            target: '_blank',
            rel: 'noopener noreferrer',
            style: {
              color: 'var(--n-text-color)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            },
          },
          [
            row.name,
            h(
              NIcon,
              { size: 14, style: { opacity: 0.5 } },
              {
                default: () =>
                  h(
                    'svg',
                    {
                      xmlns: 'http://www.w3.org/2000/svg',
                      viewBox: '0 0 24 24',
                      fill: 'currentColor',
                    },
                    [
                      h('path', {
                        d: 'M10 6v2H5v11h11v-5h2v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6zm11-3v8h-2V6.413l-7.793 7.794-1.414-1.414L17.585 5H13V3h8z',
                      }),
                    ],
                  ),
              },
            ),
          ],
        );
      }
      return row.name;
    },
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
          style: { cursor: props.readonly ? 'default' : 'pointer' },
          onClick: () => !props.readonly && emit('toggle-status', row),
        },
        { default: () => getStatusText(row) },
      );
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    fixed: 'right',
    render(row) {
      const buttons = [
        h(
          NButton,
          {
            size: 'small',
            quaternary: true,
            onClick: () => emit('edit', row),
          },
          { icon: () => h(Icon, { name: props.readonly ? 'view' : 'edit' }) },
        ),
      ];

      // 只读模式禁用删除按钮
      if (props.readonly) {
        buttons.push(
          h(
            NButton,
            {
              size: 'small',
              quaternary: true,
              type: 'error',
              disabled: true,
            },
            { icon: () => h(Icon, { name: 'delete' }) },
          ),
        );
      } else {
        buttons.push(
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
        );
      }

      return h(
        NSpace,
        {
          size: 'small',
          wrap: false,
          style: { flexWrap: 'nowrap' },
        },
        { default: () => buttons },
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
