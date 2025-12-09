import {
  batchDeleteSubscriptions,
  batchUpdateRemindDays,
  createSubscription,
  deleteSubscription,
  exportSubscriptions,
  forceNotify,
  // 汇率
  getExchangeRate,
  getMe,
  // 调试
  getNotifyStatus,
  getSubscription,
  // 订阅
  getSubscriptions,
  importSubscriptions,
  login,
  // 认证
  register,
  resetLastSent,
  sendTestEmail,
  sendTestServerChan,
  updateProfile,
  updateSettings,
  updateSubscription,
  updateSubscriptionStatus,
} from './routes';
import {
  checkAndSendEmailReminders,
  checkAndSendServerChanReminders,
} from './services';
import type { Env } from './types/index';
import { corsHeaders, errorResponse, jsonResponse } from './utils';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // 处理 CORS 预检请求
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // API 路由
      if (path.startsWith('/api/')) {
        const apiPath = path.slice(4);

        // ==================== 认证路由 ====================
        if (apiPath === '/auth/register' && method === 'POST') {
          return await register(request, env);
        }
        if (apiPath === '/auth/login' && method === 'POST') {
          return await login(request, env);
        }
        if (apiPath === '/auth/me' && method === 'GET') {
          return await getMe(request, env);
        }
        if (apiPath === '/auth/profile' && method === 'PUT') {
          return await updateProfile(request, env);
        }
        if (apiPath === '/auth/test-email' && method === 'POST') {
          return await sendTestEmail(request, env);
        }
        if (apiPath === '/auth/test-serverchan' && method === 'POST') {
          return await sendTestServerChan(request, env);
        }

        // ==================== 设置路由 ====================
        if (apiPath === '/settings' && method === 'PUT') {
          return await updateSettings(request, env);
        }

        // ==================== 订阅路由 ====================
        if (apiPath === '/subscriptions' && method === 'GET') {
          return await getSubscriptions(request, env);
        }
        if (apiPath === '/subscriptions' && method === 'POST') {
          return await createSubscription(request, env);
        }
        if (apiPath === '/subscriptions/export' && method === 'GET') {
          return await exportSubscriptions(request, env);
        }
        if (apiPath === '/subscriptions/import' && method === 'POST') {
          return await importSubscriptions(request, env);
        }
        if (apiPath === '/subscriptions/batch' && method === 'DELETE') {
          return await batchDeleteSubscriptions(request, env);
        }
        if (apiPath === '/subscriptions/batch' && method === 'PATCH') {
          return await batchUpdateRemindDays(request, env);
        }

        // 带 ID 的订阅路由
        const subscriptionMatch = apiPath.match(/^\/subscriptions\/(\d+)$/);
        if (subscriptionMatch) {
          const id = subscriptionMatch[1];
          if (method === 'GET') return await getSubscription(request, env, id);
          if (method === 'PUT')
            return await updateSubscription(request, env, id);
          if (method === 'DELETE')
            return await deleteSubscription(request, env, id);
        }

        // 订阅状态路由
        const statusMatch = apiPath.match(/^\/subscriptions\/(\d+)\/status$/);
        if (statusMatch && method === 'PUT') {
          return await updateSubscriptionStatus(request, env, statusMatch[1]);
        }

        // ==================== 汇率路由 ====================
        if (apiPath === '/exchange-rate' && method === 'GET') {
          return await getExchangeRate(request, env);
        }

        // ==================== 调试路由 ====================
        if (apiPath === '/test-reminder' && method === 'POST') {
          await checkAndSendEmailReminders(env);
          await checkAndSendServerChanReminders(env);
          return jsonResponse({ success: true, message: '提醒检查已触发' });
        }
        if (apiPath === '/debug/notify-status' && method === 'GET') {
          return await getNotifyStatus(request, env);
        }
        if (apiPath === '/debug/force-notify' && method === 'POST') {
          return await forceNotify(request, env);
        }
        if (apiPath === '/debug/reset-last-sent' && method === 'POST') {
          return await resetLastSent(request, env);
        }

        return errorResponse('API 路由不存在', 404);
      }

      // 静态文件服务
      let response = await env.ASSETS?.fetch(request);

      // SPA 路由回退
      if ((!response || response.status === 404) && request.method === 'GET') {
        response = await env.ASSETS?.fetch(new URL('/', request.url));
      }

      return response || new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Worker global error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },

  // 定时任务处理
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await checkAndSendEmailReminders(env);
    await checkAndSendServerChanReminders(env);
  },
};
