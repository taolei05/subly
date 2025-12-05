<template>
  <n-data-table
    :columns="columns"
    :data="subscriptions"
    :row-key="(row: Subscription) => row.id"
    :bordered="false"
    :scroll-x="700"
    striped
  >
    <template #empty>
      <n-empty description="暂无订阅数据" />
    </template>
  </n-data-table>
</template>

<script setup lang="ts">
import { h } from 'vue';
import { NButton, NIcon, NTag, NSpace, NPopconfirm, NEmpty } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import type { Subscription } from '../../types';
import EditIcon from '../../assets/icons/EditIcon.vue';
import DeleteIcon from '../../assets/icons/DeleteIcon.vue';

const props = defineProps<{
  subscriptions: Subscription[];
}>();

const emit = defineEmits<{
  edit: [subscription: Subscription];
  delete: [subscription: Subscription];
  'toggle-status': [subscription: Subscription];
}>();

const typeLabels: Record<string, string> = {
  domain: '域名',
  server: '服务器',
  membership: '会员',
  software: '软件',
  other: '其他'
};

const currencySymbols: Record<string, string> = {
  CNY: '¥',
  HKD: 'HK$',
  USD: '$',
  EUR: '€',
  GBP: '£'
};

function getStatusType(subscription: Subscription): 'success' | 'warning' | 'error' | 'default' {
  if (subscription.status === 'inactive') return 'default';
  
  const now = new Date();
  const endDate = new Date(subscription.end_date);
  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysLeft < 0) return 'error';
  if (daysLeft <= 7) return 'warning';
  return 'success';
}

function getStatusText(subscription: Subscription): string {
  if (subscription.status === 'inactive') return '已停用';
  
  const now = new Date();
  const endDate = new Date(subscription.end_date);
  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysLeft < 0) return '已过期';
  if (daysLeft <= 7) return '即将到期';
  return '正常';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

const columns: DataTableColumns<Subscription> = [
  {
    title: '服务名称',
    key: 'name',
    width: 150,
    fixed: 'left',
    ellipsis: { tooltip: true }
  },
  {
    title: '类型',
    key: 'type',
    width: 100,
    render(row) {
      return typeLabels[row.type] || row.type;
    }
  },
  {
    title: '价格',
    key: 'price',
    width: 120,
    render(row) {
      return `${currencySymbols[row.currency]}${row.price.toFixed(2)}`;
    }
  },
  {
    title: '到期日期',
    key: 'end_date',
    width: 120,
    render(row) {
      return formatDate(row.end_date);
    }
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render(row) {
      return h(
        NTag,
        {
          type: getStatusType(row),
          size: 'small',
          round: true,
          style: { cursor: 'pointer' },
          onClick: () => emit('toggle-status', row)
        },
        { default: () => getStatusText(row) }
      );
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    fixed: 'right',
    render(row) {
      return h(NSpace, { size: 'small' }, {
        default: () => [
          h(
            NButton,
            {
              size: 'small',
              quaternary: true,
              onClick: () => emit('edit', row)
            },
            { icon: () => h(NIcon, null, { default: () => h(EditIcon) }) }
          ),
          h(
            NPopconfirm,
            {
              onPositiveClick: () => emit('delete', row)
            },
            {
              trigger: () => h(
                NButton,
                {
                  size: 'small',
                  quaternary: true,
                  type: 'error'
                },
                { icon: () => h(NIcon, null, { default: () => h(DeleteIcon) }) }
              ),
              default: () => '确定删除此订阅吗？'
            }
          )
        ]
      });
    }
  }
];
</script>

<style scoped>
</style>
