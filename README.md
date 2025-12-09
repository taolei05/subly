# Subly

轻量级订阅管理与提醒系统，帮助您轻松跟踪各类订阅服务的到期时间，并通过邮件或微信发送及时提醒。

## 功能特性

- 用户认证（登录/注册）
- 订阅管理（添加、编辑、删除、批量操作）
- 统计概览（总订阅、即将到期、一次性买断支出、月均支出）
- 多币种支持（CNY/HKD/USD/EUR/GBP）
- 实时汇率转换（ExchangeRate API）
- 搜索、筛选、排序（支持持久化）
- 列表/卡片视图切换
- 深浅主题模式
- 多渠道到期提醒
  - 邮件通知（Resend）
  - 微信通知（Server酱）
- 数据导入/导出（JSON/CSV）
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
| 微信推送 | Server酱 |

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

### 1. 初始化数据库

```bash
pnpm db:migrate
```

### 2. 构建并部署

```bash
pnpm build
pnpm worker:deploy
```

## 项目结构

```
subly/
├── frontend/               # 前端源码
│   ├── src/
│   │   ├── api/            # API 封装
│   │   ├── components/     # 组件
│   │   ├── constants/      # 常量定义
│   │   ├── router/         # 路由配置
│   │   ├── stores/         # Pinia Store
│   │   ├── types/          # 类型定义
│   │   ├── utils/          # 工具函数
│   │   └── views/          # 页面视图
│   └── public/             # 静态资源
├── worker/                 # 后端 Worker
│   ├── src/
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 业务服务
│   │   ├── types/          # 类型定义
│   │   └── utils/          # 工具函数
│   ├── migrations/         # 数据库迁移
│   └── schema.sql          # 数据库 Schema
└── wrangler.toml           # Workers 配置
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

- **Resend 邮件通知**
  - API Key：用于发送邮件通知
  - 自定义域名：发件域名（可选，留空使用 resend.dev）
  - 通知时间：每天发送提醒的时间
  - 通知间隔：发送提醒的频率

- **Server酱 微信通知**
  - SendKey：用于发送微信推送
  - 通知时间/间隔：同上

- **ExchangeRate 汇率**
  - API Key：用于实时货币汇率转换
  - 启用开关：关闭后使用默认汇率

- **站点链接**：通知邮件中的"查看详情"按钮跳转地址

## License

MIT
