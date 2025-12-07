// 订阅相关类型定义

export type Currency = 'CNY' | 'HKD' | 'USD' | 'EUR' | 'GBP';

export type SubscriptionType = 'domain' | 'server' | 'membership' | 'software' | 'other';

export type SubscriptionStatus = 'active' | 'inactive' | 'expiring' | 'expired';

export interface Subscription {
    id: number;
    user_id: number;
    name: string;
    type: SubscriptionType;
    type_detail?: string;
    price: number;
    currency: Currency;
    start_date: string;
    end_date: string;
    remind_days: number;
    auto_renew: boolean;
    one_time: boolean;
    status: SubscriptionStatus;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface UserProfileUpdate {
    username?: string;
    email?: string;
    password?: string;
}

export interface SubscriptionFormData {
    name: string;
    type: SubscriptionType;
    type_detail?: string;
    price: number;
    currency: Currency;
    start_date: number | null;
    end_date: number | null;
    remind_days: number;
    auto_renew: boolean;
    one_time: boolean;
    notes?: string;
}

export interface SubscriptionPayload extends Omit<SubscriptionFormData, 'start_date' | 'end_date'> {
    start_date: string;
    end_date: string;
}

export interface SubscriptionStats {
    total: number;
    expiring: number;
    oneTimeTotal: number;
    monthlyAverage: number;
}

export interface User {
    id: number;
    username: string;
    email: string;
    resend_api_key?: string;
    exchangerate_api_key?: string;
    resend_domain?: string;
    notify_time?: number;
    serverchan_api_key?: string;
}

export interface UserSettings {
    resend_api_key: string;
    exchangerate_api_key: string;
    resend_domain: string;
    notify_time?: number;
    serverchan_api_key?: string;
}

export interface LoginCredentials {
    username: string;
    password: string;
}

export interface RegisterData {
    username: string;
    password: string;
    email: string;
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
}

export interface ExchangeRates {
    base: Currency;
    rates: Record<Currency, number>;
}
