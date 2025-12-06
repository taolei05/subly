/// <reference types="@cloudflare/workers-types" />

export interface Env {
    DB: D1Database;
    ENVIRONMENT: string;
    ASSETS?: Fetcher;
}

export interface User {
    id: number;
    username: string;
    password: string;
    email: string;
    resend_api_key?: string;
    exchangerate_api_key?: string;
    resend_domain?: string;
    notify_time?: number;
    created_at: string;
}

export interface Subscription {
    id: number;
    user_id: number;
    name: string;
    type: 'domain' | 'server' | 'membership' | 'software' | 'other';
    type_detail?: string;
    price: number;
    currency: 'CNY' | 'HKD' | 'USD' | 'EUR' | 'GBP';
    start_date: string;
    end_date: string;
    remind_days: number;
    auto_renew: boolean;
    one_time: boolean;
    status: 'active' | 'inactive' | 'expiring' | 'expired';
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface JWTPayload {
    userId: number;
    username: string;
    exp: number;
}
