# Subly

轻量级订阅管理与提醒系统，帮助您轻松跟踪各类订阅服务的到期时间，并通过邮件或微信发送及时提醒。

## 功能特性

### 核心功能

- **用户系统**
  - 用户注册/登录
  - 角色权限（管理员/普通用户/演示用户）
  - 两步验证 (2FA/TOTP)
  - 频率限制防暴力破解

- **订阅管理**
  - 添加、编辑、删除订阅
  - 批量操作（删除、修改提醒天数）
  - 订阅类型：域名、服务器、会员、软件、其他
  - 续费类型：自动续费、手动续费、不续费
  - 永久授权标记

- **统计概览**
  - 总订阅数量
  - 即将到期订阅
  - 永久授权支出
  - 月均支出统计

- **多币种支持**
  - 支持 CNY/HKD/USD/EUR/GBP
  - 实时汇率转换（ExchangeRate API）
  - 可切换显示币种

### 通知提醒

- **邮件通知（Resend）**
  - 自定义发件域名
  - 可配置通知时间
  - 自定义邮件模板

- **微信通知（Server酱）**
  - SendKey 配置
  - 可配置通知时间
  - 自定义消息模板

### 数据管理

- **导入/导出**
  - JSON 格式（完整数据）
  - CSV 格式（表格数据）

- **自动备份**
  - 定时备份（每日/每周/每月）
  - 备份到邮箱
  - 备份到 R2 存储
  - 备份内容可选（订阅数据/系统设置）

- **设置恢复**
  - 从备份文件恢复系统设置
  - 支持恢复 2FA 配置

### 界面特性

- 列表/卡片/日历视图切换
- 深色/浅色主题
- 自定义主题色
- 搜索、筛选、排序（支持持久化）
- 响应式设计（移动端适配）

### 安全特性

- JWT Token 认证
- 两步验证 (TOTP)
- IP 频率限制
- 用户名锁定机制
- 渐进式锁定时间

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Vue 3 + TypeScript |
| UI 组件库 | Naive UI |
| 状态管理 | Pinia |
| 路由 | Vue Router |
| 构建工具 | Rsbuild |
| 代码规范 | Biome |
| 后端运行时 | Cloudflare Workers |
| 数据库 | Cloudflare D1 (SQLite) |
| 对象存储 | Cloudflare R2 |
| 邮件服务 | Resend |
| 微信推送 | Server酱 |

## 本地开发

### 环境要求

- Node.js >= 18
- pnpm >= 8
- Cloudflare 账户（用于 D1 数据库）

### 安装依赖

```bash
pnpm install
```

### 配置环境

1. 复制 `wrangler.toml.example` 为 `wrangler.toml`
2. 配置 D1 数据库 ID 和 R2 存储桶

### 初始化数据库

```bash
# 执行数据库迁移（本地）
npx wrangler d1 execute subly --local --file=worker/schema.sql

# 执行数据库迁移（生产环境）
npx wrangler d1 execute subly --file=worker/schema.sql
```

### 启动开发服务器

```bash
# 启动前端开发服务器（终端 1）
pnpm dev

# 启动后端 Worker（终端 2）
pnpm --filter subly-worker dev
```

- 前端：http://localhost:3000
- 后端：http://localhost:8787

## 部署到 Cloudflare

### 1. 创建资源

```bash
# 创建 D1 数据库
wrangler d1 create subly

# 创建 R2 存储桶（用于备份）
wrangler r2 bucket create subly
```

### 2. 配置 wrangler.toml

```toml
name = "subly"
main = "worker/src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"

[[d1_databases]]
binding = "DB"
database_name = "subly"
database_id = "your-database-id"

[[r2_buckets]]
binding = "BACKUP_BUCKET"
bucket_name = "subly"
```

### 3. 设置密钥

```bash
wrangler secret put JWT_SECRET
```

### 4. 执行数据库迁移

```bash
npx wrangler d1 execute subly --file=worker/schema.sql
```

### 5. 构建并部署

```bash
# 一键构建并部署
pnpm deploy

# 或者分步执行
pnpm build
pnpm --filter subly-worker deploy
```

## 项目结构

```
subly/
├── frontend/                   # 前端源码
│   ├── src/
│   │   ├── api/                # API 请求封装
│   │   ├── assets/             # 静态资源
│   │   ├── components/         # 通用组件
│   │   │   ├── layout/         # 布局组件
│   │   │   ├── settings/       # 设置面板组件
│   │   │   └── subscription/   # 订阅相关组件
│   │   ├── constants/          # 常量定义
│   │   ├── router/             # 路由配置
│   │   ├── stores/             # Pinia 状态管理
│   │   ├── types/              # TypeScript 类型
│   │   ├── utils/              # 工具函数
│   │   └── views/              # 页面视图
│   ├── public/                 # 公共资源
│   ├── biome.json              # Biome 配置
│   ├── rsbuild.config.ts       # Rsbuild 配置
│   └── tsconfig.json           # TypeScript 配置
├── worker/                     # 后端 Worker
│   ├── src/
│   │   ├── routes/             # API 路由处理
│   │   │   ├── auth.ts         # 认证路由
│   │   │   ├── backup.ts       # 备份路由
│   │   │   ├── subscriptions.ts # 订阅路由
│   │   │   └── totp.ts         # 2FA 路由
│   │   ├── services/           # 业务服务
│   │   │   ├── backup.ts       # 备份服务
│   │   │   ├── email.ts        # 邮件服务
│   │   │   ├── rateLimit.ts    # 频率限制
│   │   │   ├── serverchan.ts   # Server酱服务
│   │   │   └── totp.ts         # TOTP 服务
│   │   ├── types/              # 类型定义
│   │   ├── utils/              # 工具函数
│   │   ├── router.ts           # 路由注册
│   │   └── index.ts            # 入口文件
│   ├── schema.sql              # 数据库 Schema
│   └── tsconfig.json           # TypeScript 配置
├── wrangler.toml               # Cloudflare Workers 配置
├── pnpm-workspace.yaml         # pnpm 工作区配置
└── package.json                # 项目配置
```

## 可用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动前端开发服务器 |
| `pnpm build` | 构建生产版本 |
| `pnpm deploy` | 构建并部署到 Cloudflare |
| `pnpm preview` | 预览生产构建 |
| `pnpm --filter subly-worker dev` | 本地运行 Worker |
| `pnpm --filter subly-worker deploy` | 部署 Worker 到 Cloudflare |
| `pnpm check` | 运行代码检查 |
| `pnpm format` | 格式化代码 |

## 配置说明

### 系统设置

| 配置项 | 说明 |
|--------|------|
| 站点链接 | 通知邮件中的"查看详情"按钮跳转地址 |
| 开放注册 | 是否允许新用户注册（仅管理员可配置） |

### Resend 邮件配置

| 配置项 | 说明 |
|--------|------|
| 邮箱地址 | 接收通知的邮箱 |
| API Key | Resend API 密钥 |
| 自定义域名 | 发件域名（可选，留空使用 resend.dev） |
| 通知时间 | 每天发送提醒的时间（小时） |
| 邮件模板 | 自定义邮件标题和内容 |

### Server酱配置

| 配置项 | 说明 |
|--------|------|
| SendKey | Server酱 API 密钥 |
| 通知时间 | 每天发送提醒的时间（小时） |
| 消息模板 | 自定义消息标题和内容 |

### ExchangeRate 汇率配置

| 配置项 | 说明 |
|--------|------|
| API Key | ExchangeRate API 密钥 |
| 启用开关 | 关闭后使用默认汇率 |

### 数据备份配置

| 配置项 | 说明 |
|--------|------|
| 启用自动备份 | 开启定时备份 |
| 备份频率 | 每日/每周/每月 |
| 备份到邮箱 | 将备份文件发送到邮箱 |
| 备份到 R2 | 将备份文件存储到 R2 |
| 备份内容 | 订阅数据/系统设置 |

## 数据库表结构

| 表名 | 说明 |
|------|------|
| `users` | 用户表 |
| `subscriptions` | 订阅表 |
| `resend_config` | Resend 邮件配置 |
| `serverchan_config` | Server酱配置 |
| `exchangerate_config` | 汇率 API 配置 |
| `backup_config` | 备份配置 |
| `system_config` | 系统配置 |
| `rate_limits` | 频率限制记录 |

## 安全说明

### 频率限制

- **IP 级别限制**
  - 每分钟最多 10 次请求
  - 每小时最多 60 次请求
  - 每天最多 200 次请求

- **用户名级别限制**
  - 每 15 分钟最多 5 次失败尝试
  - 超过后账户临时锁定
  - 渐进式锁定：5分钟 → 10分钟 → 20分钟 → ... → 最长 24 小时

- **注册限制**
  - 每个 IP 每小时最多注册 3 个账户

### 两步验证 (2FA)

- 支持 TOTP 验证器（Google Authenticator、Microsoft Authenticator 等）
- 可在注册时启用或后续在设置中开启
- 支持备份和恢复 2FA 配置

## API 文档

### 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| GET | `/api/auth/me` | 获取当前用户信息 |
| PUT | `/api/auth/profile` | 更新个人信息 |

### 订阅接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/subscriptions` | 获取订阅列表 |
| POST | `/api/subscriptions` | 创建订阅 |
| GET | `/api/subscriptions/:id` | 获取订阅详情 |
| PUT | `/api/subscriptions/:id` | 更新订阅 |
| DELETE | `/api/subscriptions/:id` | 删除订阅 |
| DELETE | `/api/subscriptions/batch` | 批量删除 |
| PATCH | `/api/subscriptions/batch` | 批量更新 |

### 设置接口

| 方法 | 路径 | 说明 |
|------|------|------|
| PUT | `/api/settings` | 更新用户设置 |
| GET | `/api/system/config` | 获取系统配置 |
| PUT | `/api/system/config` | 更新系统配置 |

### 备份接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/backup/trigger` | 触发手动备份 |
| GET | `/api/backup/list` | 获取备份列表 |
| GET | `/api/backup/download` | 下载备份文件 |
| POST | `/api/settings/restore` | 恢复设置 |

### 2FA 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/2fa/setup` | 设置 2FA |
| POST | `/api/auth/2fa/enable` | 启用 2FA |
| POST | `/api/auth/2fa/disable` | 禁用 2FA |

## 常见问题

### Q: 第一个注册的用户是什么角色？
A: 第一个注册的用户自动成为管理员（admin），后续注册的用户为普通用户（user）。

### Q: 演示用户有什么限制？
A: 演示用户可以查看所有内容，但不能修改任何数据。

### Q: 如何重置 2FA？
A: 管理员可以在数据库中将用户的 `totp_enabled` 设为 0，`totp_secret` 设为 NULL。

### Q: 备份文件存储在哪里？
A: 备份文件可以发送到邮箱，也可以存储到 Cloudflare R2 存储桶。

## License

本项目采用 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 协议开源。

- ✅ 可以自由使用、修改、分享
- ✅ 需要署名原作者
- ❌ 不可用于商业用途
