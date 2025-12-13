<template>
  <div class="subscription-grid">
    <n-empty v-if="subscriptions.length === 0" description="暂无订阅数据" style="grid-column: 1 / -1; padding: 40px 0;" />
    <n-card 
      v-for="sub in subscriptions" 
      :key="sub.id"
      :bordered="false"
      class="subscription-card"
    >
      <div class="card-header">
        <div class="card-title">
          <template v-if="sub.url">
            <a :href="sub.url" target="_blank" rel="noopener noreferrer" class="card-title-link">
              {{ sub.name }}
              <n-icon :size="14" style="opacity: 0.5; margin-left: 4px;">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6v2H5v11h11v-5h2v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6zm11-3v8h-2V6.413l-7.793 7.794-1.414-1.414L17.585 5H13V3h8z"/></svg>
              </n-icon>
            </a>
          </template>
          <template v-else>{{ sub.name }}</template>
        </div>
        <n-tag 
          :type="getStatusType(sub)" 
          size="small" 
          round
          style="cursor: pointer;"
          @click="$emit('toggle-status', sub)"
        >
          {{ getStatusText(sub) }}
        </n-tag>
      </div>
      
      <div class="card-meta">
        <div class="meta-item">
          <span class="meta-label">类型</span>
          <span class="meta-value">{{ typeLabels[sub.type] }}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">价格</span>
          <span class="meta-value">{{ currencySymbols[sub.currency] }}{{ sub.price.toFixed(2) }}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">到期日期</span>
          <span class="meta-value">{{ sub.one_time ? '永久' : formatDate(sub.end_date) }}</span>
        </div>
        <div v-if="sub.type_detail" class="meta-item">
          <span class="meta-label">详情</span>
          <span class="meta-value">{{ sub.type_detail }}</span>
        </div>
      </div>
      
      <div class="card-tags">
        <n-tag v-if="sub.renew_type === 'auto'" size="small" type="info">自动续订</n-tag>
        <n-tag v-if="sub.renew_type === 'manual'" size="small" type="warning">手动续订</n-tag>
        <n-tag v-if="sub.renew_type === 'none' && !sub.one_time" size="small" type="default">不续订</n-tag>
        <n-tag v-if="sub.one_time" size="small" type="success">一次性买断</n-tag>
        <n-tag v-if="sub.remind_days > 0" size="small">提前{{ sub.remind_days }}天提醒</n-tag>
      </div>
      
      <div v-if="sub.notes" class="card-notes">
        {{ sub.notes }}
      </div>
      
      <div class="card-actions">
        <n-button size="small" quaternary @click="$emit('edit', sub)">
          <template #icon>
            <Icon name="edit" />
          </template>
          编辑
        </n-button>
        <n-popconfirm @positive-click="$emit('delete', sub)">
          <template #trigger>
            <n-button size="small" quaternary type="error">
              <template #icon>
                <Icon name="delete" />
              </template>
              删除
            </n-button>
          </template>
          确定删除此订阅吗？
        </n-popconfirm>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { CURRENCY_SYMBOLS, TYPE_LABELS } from '../../constants';
import type { Subscription } from '../../types';
import Icon from '../common/Icon.vue';

defineProps<{
  subscriptions: Subscription[];
}>();

defineEmits<{
  edit: [subscription: Subscription];
  delete: [subscription: Subscription];
  'toggle-status': [subscription: Subscription];
}>();

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
</script>

<style scoped>
.subscription-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.subscription-card {
  border-radius: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-title-link {
  color: inherit;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.card-title-link:hover {
  color: var(--n-primary-color);
}

.card-meta {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: 12px;
  color: #999;
}

.meta-value {
  font-size: 14px;
  font-weight: 500;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.card-notes {
  font-size: 13px;
  color: #666;
  margin-bottom: 16px;
  padding: 12px;
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
}

.card-actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

@media (max-width: 768px) {
  .subscription-grid {
    grid-template-columns: 1fr;
  }
}
</style>
