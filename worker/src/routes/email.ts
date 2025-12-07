import { sendEmail } from '../services/email';
import type { Env } from '../types';
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

    if (!resend_api_key) {
      return errorResponse('请输入 Resend API Key');
    }

    const success = await sendEmail(resend_api_key, resend_domain || '', {
      to: 'test@example.com', // 这里应该从 Payload 获取用户邮箱，或者允许前端传递
      subject: 'Subly 邮件配置测试',
      html: `
                    <div style="font-family: sans-serif; padding: 20px;">
                        <h1>邮件配置测试成功</h1>
                        <p>恭喜！这封邮件证明您的 Resend API Key 或域名配置正确。</p>
                        <p>时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
                    </div>
                `,
    });

    // 注意：sendEmail 的第一个参数是 api key，第二个是 domain，第三个是 EmailData
    // 但是 sendEmail 内部实现其实可能需要调整以支持这种调用，或者我们需要获取用户的 email
    // 修正：我们需要获取当前用户的 email 来作为收件人。

    // 重新查询用户 Email
    const user = await env.DB.prepare('SELECT email FROM users WHERE id = ?')
      .bind(payload.userId)
      .first<{ email: string }>();
    if (!user) return errorResponse('用户不存在', 404);

    // 重新调用 sendEmail
    const realSuccess = await sendEmail(resend_api_key, resend_domain || '', {
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

    if (realSuccess) {
      return successResponse(null, '测试邮件已发送');
    } else {
      return errorResponse('发送失败，请检查配置');
    }
  } catch (error) {
    console.error('SendTestEmail error:', error);
    return errorResponse('发送测试邮件失败', 500);
  }
}
