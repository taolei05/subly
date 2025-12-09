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

    // 获取用户邮箱和站点链接
    const user = await env.DB.prepare(
      'SELECT email, site_url FROM users WHERE id = ?',
    )
      .bind(payload.userId)
      .first<{ email: string; site_url?: string }>();
    if (!user) return errorResponse('用户不存在', 404);

    // 生成查看详情按钮
    const viewDetailsButton = user.site_url
      ? `
        <div style="margin-top: 20px; text-align: center;">
          <a href="${user.site_url}" style="display: inline-block; background: #18a058; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 14px;">查看详情</a>
        </div>
      `
      : '';

    const success = await sendEmail(apiKeyToUse, resend_domain || '', {
      to: user.email,
      subject: '[Subly] 邮件配置测试',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>邮件配置测试</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #18a058; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Subly 邮件配置测试</h1>
          </div>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #333;">🎉 恭喜！邮件配置测试成功</p>
            <p style="color: #666;">这封邮件证明您的 Resend API Key 配置正确，订阅到期提醒将会发送到此邮箱。</p>
            <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; margin-top: 16px;">
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #eee; color: #999; width: 100px;">发送时间</td>
                <td style="padding: 12px; border-bottom: 1px solid #eee;">${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</td>
              </tr>
              <tr>
                <td style="padding: 12px; color: #999;">收件邮箱</td>
                <td style="padding: 12px;">${user.email}</td>
              </tr>
            </table>
            ${viewDetailsButton}
            <p style="margin-top: 20px; color: #666; font-size: 14px;">
              这是一封测试邮件，请勿直接回复。
            </p>
          </div>
        </body>
        </html>
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
