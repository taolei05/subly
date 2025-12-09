<template>
  <div class="stats-grid">
    <n-card :bordered="false" class="stat-card">
      <div class="stat-content">
        <div class="stat-icon total">
          <n-icon size="24"><SubscriptionIcon /></n-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-label">总订阅</div>
        </div>
      </div>
    </n-card>
    
    <n-card :bordered="false" class="stat-card">
      <div class="stat-content">
        <div class="stat-icon expiring">
          <n-icon size="24"><ClockIcon /></n-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.expiring }}</div>
          <div class="stat-label">即将到期</div>
        </div>
      </div>
    </n-card>
    
    <n-card :bordered="false" class="stat-card">
      <div class="stat-content">
        <div class="stat-icon one-time">
          <n-icon size="24"><MoneyIcon /></n-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">
            {{ currencySymbols[currency] }}{{ stats.oneTimeTotal.toFixed(2) }}
          </div>
          <div class="stat-label">一次性买断支出</div>
        </div>
      </div>
    </n-card>
    
    <n-card :bordered="false" class="stat-card">
      <div class="stat-content">
        <div class="stat-icon monthly">
          <n-icon size="24"><MoneyIcon /></n-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">
            {{ currencySymbols[currency] }}{{ stats.monthlyAverage.toFixed(2) }}
          </div>
          <div class="stat-label">月均支出</div>
        </div>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import ClockIcon from '../../assets/icons/ClockIcon.vue';
import MoneyIcon from '../../assets/icons/MoneyIcon.vue';
import SubscriptionIcon from '../../assets/icons/SubscriptionIcon.vue';
import type { Currency, SubscriptionStats } from '../../types';

defineProps<{
  stats: SubscriptionStats;
  currency: Currency;
}>();

const currencySymbols: Record<Currency, string> = {
  CNY: '¥',
  HKD: 'HK$',
  USD: '$',
  EUR: '€',
  GBP: '£',
};
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.stat-card {
  border-radius: 12px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon.total {
  background-color: rgba(24, 160, 88, 0.1);
  color: #18a058;
}

.stat-icon.expiring {
  background-color: rgba(240, 160, 32, 0.1);
  color: #f0a020;
}

.stat-icon.one-time {
  background-color: rgba(32, 128, 240, 0.1);
  color: #2080f0;
}

.stat-icon.monthly {
  background-color: rgba(208, 48, 80, 0.1);
  color: #d03050;
}

.stat-info {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-label {
  font-size: 14px;
  color: #999;
  margin-top: 4px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .stats-grid {
    gap: 12px;
  }
  
  .stat-icon {
    width: 40px;
    height: 40px;
  }
  
  .stat-value {
    font-size: 20px;
  }
  
  .stat-label {
    font-size: 12px;
  }
}
</style>
