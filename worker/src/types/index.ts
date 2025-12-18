/// <reference types="@cloudflare/workers-types" />

// ==================== 环境配置 ====================
export interface Env {
	DB: D1Database;
	ENVIRONMENT: string;
	JWT_SECRET: string;
	ASSETS?: Fetcher;
	BACKUP_BUCKET?: R2Bucket;
}

// ==================== 用户相关 ====================
export type UserRole = "admin" | "user" | "demo";

export interface User {
	id: number;
	username: string;
	password: string;
	role: UserRole;
	site_url?: string;
	// 两步验证 (2FA)
	totp_secret?: string;
	totp_enabled?: number;
}

// 备份配置
export interface BackupConfig {
	id: number;
	user_id: number;
	enabled: number;
	frequency: BackupFrequency;
	to_email: number;
	to_r2: number;
	backup_subscriptions: number;
	backup_settings: number;
	last_at?: string;
}

export type BackupFrequency = "daily" | "weekly" | "monthly";

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
	role: UserRole;
	site_url?: string;
	// Resend 配置
	email?: string;
	resend_api_key?: string;
	resend_domain?: string;
	resend_enabled?: number;
	resend_notify_hours?: string;
	resend_last_sent_at?: string;
	resend_template_subject?: string;
	resend_template_body?: string;
	// Server酱配置
	serverchan_api_key?: string;
	serverchan_enabled?: number;
	serverchan_notify_hours?: string;
	serverchan_last_sent_at?: string;
	serverchan_template_title?: string;
	serverchan_template_body?: string;
	// ExchangeRate 配置
	exchangerate_api_key?: string;
	exchangerate_enabled?: number;
	// 备份配置
	backup_enabled?: number;
	backup_frequency?: BackupFrequency;
	backup_to_email?: number;
	backup_to_r2?: number;
	backup_subscriptions?: number;
	backup_settings?: number;
	backup_last_at?: string;
	// 两步验证 (2FA)
	totp_enabled?: number;
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
	initial_price?: number;
	currency: Currency;
	start_date: string;
	end_date: string;
	remind_days: number;
	renew_type: RenewType;
	one_time: boolean;
	status: SubscriptionStatus;
	url?: string;
	notes?: string;
	created_at: string;
	updated_at: string;
}

// ==================== 系统配置 ====================
export interface SystemConfig {
	id: number;
	registration_enabled: number;
	created_at?: string;
	updated_at?: string;
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
	resend_template_subject?: string;
	resend_template_body?: string;
	// Server酱配置
	serverchan_api_key?: string;
	serverchan_enabled?: boolean;
	serverchan_notify_hours?: string;
	serverchan_template_title?: string;
	serverchan_template_body?: string;
	// ExchangeRate 配置
	exchangerate_api_key?: string;
	exchangerate_enabled?: boolean;
	// 备份配置
	backup_enabled?: boolean;
	backup_frequency?: BackupFrequency;
	backup_to_email?: boolean;
	backup_to_r2?: boolean;
	backup_subscriptions?: boolean;
	backup_settings?: boolean;
	// 其他
	site_url?: string;
}

// 订阅创建/更新请求
export interface SubscriptionRequest {
	name: string;
	type: SubscriptionType;
	type_detail?: string;
	price: number;
	initial_price?: number;
	currency: Currency;
	start_date: string;
	end_date: string;
	remind_days: number;
	renew_type?: RenewType;
	one_time: boolean;
	url?: string;
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
