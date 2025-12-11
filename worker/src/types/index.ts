/// <reference types="@cloudflare/workers-types" />

// ==================== 环境配置 ====================
export interface Env {
	DB: D1Database;
	ENVIRONMENT: string;
	ASSETS?: Fetcher;
}

// ==================== 用户相关 ====================
export interface User {
	id: number;
	username: string;
	password: string;
	site_url?: string;
}

export type UserPublic = Omit<User, "password">;

// ==================== 配置表类型 ====================
export interface ResendConfig {
	id: number;
	user_id: number;
	email: string;
	api_key?: string;
	domain?: string;
	notify_hours?: string;
	last_sent_at?: string;
	enabled: number;
}

export interface ServerChanConfig {
	id: number;
	user_id: number;
	api_key?: string;
	notify_hours?: string;
	last_sent_at?: string;
	enabled: number;
}

export interface ExchangeRateConfig {
	id: number;
	user_id: number;
	api_key?: string;
	enabled: number;
}

// 聚合用户信息（用于API响应）
export interface UserWithConfig {
	id: number;
	username: string;
	site_url?: string;
	// Resend 配置
	email?: string;
	resend_api_key?: string;
	resend_domain?: string;
	resend_enabled?: number;
	resend_notify_hours?: string;
	resend_last_sent_at?: string;
	// Server酱配置
	serverchan_api_key?: string;
	serverchan_enabled?: number;
	serverchan_notify_hours?: string;
	serverchan_last_sent_at?: string;
	// ExchangeRate 配置
	exchangerate_api_key?: string;
	exchangerate_enabled?: number;
}

// ==================== 订阅相关 ====================
export type SubscriptionType =
	| "domain"
	| "server"
	| "membership"
	| "software"
	| "other";
export type SubscriptionStatus = "active" | "inactive" | "expiring" | "expired";
export type RenewType = "none" | "auto" | "manual";
export type Currency = "CNY" | "HKD" | "USD" | "EUR" | "GBP";

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
	renew_type: RenewType;
	one_time: boolean;
	status: SubscriptionStatus;
	notes?: string;
	created_at: string;
	updated_at: string;
}

// ==================== JWT 相关 ====================
export interface JWTPayload {
	userId: number;
	username: string;
	exp: number;
}

// ==================== API 请求/响应类型 ====================
export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	message?: string;
}

// 设置更新请求
export interface UpdateSettingsRequest {
	email?: string;
	// Resend 配置
	resend_api_key?: string;
	resend_domain?: string;
	resend_enabled?: boolean;
	resend_notify_hours?: string;
	// Server酱配置
	serverchan_api_key?: string;
	serverchan_enabled?: boolean;
	serverchan_notify_hours?: string;
	// ExchangeRate 配置
	exchangerate_api_key?: string;
	exchangerate_enabled?: boolean;
	// 其他
	site_url?: string;
}

// 订阅创建/更新请求
export interface SubscriptionRequest {
	name: string;
	type: SubscriptionType;
	type_detail?: string;
	price: number;
	currency: Currency;
	start_date: string;
	end_date: string;
	remind_days: number;
	renew_type?: RenewType;
	one_time: boolean;
	notes?: string;
}

// 汇率响应
export interface ExchangeRateResponse {
	success: boolean;
	source: "exchangerate-api" | "default";
	data: {
		base: string;
		rates: Record<string, number>;
	};
}
