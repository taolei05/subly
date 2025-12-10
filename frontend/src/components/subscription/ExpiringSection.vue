<template>
  <n-collapse class="expiring-collapse">
    <n-collapse-item name="expiring">
      <template #header>
        <div class="section-title">
          <Icon name="warning" :size="18" />
          即将到期 (7天内)
        </div>
      </template>
      <div class="countdown-list">
        <div v-for="sub in subscriptions" :key="sub.id" class="countdown-item">
          <div class="countdown-info">
            <span class="countdown-name">{{ sub.name }}</span>
            <span class="countdown-date">{{ sub.end_date }}</span>
          </div>
          <n-tag :type="getCountdownType(sub.daysLeft)" size="small">
            {{ getCountdownText(sub.daysLeft) }}
          </n-tag>
        </div>
      </div>
    </n-collapse-item>
  </n-collapse>
</template>

<script setup lang="ts">
import type { Subscription } from '../../types';
import Icon from '../common/Icon.vue';

defineProps<{
  subscriptions: (Subscription & { daysLeft: number })[];
}>();

function getCountdownType(daysLeft: number): 'error' | 'warning' | 'info' {
  if (daysLeft <= 0) return 'error';
  if (daysLeft <= 3) return 'warning';
  return 'info';
}

function getCountdownText(daysLeft: number): string {
  if (daysLeft === 0) return '今天到期';
  if (daysLeft < 0) return `已过期 ${Math.abs(daysLeft)} 天`;
  return `${daysLeft} 天后`;
}
</script>

<style scoped>
.expiring-collapse {
  margin-top: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--n-text-color);
}

.countdown-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.countdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: var(--n-color-modal);
  border-radius: 6px;
}

.countdown-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.countdown-name {
  font-weight: 500;
  font-size: 14px;
}

.countdown-date {
  font-size: 12px;
  color: var(--n-text-color-3);
}
</style>
