# Subly

轻量级订阅管理与提醒系统，帮助您轻松跟踪各类订阅服务的到期时间，并通过邮件发送及时提醒。

## 功能特性

- 用户认证（登录/注册）
- 订阅管理（添加、编辑、删除）
- 统计概览（总订阅、即将到期、一次性买断支出、月均支出）
- 多币种支持（CNY/HKD/USD/EUR/GBP）
- 搜索、筛选、排序
- 列表/卡片视图切换
- 深浅主题模式
- 邮件到期提醒（基于 Resend）
- 响应式设计

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Naive UI |
| 状态管理 | Pinia |
| 路由 | Vue Router |
| 构建 | Rsbuild |
| 后端 | Cloudflare Workers |
| 数据库 | Cloudflare D1 |
| 邮件 | Resend |

## 本地开发

```bash
# 安装依赖
pnpm install

# 启动前端开发服务器
pnpm dev

# 启动后端 Worker（另起终端）
pnpm worker:dev
```

前端运行在 http://localhost:3000，后端运行在 http://localhost:8787

## 部署到 Cloudflare

### 1. 创建 D1 数据库

```bash
pnpm db:create
```

### 2. 配置数据库 ID

将创建返回的 `database_id` 填入 `worker/wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "subly"
database_id = "你的数据库ID"
```

### 3. 初始化数据库

```bash
pnpm db:migrate
```

### 4. 构建并部署

```bash
pnpm build
pnpm worker:deploy
```

## 项目结构

```
subly/
├── src/                    # 前端源码
│   ├── api/                # API 封装
│   ├── assets/icons/       # SVG 图标
│   ├── components/         # 组件
│   ├── router/             # 路由配置
│   ├── stores/             # Pinia Store
│   ├── types/              # 类型定义
│   └── views/              # 页面视图
├── worker/                 # 后端 Worker
│   ├── src/                # Worker 源码
│   ├── schema.sql          # 数据库 Schema
│   └── wrangler.toml       # Workers 配置
├── public/                 # 静态资源
└── package.json
```

## 可用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动前端开发服务器 |
| `pnpm build` | 构建生产版本 |
| `pnpm worker:dev` | 本地运行 Worker |
| `pnpm worker:deploy` | 部署 Worker 到 Cloudflare |
| `pnpm db:create` | 创建 D1 数据库 |
| `pnpm db:migrate` | 执行数据库迁移 |

## 配置说明

在系统设置中可配置：

- **Resend API Key**：用于发送邮件通知（必填）
- **自定义域名**：Resend 发件域名（可选，留空使用 resend.dev）
- **ExchangeRate API Key**：用于货币汇率转换（可选）

## License

MIT
