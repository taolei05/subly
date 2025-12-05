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
                // 默认汇率（备用）
                const defaultRates = { CNY: 1, HKD: 1.09, USD: 0.14, EUR: 0.13, GBP: 0.11 };

                // 尝试从用户设置获取 API Key
                const authHeader = request.headers.get('Authorization');
                if (authHeader?.startsWith('Bearer ')) {
                    try {
                        const token = authHeader.slice(7);
                        const payload = await import('./utils').then(m => m.verifyToken(token));
                        if (payload) {
                            const user = await env.DB.prepare(
                                'SELECT exchangerate_api_key FROM users WHERE id = ?'
                            ).bind(payload.userId).first<{ exchangerate_api_key: string }>();

                            if (user?.exchangerate_api_key) {
                                // 调用 ExchangeRate API
                                const apiUrl = `https://v6.exchangerate-api.com/v6/${user.exchangerate_api_key}/latest/CNY`;
                                const response = await fetch(apiUrl);
                                const data = await response.json() as {
                                    result: string;
                                    conversion_rates: Record<string, number>;
                                };

                                if (data.result === 'success') {
                                    return jsonResponse({
                                        success: true,
                                        source: 'exchangerate-api',
                                        data: {
                                            base: 'CNY',
                                            rates: {
                                                CNY: 1,
                                                HKD: data.conversion_rates.HKD || defaultRates.HKD,
                                                USD: data.conversion_rates.USD || defaultRates.USD,
                                                EUR: data.conversion_rates.EUR || defaultRates.EUR,
                                                GBP: data.conversion_rates.GBP || defaultRates.GBP
                                            }
                                        }
                                    });
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Exchange rate API error:', e);
                    }
                }

                // 返回默认汇率
                return jsonResponse({
                    success: true,
                    source: 'default',
                    data: { base: 'CNY', rates: defaultRates }
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
