import type { Env, User } from '../types';
import {
  errorResponse,
  generateToken,
  hashPassword,
  isValidSiteUrl,
  successResponse,
  verifyPassword,
  verifyToken,
} from '../utils';

// 用户注册
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

    // 检查用户名是否已存在
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ?',
    )
      .bind(username)
      .first();

    if (existing) {
      return errorResponse('用户名已存在');
    }

    // 创建用户
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

// 用户登录
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

import { sendServerChanMessage } from '../services/serverchan';

// 获取当前用户信息
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
      'SELECT id, username, email, resend_api_key, exchangerate_api_key, resend_domain, resend_notify_time, resend_notify_interval, serverchan_api_key, serverchan_notify_time, serverchan_notify_interval, site_url, resend_enabled, serverchan_enabled FROM users WHERE id = ?',
    )
      .bind(payload.userId)
      .first<Omit<User, 'password'>>();

    if (!user) {
      return errorResponse('用户不存在', 404);
    }

    return successResponse(user);
  } catch (error) {
    console.error('GetMe error:', error);
    return errorResponse('获取用户信息失败', 500);
  }
}

// 更新用户设置
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

    const {
      resend_api_key,
      exchangerate_api_key,
      resend_domain,
      email,
      resend_notify_time,
      resend_notify_interval,
      serverchan_api_key,
      serverchan_notify_time,
      serverchan_notify_interval,
      site_url,
      resend_enabled,
      serverchan_enabled,
    } = (await request.json()) as {
      resend_api_key?: string;
      exchangerate_api_key?: string;
      resend_domain?: string;
      email?: string;
      resend_notify_time?: number;
      resend_notify_interval?: number;
      serverchan_api_key?: string;
      serverchan_notify_time?: number;
      serverchan_notify_interval?: number;
      site_url?: string;
      resend_enabled?: boolean;
      serverchan_enabled?: boolean;
    };

    const currentSettings = await env.DB.prepare(
      'SELECT email, resend_api_key, exchangerate_api_key, resend_domain, resend_notify_time, resend_notify_interval, serverchan_api_key, serverchan_notify_time, serverchan_notify_interval, site_url, resend_enabled, serverchan_enabled FROM users WHERE id = ?',
    )
      .bind(payload.userId)
      .first<User>();

    // Validate site_url if provided
    if (
      site_url !== undefined &&
      site_url !== '' &&
      !isValidSiteUrl(site_url)
    ) {
      return errorResponse('站点链接格式无效，必须以 http:// 或 https:// 开头');
    }

    const newResendNotifyTime =
      resend_notify_time !== undefined
        ? resend_notify_time
        : (currentSettings?.resend_notify_time ?? 8);

    const newResendNotifyInterval =
      resend_notify_interval !== undefined
        ? resend_notify_interval
        : (currentSettings?.resend_notify_interval ?? 24);

    const newServerChanNotifyTime =
      serverchan_notify_time !== undefined
        ? serverchan_notify_time
        : (currentSettings?.serverchan_notify_time ?? 8);

    const newServerChanNotifyInterval =
      serverchan_notify_interval !== undefined
        ? serverchan_notify_interval
        : (currentSettings?.serverchan_notify_interval ?? 24);

    const newSiteUrl =
      site_url !== undefined ? site_url : currentSettings?.site_url || '';

    const newResendEnabled =
      resend_enabled !== undefined
        ? resend_enabled
          ? 1
          : 0
        : (currentSettings?.resend_enabled ?? 1);
    const newServerChanEnabled =
      serverchan_enabled !== undefined
        ? serverchan_enabled
          ? 1
          : 0
        : (currentSettings?.serverchan_enabled ?? 1);

    await env.DB.prepare(
      'UPDATE users SET email = ?, resend_api_key = ?, exchangerate_api_key = ?, resend_domain = ?, resend_notify_time = ?, resend_notify_interval = ?, serverchan_api_key = ?, serverchan_notify_time = ?, serverchan_notify_interval = ?, site_url = ?, resend_enabled = ?, serverchan_enabled = ? WHERE id = ?',
    )
      .bind(
        email !== undefined ? email : currentSettings?.email || '',
        resend_api_key !== undefined
          ? resend_api_key
          : currentSettings?.resend_api_key || '',
        exchangerate_api_key !== undefined
          ? exchangerate_api_key
          : currentSettings?.exchangerate_api_key || '',
        resend_domain !== undefined
          ? resend_domain
          : currentSettings?.resend_domain || '',
        newResendNotifyTime,
        newResendNotifyInterval,
        serverchan_api_key !== undefined
          ? serverchan_api_key
          : currentSettings?.serverchan_api_key || '',
        newServerChanNotifyTime,
        newServerChanNotifyInterval,
        newSiteUrl,
        newResendEnabled,
        newServerChanEnabled,
        payload.userId,
      )
      .run();

    const user = await env.DB.prepare(
      'SELECT id, username, email, resend_api_key, exchangerate_api_key, resend_domain, resend_notify_time, resend_notify_interval, serverchan_api_key, serverchan_notify_time, serverchan_notify_interval, site_url, resend_enabled, serverchan_enabled FROM users WHERE id = ?',
    )
      .bind(payload.userId)
      .first<Omit<User, 'password'>>();

    return successResponse(user, '设置已更新');
  } catch (error) {
    console.error('UpdateSettings error:', error);
    return errorResponse('更新设置失败', 500);
  }
}

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

// 更新用户个人信息
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
    const params: any[] = [username, email];

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
      'SELECT id, username, email, resend_api_key, exchangerate_api_key, resend_domain, resend_notify_time, resend_notify_interval, serverchan_api_key, serverchan_notify_time, serverchan_notify_interval, site_url, resend_enabled, serverchan_enabled FROM users WHERE id = ?',
    )
      .bind(payload.userId)
      .first<Omit<User, 'password'>>();

    return successResponse(user, '个人信息已更新');
  } catch (error) {
    console.error('UpdateProfile error:', error);
    return errorResponse('更新个人信息失败', 500);
  }
}
