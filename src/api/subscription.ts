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
};
