import { sendEmail } from '../services/email';
import type { Env } from '../types/index';
import { errorResponse, successResponse, verifyToken } from '../utils';

export async function sendTestEmail(
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

    const { resend_api_key, resend_domain } = (await request.json()) as {
      resend_api_key: string;
      resend_domain?: string;
    };

    // 检查是否是脱敏值
    const isMaskedValue = resend_api_key?.includes('***');

    let apiKeyToUse = resend_api_key;

    // 如果是脱敏值或为空，从数据库获取
    if (!resend_api_key || isMaskedValue) {
      const row = await env.DB.prepare(
        'SELECT resend_api_key FROM users WHERE id = ?',
      )
        .bind(payload.userId)
        .first<{ resend_api_key: string }>();
      apiKeyToUse = row?.resend_api_key || '';
    }

    if (!apiKeyToUse) {
      return errorResponse('请输入或先保存 Resend API Key');
    }

    // 获取用户邮箱
    const user = await env.DB.prepare('SELECT email FROM users WHERE id = ?')
      .bind(payload.userId)
      .first<{ email: string }>();
    if (!user) return errorResponse('用户不存在', 404);

    const success = await sendEmail(apiKeyToUse, resend_domain || '', {
      to: user.email,
      subject: 'Subly 邮件配置测试',
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h1>邮件配置测试成功</h1>
          <p>恭喜！这封邮件证明您的 Resend API Key 或域名配置正确。</p>
          <p>时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
        </div>
      `,
    });

    if (success) {
      return successResponse(null, '测试邮件已发送');
    } else {
      return errorResponse('发送失败，请检查配置');
    }
  } catch (error) {
    console.error('SendTestEmail error:', error);
    return errorResponse('发送测试邮件失败', 500);
  }
}
