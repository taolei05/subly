import type { Env } from './types';
import { corsHeaders, jsonResponse, errorResponse } from './utils';
import { register, login, getMe, updateSettings } from './routes/auth';
import {
    getSubscriptions,
    getSubscription,
    createSubscription,
    updateSubscription,
    deleteSubscription,
    updateSubscriptionStatus
} from './routes/subscriptions';
import { checkAndSendReminders } from './services/email';

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        // 处理 CORS 预检请求
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        // API 路由
        if (path.startsWith('/api/')) {
            const apiPath = path.slice(4); // 移除 /api 前缀

            // 认证路由
            if (apiPath === '/auth/register' && method === 'POST') {
                return register(request, env);
            }
            if (apiPath === '/auth/login' && method === 'POST') {
                return login(request, env);
            }
            if (apiPath === '/auth/me' && method === 'GET') {
                return getMe(request, env);
            }

            // 设置路由
            if (apiPath === '/settings' && method === 'PUT') {
                return updateSettings(request, env);
            }

            // 订阅路由
            if (apiPath === '/subscriptions' && method === 'GET') {
                return getSubscriptions(request, env);
            }
            if (apiPath === '/subscriptions' && method === 'POST') {
                return createSubscription(request, env);
            }

            // 带 ID 的订阅路由
            const subscriptionMatch = apiPath.match(/^\/subscriptions\/(\d+)$/);
            if (subscriptionMatch) {
                const id = subscriptionMatch[1];
                if (method === 'GET') return getSubscription(request, env, id);
                if (method === 'PUT') return updateSubscription(request, env, id);
                if (method === 'DELETE') return deleteSubscription(request, env, id);
            }

            // 订阅状态路由
            const statusMatch = apiPath.match(/^\/subscriptions\/(\d+)\/status$/);
            if (statusMatch && method === 'PUT') {
                return updateSubscriptionStatus(request, env, statusMatch[1]);
            }

            // 汇率 API
            if (apiPath === '/exchange-rate' && method === 'GET') {
                // 返回默认汇率（可选：调用外部 API）
                return jsonResponse({
                    success: true,
                    data: {
                        base: 'CNY',
                        rates: {
                            CNY: 1,
                            HKD: 1.09,
                            USD: 0.14,
                            EUR: 0.13,
                            GBP: 0.11
                        }
                    }
                });
            }

            // 测试邮件发送（手动触发提醒检查）
            if (apiPath === '/test-reminder' && method === 'POST') {
                await checkAndSendReminders(env);
                return jsonResponse({ success: true, message: '提醒邮件检查已触发' });
            }

            return errorResponse('API 路由不存在', 404);
        }

        // 静态文件服务 - 返回 index.html 用于 SPA 路由
        return env.ASSETS?.fetch(request) || new Response('Not Found', { status: 404 });
    },

    // 定时任务处理
    async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
        await checkAndSendReminders(env);
    }
};
