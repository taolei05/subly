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

// 从 localStorage 读取保存的货币选择
function getSavedCurrency(): Currency {
  const saved = localStorage.getItem('selectedCurrency');
  if (saved && ['CNY', 'HKD', 'USD', 'EUR', 'GBP'].includes(saved)) {
    return saved as Currency;
  }
  return 'CNY';
}

export const useSubscriptionStore = defineStore('subscription', () => {
  const subscriptions = ref<Subscription[]>([]);
  const loading = ref(false);
  const selectedCurrency = ref<Currency>(getSavedCurrency());
  const exchangeRates = ref<Record<Currency, number>>({
    CNY: 1,
    HKD: 1.09,
    USD: 0.14,
    EUR: 0.13,
    GBP: 0.11,
  });

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
      const priceInSelectedCurrency = convertCurrency(
        sub.price,
        sub.currency,
        selectedCurrency.value,
      );

      if (sub.one_time) {
        oneTimeTotal += priceInSelectedCurrency;
      } else {
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
      // 一次性买断时，end_date 设为空字符串或远期日期
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
      // 一次性买断时，end_date 设为远期日期
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
        if (response.data && response.data.name) {
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
