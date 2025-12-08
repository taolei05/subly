-- Subly D1 数据库 Schema
-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    email TEXT NOT NULL,
    resend_api_key TEXT,
    exchangerate_api_key TEXT,
    resend_domain TEXT,
    resend_notify_time INTEGER DEFAULT 8,
    resend_notify_interval INTEGER DEFAULT 24,
    resend_last_sent_at TEXT,
    serverchan_api_key TEXT,
    serverchan_notify_time INTEGER DEFAULT 8,
    serverchan_notify_interval INTEGER DEFAULT 24,
    serverchan_last_sent_at TEXT,
    site_url TEXT,
    resend_enabled INTEGER DEFAULT 1,
    serverchan_enabled INTEGER DEFAULT 1
);

-- 订阅表
CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('domain', 'server', 'membership', 'software', 'other')),
    type_detail TEXT,
    price REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'CNY' CHECK (currency IN ('CNY', 'HKD', 'USD', 'EUR', 'GBP')),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    remind_days INTEGER NOT NULL DEFAULT 7,
    renew_type TEXT NOT NULL DEFAULT 'none' CHECK (renew_type IN ('none', 'auto', 'manual')),
    one_time INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expiring', 'expired')),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
