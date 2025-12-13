-- Subly D1 数据库 Schema

-- 系统配置表（全局配置，单行）
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    registration_enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 初始化系统配置（确保只有一行）
INSERT OR IGNORE INTO system_config (id, registration_enabled) VALUES (1, 1);

-- 用户表（核心信息）
-- role: admin(管理员), user(普通用户), demo(演示用户)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'demo')),
    site_url TEXT,
    -- 备份配置
    backup_enabled INTEGER DEFAULT 0,
    backup_frequency TEXT DEFAULT 'weekly' CHECK (backup_frequency IN ('daily', 'weekly', 'monthly')),
    backup_to_email INTEGER DEFAULT 1,
    backup_to_r2 INTEGER DEFAULT 0,
    backup_subscriptions INTEGER DEFAULT 1,
    backup_settings INTEGER DEFAULT 0,
    backup_last_at TEXT,
    -- 两步验证 (2FA)
    totp_secret TEXT,
    totp_enabled INTEGER DEFAULT 0
);

-- Resend 邮件配置表
CREATE TABLE IF NOT EXISTS resend_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    email TEXT NOT NULL,
    api_key TEXT,
    domain TEXT,
    notify_hours TEXT DEFAULT '8',
    last_sent_at TEXT,
    enabled INTEGER DEFAULT 1,
    template_subject TEXT,
    template_body TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Server酱配置表
CREATE TABLE IF NOT EXISTS serverchan_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    api_key TEXT,
    notify_hours TEXT DEFAULT '8',
    last_sent_at TEXT,
    enabled INTEGER DEFAULT 1,
    template_title TEXT,
    template_body TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 汇率 API 配置表
CREATE TABLE IF NOT EXISTS exchangerate_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    api_key TEXT,
    enabled INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
CREATE INDEX IF NOT EXISTS idx_resend_config_user_id ON resend_config(user_id);
CREATE INDEX IF NOT EXISTS idx_serverchan_config_user_id ON serverchan_config(user_id);
CREATE INDEX IF NOT EXISTS idx_exchangerate_config_user_id ON exchangerate_config(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
