<template>
  <n-collapse class="charts-collapse">
    <n-collapse-item name="charts">
      <template #header>
        <div class="section-title">
          <Icon name="stats" :size="20" />
          订阅统计
        </div>
      </template>
      <n-grid cols="1 m:2" responsive="screen" :x-gap="16" :y-gap="16">
        <n-gi>
          <n-card title="类型分布" size="small">
            <v-chart class="chart" :option="typeChartOption" autoresize />
          </n-card>
        </n-gi>
        <n-gi>
          <n-card title="月度支出趋势" size="small">
            <v-chart class="chart" :option="trendChartOption" autoresize />
          </n-card>
        </n-gi>
      </n-grid>
    </n-collapse-item>
  </n-collapse>
</template>

<script setup lang="ts">
import { BarChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { computed } from 'vue';
import VChart from 'vue-echarts';
import { useSubscriptionStore } from '../../stores/subscription';
import type { Currency, Subscription, SubscriptionType } from '../../types';
import Icon from '../common/Icon.vue';

use([
  CanvasRenderer,
  PieChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
]);

const subscriptionStore = useSubscriptionStore();

const TYPE_LABELS: Record<SubscriptionType, string> = {
  domain: '域名',
  server: '服务器',
  membership: '会员',
  software: '软件',
  other: '其他',
};

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  CNY: '¥',
  HKD: 'HK$',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

const currencySymbol = computed(
  () => CURRENCY_SYMBOLS[subscriptionStore.selectedCurrency],
);

function convertPrice(sub: Subscription): number {
  return subscriptionStore.convertCurrency(
    sub.price,
    sub.currency,
    subscriptionStore.selectedCurrency,
  );
}

function getMonthlyPrice(sub: Subscription): number {
  if (sub.one_time) return 0;
  const start = new Date(sub.start_date);
  const end = new Date(sub.end_date);
  const months = Math.max(
    1,
    (end.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000),
  );
  return convertPrice(sub) / months;
}

const typeChartOption = computed(() => {
  const typeData: Record<SubscriptionType, number> = {
    domain: 0,
    server: 0,
    membership: 0,
    software: 0,
    other: 0,
  };

  subscriptionStore.subscriptions
    .filter((s) => s.status !== 'inactive')
    .forEach((sub) => {
      typeData[sub.type] += getMonthlyPrice(sub);
    });

  const data = Object.entries(typeData)
    .filter(([, value]) => value > 0)
    .map(([type, value]) => ({
      name: TYPE_LABELS[type as SubscriptionType],
      value: Math.round(value * 100) / 100,
    }));

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: { name: string; value: number; percent: number }) =>
        `${params.name}<br/>${currencySymbol.value}${params.value.toFixed(2)}/月 (${params.percent}%)`,
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold' },
        },
        data,
      },
    ],
  };
});

const trendChartOption = computed(() => {
  const now = new Date();
  const months: string[] = [];
  const monthlyData: number[] = [];

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${date.getMonth() + 1}月`);

    let monthTotal = 0;
    subscriptionStore.subscriptions
      .filter((s) => s.status !== 'inactive' && !s.one_time)
      .forEach((sub) => {
        const start = new Date(sub.start_date);
        const end = new Date(sub.end_date);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        if (start <= monthEnd && end >= monthStart) {
          monthTotal += getMonthlyPrice(sub);
        }
      });

    monthlyData.push(Math.round(monthTotal * 100) / 100);
  }

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ name: string; value: number }>) =>
        `${params[0].name}<br/>支出: ${currencySymbol.value}${params[0].value.toFixed(2)}`,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: months,
      axisLine: { lineStyle: { color: '#ccc' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => `${currencySymbol.value}${value}`,
      },
      axisLine: { show: false },
      splitLine: { lineStyle: { type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        data: monthlyData,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#18a058' },
              { offset: 1, color: '#36ad6a' },
            ],
          },
        },
        barWidth: '50%',
      },
    ],
  };
});
</script>

<style scoped>
.charts-collapse {
  margin-bottom: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--n-text-color);
}

.chart {
  height: 280px;
}
</style>
