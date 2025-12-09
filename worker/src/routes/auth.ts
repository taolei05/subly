import type {
  Env,
  UpdateSettingsRequest,
  User,
  UserPublic,
} from '../types/index';
import {
  errorResponse,
  generateToken,
  hashPassword,
  isValidSiteUrl,
  successResponse,
  verifyPassword,
  verifyToken,
} from '../utils';

export { sendTestEmail } from './email';
// 重新导出测试功能
export { sendTestServerChan } from './serverchan';

// ==================== 用户认证 ====================

/**
 * 用户注册
 */
export async function register(request: Request, env: Env): Promise<Response> {
  try {
    const { username, password, email } = (await request.json()) as {
      username: string;
      password: string;
      email?: string;
    };

    if (!username || !password) {
      return errorResponse('用户名和密码都是必填项');
    }

    if (username.length < 3) {
      return errorResponse('用户名至少3个字符');
    }

    if (password.length < 6) {
      return errorResponse('密码至少6个字符');
    }

    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ?',
    )
      .bind(username)
      .first();

    if (existing) {
      return errorResponse('用户名已存在');
    }

    const hashedPassword = await hashPassword(password);
    await env.DB.prepare(
      'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
    )
      .bind(username, hashedPassword, email ?? '')
      .run();

    return successResponse(null, '注册成功');
  } catch (error) {
    console.error('Register error:', error);
    return errorResponse('注册失败，请重试', 500);
  }
}

/**
 * 用户登录
 */
export async function login(request: Request, env: Env): Promise<Response> {
  try {
    const { username, password } = (await request.json()) as {
      username: string;
      password: string;
    };

    if (!username || !password) {
      return errorResponse('请输入用户名和密码');
    }

    const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?')
      .bind(username)
      .first<User>();

    if (!user) {
      return errorResponse('用户名或密码错误');
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return errorResponse('用户名或密码错误');
    }

    const token = await generateToken(user.id, user.username);

    return successResponse({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        resend_api_key: user.resend_api_key,
        exchangerate_api_key: user.exchangerate_api_key,
        resend_domain: user.resend_domain,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse('登录失败，请重试', 500);
  }
}

/**
 * 获取当前用户信息
 */
export async function getMe(request: Request, env: Env): Promise<Response> {
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

    const user = await env.DB.prepare(
      `SELECT id, username, email, 
              resend_api_key, resend_domain, resend_enabled, resend_notify_time, resend_notify_interval,
              serverchan_api_key, serverchan_enabled, serverchan_notify_time, serverchan_notify_interval,
              exchangerate_api_key, site_url 
       FROM users WHERE id = ?`,
    )
      .bind(payload.userId)
      .first<UserPublic>();

    if (!user) {
      return errorResponse('用户不存在', 404);
    }

    return successResponse(user);
  } catch (error) {
    console.error('GetMe error:', error);
    return errorResponse('获取用户信息失败', 500);
  }
}

// ==================== 用户设置 ====================

/**
 * 更新用户设置（包含所有 API 配置）
 */
export async function updateSettings(
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

    const settings = (await request.json()) as UpdateSettingsRequest;

    // 获取当前设置
    const currentSettings = await env.DB.prepare(
      `SELECT email, resend_api_key, resend_domain, resend_enabled, resend_notify_time, resend_notify_interval,
              serverchan_api_key, serverchan_enabled, serverchan_notify_time, serverchan_notify_interval,
              exchangerate_api_key, site_url 
       FROM users WHERE id = ?`,
    )
      .bind(payload.userId)
      .first<User>();

    // 验证站点 URL
    if (
      settings.site_url !== undefined &&
      settings.site_url !== '' &&
      !isValidSiteUrl(settings.site_url)
    ) {
      return errorResponse('站点链接格式无效，必须以 http:// 或 https:// 开头');
    }

    // 合并设置
    const newSettings = {
      email: settings.email ?? currentSettings?.email ?? '',
      // Resend 配置
      resend_api_key:
        settings.resend_api_key ?? currentSettings?.resend_api_key ?? '',
      resend_domain:
        settings.resend_domain ?? currentSettings?.resend_domain ?? '',
      resend_enabled:
        settings.resend_enabled !== undefined
          ? settings.resend_enabled
            ? 1
            : 0
          : (currentSettings?.resend_enabled ?? 1),
      resend_notify_time:
        settings.resend_notify_time ?? currentSettings?.resend_notify_time ?? 8,
      resend_notify_interval:
        settings.resend_notify_interval ??
        currentSettings?.resend_notify_interval ??
        24,
      // Server酱配置
      serverchan_api_key:
        settings.serverchan_api_key ??
        currentSettings?.serverchan_api_key ??
        '',
      serverchan_enabled:
        settings.serverchan_enabled !== undefined
          ? settings.serverchan_enabled
            ? 1
            : 0
          : (currentSettings?.serverchan_enabled ?? 1),
      serverchan_notify_time:
        settings.serverchan_notify_time ??
        currentSettings?.serverchan_notify_time ??
        8,
      serverchan_notify_interval:
        settings.serverchan_notify_interval ??
        currentSettings?.serverchan_notify_interval ??
        24,
      // ExchangeRate 配置
      exchangerate_api_key:
        settings.exchangerate_api_key ??
        currentSettings?.exchangerate_api_key ??
        '',
      // 其他
      site_url: settings.site_url ?? currentSettings?.site_url ?? '',
    };

    await env.DB.prepare(
      `UPDATE users SET 
        email = ?, 
        resend_api_key = ?, resend_domain = ?, resend_enabled = ?, resend_notify_time = ?, resend_notify_interval = ?,
        serverchan_api_key = ?, serverchan_enabled = ?, serverchan_notify_time = ?, serverchan_notify_interval = ?,
        exchangerate_api_key = ?, site_url = ?
       WHERE id = ?`,
    )
      .bind(
        newSettings.email,
        newSettings.resend_api_key,
        newSettings.resend_domain,
        newSettings.resend_enabled,
        newSettings.resend_notify_time,
        newSettings.resend_notify_interval,
        newSettings.serverchan_api_key,
        newSettings.serverchan_enabled,
        newSettings.serverchan_notify_time,
        newSettings.serverchan_notify_interval,
        newSettings.exchangerate_api_key,
        newSettings.site_url,
        payload.userId,
      )
      .run();

    const user = await env.DB.prepare(
      `SELECT id, username, email, 
              resend_api_key, resend_domain, resend_enabled, resend_notify_time, resend_notify_interval,
              serverchan_api_key, serverchan_enabled, serverchan_notify_time, serverchan_notify_interval,
              exchangerate_api_key, site_url 
       FROM users WHERE id = ?`,
    )
      .bind(payload.userId)
      .first<UserPublic>();

    return successResponse(user, '设置已更新');
  } catch (error) {
    console.error('UpdateSettings error:', error);
    return errorResponse('更新设置失败', 500);
  }
}

/**
 * 更新用户个人信息（用户名、邮箱、密码）
 */
export async function updateProfile(
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

    const { username, email, password } = (await request.json()) as {
      username?: string;
      email?: string;
      password?: string;
    };

    if (!username || !email) {
      return errorResponse('用户名和邮箱不能为空');
    }

    if (username.length < 3) {
      return errorResponse('用户名至少3个字符');
    }

    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ? AND id != ?',
    )
      .bind(username, payload.userId)
      .first();

    if (existing) {
      return errorResponse('用户名已存在');
    }

    let query = 'UPDATE users SET username = ?, email = ?';
    const params: (string | number)[] = [username, email];

    if (password && password.length >= 6) {
      const hashedPassword = await hashPassword(password);
      query += ', password = ?';
      params.push(hashedPassword);
    } else if (password && password.length < 6) {
      return errorResponse('密码至少6个字符');
    }

    query += ' WHERE id = ?';
    params.push(payload.userId);

    await env.DB.prepare(query)
      .bind(...params)
      .run();

    const user = await env.DB.prepare(
      `SELECT id, username, email, 
              resend_api_key, resend_domain, resend_enabled, resend_notify_time, resend_notify_interval,
              serverchan_api_key, serverchan_enabled, serverchan_notify_time, serverchan_notify_interval,
              exchangerate_api_key, site_url 
       FROM users WHERE id = ?`,
    )
      .bind(payload.userId)
      .first<UserPublic>();

    return successResponse(user, '个人信息已更新');
  } catch (error) {
    console.error('UpdateProfile error:', error);
    return errorResponse('更新个人信息失败', 500);
  }
}
