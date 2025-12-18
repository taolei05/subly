import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { subscriptionApi } from '../api/subscription';
import type {
  ApiResponse,
  Currency,
  Subscription,
  SubscriptionFormData,
  SubscriptionPayload,
  SubscriptionStats,
} from '../types';
import { formatDate } from '../utils';

// 默认汇率
const DEFAULT_RATES: Record<Currency, number> = {
  CNY: 1,
  HKD: 1.09,
  USD: 0.14,
  EUR: 0.13,
  GBP: 0.11,
};

// 从 localStorage 读取保存的货币选择
function getSavedCurrency(): Currency {
  const saved = localStorage.getItem('selectedCurrency');
  if (saved && ['CNY', 'HKD', 'USD', 'EUR', 'GBP'].includes(saved)) {
    return saved as Currency;
  }
  return 'CNY';
}

// 从 localStorage 读取缓存的汇率
function getCachedRates(): Record<Currency, number> {
  try {
    const cached = localStorage.getItem('exchangeRates');
    if (cached) {
      const data = JSON.parse(cached);
      // 检查缓存是否过期（24小时）
      if (data.timestamp && Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
        return data.rates;
      }
    }
  } catch {
    // 解析失败，使用默认值
  }
  return DEFAULT_RATES;
}

export const useSubscriptionStore = defineStore('subscription', () => {
  const subscriptions = ref<Subscription[]>([]);
  const loading = ref(false);
  const selectedCurrency = ref<Currency>(getSavedCurrency());
  const exchangeRates = ref<Record<Currency, number>>(getCachedRates());

  // 监听货币变化并保存到 localStorage
  function setSelectedCurrency(currency: Currency) {
    selectedCurrency.value = currency;
    localStorage.setItem('selectedCurrency', currency);
  }

  const stats = computed<SubscriptionStats>(() => {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let oneTimeTotal = 0;
    let monthlyTotal = 0;
    let expiringCount = 0;

    subscriptions.value.forEach((sub) => {
      if (sub.status === 'inactive') return;

      const endDate = new Date(sub.end_date);

      if (sub.one_time) {
        // 永久授权使用首付价格
        const initialPriceInSelectedCurrency = convertCurrency(
          sub.initial_price ?? sub.price,
          sub.currency,
          selectedCurrency.value,
        );
        oneTimeTotal += initialPriceInSelectedCurrency;
      } else {
        // 订阅使用续费价格计算月均
        const priceInSelectedCurrency = convertCurrency(
          sub.price,
          sub.currency,
          selectedCurrency.value,
        );
        const startDate = new Date(sub.start_date);
        const months = Math.max(
          1,
          (endDate.getTime() - startDate.getTime()) /
            (30 * 24 * 60 * 60 * 1000),
        );
        monthlyTotal += priceInSelectedCurrency / months;
      }

      if (endDate <= sevenDaysLater && endDate > now) {
        expiringCount++;
      }
    });

    return {
      total: subscriptions.value.filter((s) => s.status !== 'inactive').length,
      expiring: expiringCount,
      oneTimeTotal: Math.round(oneTimeTotal * 100) / 100,
      monthlyAverage: Math.round(monthlyTotal * 100) / 100,
    };
  });

  function convertCurrency(
    amount: number,
    from: Currency,
    to: Currency,
  ): number {
    if (from === to) return amount;
    const fromRate = exchangeRates.value[from] || 1;
    const toRate = exchangeRates.value[to] || 1;
    return (amount / fromRate) * toRate;
  }

  async function fetchSubscriptions(): Promise<void> {
    loading.value = true;
    try {
      const response = await subscriptionApi.getAll();
      if (response.success && response.data) {
        subscriptions.value = response.data;
      }
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
    } finally {
      loading.value = false;
    }
  }

  async function createSubscription(
    formData: SubscriptionFormData,
  ): Promise<ApiResponse> {
    try {
      // 永久授权支出时，end_date 设为空字符串或远期日期
      const endDate = formData.one_time
        ? '9999-12-31'
        : formatDate(formData.end_date || Date.now());
      const payload: SubscriptionPayload = {
        ...formData,
        start_date: formatDate(formData.start_date || Date.now()),
        end_date: endDate,
      };
      const response = await subscriptionApi.create(payload);
      if (response.success && response.data) {
        // 检查返回的数据是否完整 (是否存在 name 字段)
        if (response.data.name) {
          // 完整数据，直接添加到本地列表
          subscriptions.value.push(response.data);
        } else {
          // 数据不完整 (可能是旧版后端只返回了 ID)，重新拉取列表
          await fetchSubscriptions();
        }
      }
      return response;
    } catch (error) {
      return { success: false, message: '创建订阅失败' };
    }
  }

  async function updateSubscription(
    id: number,
    formData: SubscriptionFormData,
  ): Promise<ApiResponse> {
    try {
      // 永久授权时，end_date 设为远期日期
      const endDate = formData.one_time
        ? '9999-12-31'
        : formatDate(formData.end_date || Date.now());
      const payload: SubscriptionPayload = {
        ...formData,
        start_date: formatDate(formData.start_date || Date.now()),
        end_date: endDate,
      };
      const response = await subscriptionApi.update(id, payload);
      if (response.success) {
        if (response.data?.name) {
          // 本地更新列表中的项目
          const index = subscriptions.value.findIndex((s) => s.id === id);
          if (index !== -1) {
            subscriptions.value[index] = response.data;
          }
        } else {
          // 数据不完整，重新拉取
          await fetchSubscriptions();
        }
      }
      return response;
    } catch (error) {
      return { success: false, message: '更新订阅失败' };
    }
  }

  async function deleteSubscription(id: number): Promise<ApiResponse> {
    try {
      const response = await subscriptionApi.delete(id);
      if (response.success) {
        subscriptions.value = subscriptions.value.filter((s) => s.id !== id);
      }
      return response;
    } catch (error) {
      return { success: false, message: '删除订阅失败' };
    }
  }

  async function toggleStatus(id: number): Promise<ApiResponse> {
    const sub = subscriptions.value.find((s) => s.id === id);
    if (!sub) return { success: false, message: '订阅不存在' };

    try {
      const newStatus = sub.status === 'active' ? 'inactive' : 'active';
      const response = await subscriptionApi.updateStatus(id, newStatus);
      if (response.success) {
        sub.status = newStatus;
      }
      return response;
    } catch (error) {
      return { success: false, message: '更新状态失败' };
    }
  }

  async function fetchExchangeRates(): Promise<void> {
    try {
      const response = await subscriptionApi.getExchangeRates();
      if (response.success && response.data) {
        exchangeRates.value = response.data.rates;
        // 缓存汇率到 localStorage
        localStorage.setItem(
          'exchangeRates',
          JSON.stringify({
            rates: response.data.rates,
            timestamp: Date.now(),
          }),
        );
      }
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
    }
  }

  return {
    subscriptions,
    loading,
    selectedCurrency,
    exchangeRates,
    stats,
    convertCurrency,
    setSelectedCurrency,
    fetchSubscriptions,
    createSubscription,
    updateSubscription,
    deleteSubscription,
    toggleStatus,
    fetchExchangeRates,
  };
});
