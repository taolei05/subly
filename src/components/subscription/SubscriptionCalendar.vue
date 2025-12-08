<template>
  <div class="calendar-container">
    <!-- 日历头部 -->
    <div class="calendar-header">
      <n-button quaternary circle size="small" @click="prevMonth">
        <template #icon>
          <n-icon size="16">
            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </n-icon>
        </template>
      </n-button>
      <span class="calendar-title">{{ currentYear }}年{{ currentMonth + 1 }}月</span>
      <n-button quaternary circle size="small" @click="nextMonth">
        <template #icon>
          <n-icon size="16">
            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </n-icon>
        </template>
      </n-button>
      <n-button size="tiny" @click="goToToday" style="margin-left: 8px;">
        今天
      </n-button>
    </div>

    <!-- 星期标题 -->
    <div class="calendar-weekdays">
      <div v-for="day in weekDays" :key="day" class="weekday">{{ day }}</div>
    </div>

    <!-- 日历网格 -->
    <div class="calendar-grid">
      <div
        v-for="(day, index) in calendarDays"
        :key="index"
        class="calendar-day"
        :class="{
          'other-month': !day.isCurrentMonth,
          'today': day.isToday,
          'has-subscriptions': day.subscriptions.length > 0,
          'selected': selectedDate === day.dateStr
        }"
        @click="handleDayClick(day)"
      >
        <span class="day-number">{{ day.day }}</span>
        <div v-if="day.subscriptions.length > 0" class="subscription-indicator">
          <n-badge :value="day.subscriptions.length" :max="9" type="warning" />
        </div>
      </div>
    </div>

    <!-- 选中日期的订阅详情 -->
    <n-modal v-model:show="showDetailModal" preset="card" :title="detailTitle" style="width: 420px; max-width: 90vw;">
      <div v-if="selectedDaySubscriptions.length > 0" class="detail-list">
        <div
          v-for="sub in selectedDaySubscriptions"
          :key="sub.id"
          class="detail-item"
          @click="$emit('edit', sub)"
        >
          <div class="detail-info">
            <span class="detail-name">{{ sub.name }}</span>
            <n-tag size="small" :type="getTypeTagType(sub.type)">{{ typeLabels[sub.type] }}</n-tag>
          </div>
          <div class="detail-meta">
            <span>{{ currencySymbols[sub.currency] }}{{ sub.price.toFixed(2) }}</span>
          </div>
        </div>
      </div>
      <n-empty v-else description="该日期没有到期的订阅" />
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Subscription, SubscriptionType } from '../../types';

const props = defineProps<{
  subscriptions: Subscription[];
}>();

const emit = defineEmits<{
  edit: [subscription: Subscription];
}>();

// 当前显示的年月
const currentYear = ref(new Date().getFullYear());
const currentMonth = ref(new Date().getMonth());
const selectedDate = ref<string | null>(null);
const showDetailModal = ref(false);
const selectedDaySubscriptions = ref<Subscription[]>([]);

const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

const typeLabels: Record<string, string> = {
  domain: '域名',
  server: '服务器',
  membership: '会员',
  software: '软件',
  other: '其他',
};

const currencySymbols: Record<string, string> = {
  CNY: '¥',
  HKD: 'HK$',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

function getTypeTagType(
  type: SubscriptionType,
): 'info' | 'success' | 'warning' | 'error' | 'default' {
  const typeMap: Record<
    string,
    'info' | 'success' | 'warning' | 'error' | 'default'
  > = {
    domain: 'info',
    server: 'success',
    membership: 'warning',
    software: 'error',
    other: 'default',
  };
  return typeMap[type] || 'default';
}

// 按日期分组的订阅
const subscriptionsByDate = computed(() => {
  const map = new Map<string, Subscription[]>();
  for (const sub of props.subscriptions) {
    const dateStr = sub.end_date.split('T')[0];
    if (!map.has(dateStr)) {
      map.set(dateStr, []);
    }
    map.get(dateStr)!.push(sub);
  }
  return map;
});

interface CalendarDay {
  day: number;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  subscriptions: Subscription[];
}

// 生成日历天数
const calendarDays = computed<CalendarDay[]>(() => {
  const days: CalendarDay[] = [];
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // 当月第一天
  const firstDay = new Date(currentYear.value, currentMonth.value, 1);
  // 当月最后一天
  const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0);

  // 上月需要显示的天数
  const startDayOfWeek = firstDay.getDay();
  const prevMonthLastDay = new Date(
    currentYear.value,
    currentMonth.value,
    0,
  ).getDate();

  // 添加上月的天数
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    const prevMonth = currentMonth.value === 0 ? 11 : currentMonth.value - 1;
    const prevYear =
      currentMonth.value === 0 ? currentYear.value - 1 : currentYear.value;
    const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    days.push({
      day,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      subscriptions: subscriptionsByDate.value.get(dateStr) || [],
    });
  }

  // 添加当月的天数
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateStr = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    days.push({
      day,
      dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      subscriptions: subscriptionsByDate.value.get(dateStr) || [],
    });
  }

  // 添加下月的天数，补齐到42天（6行）
  const remainingDays = 42 - days.length;
  for (let day = 1; day <= remainingDays; day++) {
    const nextMonth = currentMonth.value === 11 ? 0 : currentMonth.value + 1;
    const nextYear =
      currentMonth.value === 11 ? currentYear.value + 1 : currentYear.value;
    const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    days.push({
      day,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      subscriptions: subscriptionsByDate.value.get(dateStr) || [],
    });
  }

  return days;
});

const detailTitle = computed(() => {
  if (!selectedDate.value) return '';
  const [year, month, day] = selectedDate.value.split('-');
  return `${year}年${Number.parseInt(month)}月${Number.parseInt(day)}日到期的订阅`;
});

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11;
    currentYear.value--;
  } else {
    currentMonth.value--;
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0;
    currentYear.value++;
  } else {
    currentMonth.value++;
  }
}

function goToToday() {
  const today = new Date();
  currentYear.value = today.getFullYear();
  currentMonth.value = today.getMonth();
}

function handleDayClick(day: CalendarDay) {
  selectedDate.value = day.dateStr;
  selectedDaySubscriptions.value = day.subscriptions;
  if (day.subscriptions.length > 0) {
    showDetailModal.value = true;
  }
}
</script>

<style scoped>
.calendar-container {
  background: var(--n-color);
  border-radius: 8px;
  border: 1px solid var(--n-border-color);
  padding: 12px;
  max-width: 480px;
  margin: 0 auto;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  gap: 4px;
}

.calendar-title {
  font-size: 15px;
  font-weight: 600;
  min-width: 100px;
  text-align: center;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 4px;
}

.weekday {
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  color: var(--n-text-color-3);
  padding: 4px 0;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  min-height: 44px;
  max-height: 52px;
}

.calendar-day:hover {
  background: var(--n-color-hover);
}

.calendar-day.other-month {
  opacity: 0.35;
}

.calendar-day.today {
  background: var(--n-color-target);
  border: 1.5px solid var(--n-primary-color);
}

.calendar-day.selected {
  background: var(--n-primary-color-hover);
}

.calendar-day.has-subscriptions {
  background: rgba(250, 173, 20, 0.1);
}

.calendar-day.has-subscriptions:hover {
  background: rgba(250, 173, 20, 0.2);
}

.day-number {
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
}

.subscription-indicator {
  margin-top: 2px;
  transform: scale(0.85);
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: var(--n-color-modal);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.detail-item:hover {
  background: var(--n-color-hover);
}

.detail-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-name {
  font-weight: 500;
  font-size: 14px;
}

.detail-meta {
  color: var(--n-text-color-2);
  font-size: 13px;
}

@media (max-width: 768px) {
  .calendar-container {
    max-width: 100%;
    padding: 10px;
  }
  
  .calendar-day {
    min-height: 38px;
    max-height: 44px;
  }
  
  .day-number {
    font-size: 12px;
  }
  
  .calendar-title {
    font-size: 14px;
  }
  
  .subscription-indicator {
    transform: scale(0.75);
  }
}
</style>
