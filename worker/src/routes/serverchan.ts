import { sendServerChanMessage } from '../services/serverchan';
import type { Env } from '../types/index';
import { errorResponse, successResponse, verifyToken } from '../utils';

// 测试 Server酱推送
export async function sendTestServerChan(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('未授权', 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return errorResponse('Token 无效或已过期', 401);
    }

    let serverchan_api_key = '';
    try {
      const body = (await request.json()) as { serverchan_api_key?: string };
      serverchan_api_key = body.serverchan_api_key || '';
    } catch {}

    if (!serverchan_api_key) {
      const url = new URL(request.url);
      serverchan_api_key = url.searchParams.get('serverchan_api_key') || '';
    }

    if (!serverchan_api_key) {
      const row = await env.DB.prepare(
        'SELECT serverchan_api_key FROM users WHERE id = ?',
      )
        .bind(payload.userId)
        .first<{ serverchan_api_key: string }>();
      serverchan_api_key = row?.serverchan_api_key || '';
    }

    if (!serverchan_api_key) {
      return errorResponse('请输入或先保存 Server酱 SendKey');
    }

    const result = await sendServerChanMessage(
      serverchan_api_key,
      'Subly 测试消息',
      '这是一条来自 Subly 的测试推送，恭喜您配置成功！\n\n- 发送时间：' +
        new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    );

    if (result.code === 0) {
      return successResponse(null, '测试推送已发送');
    } else {
      const msg =
        result.data?.error ||
        result.message ||
        '测试推送发送失败，请检查 SendKey 是否正确';
      return errorResponse(msg);
    }
  } catch (error) {
    console.error('SendTestServerChan error:', error);
    return errorResponse('测试推送失败', 500);
  }
}
