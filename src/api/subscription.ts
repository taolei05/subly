import type {
  ApiResponse,
  ExchangeRates,
  Subscription,
  SubscriptionPayload,
  SubscriptionStatus,
} from '../types';
import { http } from './http';

export const subscriptionApi = {
  getAll: () => http.get<ApiResponse<Subscription[]>>('/subscriptions'),

  getById: (id: number) =>
    http.get<ApiResponse<Subscription>>(`/subscriptions/${id}`),

  create: (data: SubscriptionPayload) =>
    http.post<ApiResponse<Subscription>>('/subscriptions', data),

  update: (id: number, data: SubscriptionPayload) =>
    http.put<ApiResponse<Subscription>>(`/subscriptions/${id}`, data),

  delete: (id: number) => http.delete<ApiResponse>(`/subscriptions/${id}`),

  updateStatus: (id: number, status: SubscriptionStatus) =>
    http.put<ApiResponse>(`/subscriptions/${id}/status`, { status }),

  getExchangeRates: () =>
    http.get<ApiResponse<ExchangeRates>>('/exchange-rate'),

  // 导出订阅
  exportData: (format: 'json' | 'csv') =>
    `/api/subscriptions/export?format=${format}`,

  // 导入订阅
  importData: (data: Record<string, unknown>[]) =>
    http.post<ApiResponse<{ imported: number; failed: number }>>(
      '/subscriptions/import',
      { data },
    ),

  // 批量删除
  batchDelete: (ids: number[]) =>
    http.delete<ApiResponse<{ deleted: number }>>('/subscriptions/batch', {
      ids,
    }),

  // 批量修改提醒天数
  batchUpdateRemindDays: (ids: number[], remind_days: number) =>
    http.patch<ApiResponse<{ updated: number }>>('/subscriptions/batch', {
      ids,
      remind_days,
    }),
};
