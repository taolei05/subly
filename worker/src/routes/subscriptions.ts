import type { Env, Subscription } from '../types';
import { verifyToken, successResponse, errorResponse } from '../utils';

// 获取认证用户 ID
async function getUserId(request: Request): Promise<number | null> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);
    return payload?.userId || null;
}

// 获取所有订阅
export async function getSubscriptions(request: Request, env: Env): Promise<Response> {
    try {
        const userId = await getUserId(request);
        if (!userId) return errorResponse('未授权', 401);

        const { results } = await env.DB.prepare(
            'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY end_date ASC'
        ).bind(userId).all<Subscription>();

        // 转换布尔值
        const subscriptions = results.map((sub: Subscription) => ({
            ...sub,
            auto_renew: Boolean(sub.auto_renew),
            one_time: Boolean(sub.one_time)
        }));

        return successResponse(subscriptions);
    } catch (error) {
        console.error('GetSubscriptions error:', error);
        return errorResponse('获取订阅失败', 500);
    }
}

// 获取单个订阅
export async function getSubscription(request: Request, env: Env, id: string): Promise<Response> {
    try {
        const userId = await getUserId(request);
        if (!userId) return errorResponse('未授权', 401);

        const subscription = await env.DB.prepare(
            'SELECT * FROM subscriptions WHERE id = ? AND user_id = ?'
        ).bind(id, userId).first<Subscription>();

        if (!subscription) {
            return errorResponse('订阅不存在', 404);
        }

        return successResponse({
            ...subscription,
            auto_renew: Boolean(subscription.auto_renew),
            one_time: Boolean(subscription.one_time)
        });
    } catch (error) {
        console.error('GetSubscription error:', error);
        return errorResponse('获取订阅失败', 500);
    }
}

// 创建订阅
export async function createSubscription(request: Request, env: Env): Promise<Response> {
    try {
        const userId = await getUserId(request);
        if (!userId) return errorResponse('未授权', 401);

        const data = await request.json() as {
            name: string;
            type: string;
            type_detail?: string;
            price: number;
            currency: string;
            start_date: number;
            end_date: number;
            remind_days: number;
            auto_renew: boolean;
            one_time: boolean;
            notes?: string;
        };

        const startDate = new Date(data.start_date).toISOString().split('T')[0];
        const endDate = new Date(data.end_date).toISOString().split('T')[0];

        const result = await env.DB.prepare(`
      INSERT INTO subscriptions 
      (user_id, name, type, type_detail, price, currency, start_date, end_date, remind_days, auto_renew, one_time, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
            userId,
            data.name,
            data.type,
            data.type_detail || null,
            data.price,
            data.currency,
            startDate,
            endDate,
            data.remind_days,
            data.auto_renew ? 1 : 0,
            data.one_time ? 1 : 0,
            data.notes || null
        ).run();

        const newId = result.meta.last_row_id;
        const newSubscription = await env.DB.prepare(
            'SELECT * FROM subscriptions WHERE id = ?'
        ).bind(newId).first<Subscription>();

        if (!newSubscription) {
            return errorResponse('创建后获取订阅失败', 500);
        }

        return successResponse({
            ...newSubscription,
            auto_renew: Boolean(newSubscription.auto_renew),
            one_time: Boolean(newSubscription.one_time)
        }, '订阅创建成功');
    } catch (error) {
        console.error('CreateSubscription error:', error);
        return errorResponse('创建订阅失败', 500);
    }
}

// 更新订阅
export async function updateSubscription(request: Request, env: Env, id: string): Promise<Response> {
    try {
        const userId = await getUserId(request);
        if (!userId) return errorResponse('未授权', 401);

        // 检查订阅是否存在且属于当前用户
        const existing = await env.DB.prepare(
            'SELECT id FROM subscriptions WHERE id = ? AND user_id = ?'
        ).bind(id, userId).first();

        if (!existing) {
            return errorResponse('订阅不存在', 404);
        }

        const data = await request.json() as {
            name: string;
            type: string;
            type_detail?: string;
            price: number;
            currency: string;
            start_date: number;
            end_date: number;
            remind_days: number;
            auto_renew: boolean;
            one_time: boolean;
            notes?: string;
        };

        const startDate = new Date(data.start_date).toISOString().split('T')[0];
        const endDate = new Date(data.end_date).toISOString().split('T')[0];

        await env.DB.prepare(`
      UPDATE subscriptions SET
        name = ?, type = ?, type_detail = ?, price = ?, currency = ?,
        start_date = ?, end_date = ?, remind_days = ?, auto_renew = ?,
        one_time = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(
            data.name,
            data.type,
            data.type_detail || null,
            data.price,
            data.currency,
            startDate,
            endDate,
            data.remind_days,
            data.auto_renew ? 1 : 0,
            data.one_time ? 1 : 0,
            data.notes || null,
            id,
            userId
        ).run();

        const updatedSubscription = await env.DB.prepare(
            'SELECT * FROM subscriptions WHERE id = ?'
        ).bind(id).first<Subscription>();

        if (!updatedSubscription) {
            return errorResponse('更新后获取订阅失败', 500);
        }

        return successResponse({
            ...updatedSubscription,
            auto_renew: Boolean(updatedSubscription.auto_renew),
            one_time: Boolean(updatedSubscription.one_time)
        }, '订阅更新成功');
    } catch (error) {
        console.error('UpdateSubscription error:', error);
        return errorResponse('更新订阅失败', 500);
    }
}

// 删除订阅
export async function deleteSubscription(request: Request, env: Env, id: string): Promise<Response> {
    try {
        const userId = await getUserId(request);
        if (!userId) return errorResponse('未授权', 401);

        const result = await env.DB.prepare(
            'DELETE FROM subscriptions WHERE id = ? AND user_id = ?'
        ).bind(id, userId).run();

        if (result.meta.changes === 0) {
            return errorResponse('订阅不存在', 404);
        }

        return successResponse(null, '订阅删除成功');
    } catch (error) {
        console.error('DeleteSubscription error:', error);
        return errorResponse('删除订阅失败', 500);
    }
}

// 更新订阅状态
export async function updateSubscriptionStatus(request: Request, env: Env, id: string): Promise<Response> {
    try {
        const userId = await getUserId(request);
        if (!userId) return errorResponse('未授权', 401);

        const { status } = await request.json() as { status: string };

        await env.DB.prepare(
            'UPDATE subscriptions SET status = ?, updated_at = datetime(\'now\') WHERE id = ? AND user_id = ?'
        ).bind(status, id, userId).run();

        return successResponse(null, '状态更新成功');
    } catch (error) {
        console.error('UpdateSubscriptionStatus error:', error);
        return errorResponse('更新状态失败', 500);
    }
}
