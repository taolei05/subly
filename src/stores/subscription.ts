import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Subscription, SubscriptionFormData, SubscriptionStats, Currency, ApiResponse } from '../types';
import { subscriptionApi } from '../api/subscription';

export const useSubscriptionStore = defineStore('subscription', () => {
    const subscriptions = ref<Subscription[]>([]);
    const loading = ref(false);
    const selectedCurrency = ref<Currency>('CNY');
    const exchangeRates = ref<Record<Currency, number>>({
        CNY: 1,
        HKD: 1.09,
        USD: 0.14,
        EUR: 0.13,
        GBP: 0.11
    });

    const stats = computed<SubscriptionStats>(() => {
        const now = new Date();
        const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        let oneTimeTotal = 0;
        let monthlyTotal = 0;
        let expiringCount = 0;

        subscriptions.value.forEach(sub => {
            if (sub.status === 'inactive') return;

            const endDate = new Date(sub.end_date);
            const priceInSelectedCurrency = convertCurrency(sub.price, sub.currency, selectedCurrency.value);

            if (sub.one_time) {
                oneTimeTotal += priceInSelectedCurrency;
            } else {
                const startDate = new Date(sub.start_date);
                const months = Math.max(1, (endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
                monthlyTotal += priceInSelectedCurrency / months;
            }

            if (endDate <= sevenDaysLater && endDate > now) {
                expiringCount++;
            }
        });

        return {
            total: subscriptions.value.filter(s => s.status !== 'inactive').length,
            expiring: expiringCount,
            oneTimeTotal: Math.round(oneTimeTotal * 100) / 100,
            monthlyAverage: Math.round(monthlyTotal * 100) / 100
        };
    });

    function convertCurrency(amount: number, from: Currency, to: Currency): number {
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

    async function createSubscription(data: SubscriptionFormData): Promise<ApiResponse> {
        try {
            const response = await subscriptionApi.create(data);
            if (response.success) {
                await fetchSubscriptions();
            }
            return response;
        } catch (error) {
            return { success: false, message: '创建订阅失败' };
        }
    }

    async function updateSubscription(id: number, data: SubscriptionFormData): Promise<ApiResponse> {
        try {
            const response = await subscriptionApi.update(id, data);
            if (response.success) {
                await fetchSubscriptions();
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
                subscriptions.value = subscriptions.value.filter(s => s.id !== id);
            }
            return response;
        } catch (error) {
            return { success: false, message: '删除订阅失败' };
        }
    }

    async function toggleStatus(id: number): Promise<ApiResponse> {
        const sub = subscriptions.value.find(s => s.id === id);
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
        fetchSubscriptions,
        createSubscription,
        updateSubscription,
        deleteSubscription,
        toggleStatus,
        fetchExchangeRates
    };
});
