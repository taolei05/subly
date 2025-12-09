<template>
  <div class="countdown-section">
    <h3 class="section-title">
      <Icon name="warning" :size="18" />
      即将到期 (7天内)
    </h3>
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
  </div>
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
.countdown-section {
  margin-top: 20px;
  padding: 16px;
  background: var(--n-color);
  border-radius: 8px;
  border: 1px solid var(--n-border-color);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 12px 0;
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
