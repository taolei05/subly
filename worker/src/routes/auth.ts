import type { Env, User } from './types';
import { hashPassword, verifyPassword, generateToken, verifyToken, successResponse, errorResponse } from './utils';

// 用户注册
export async function register(request: Request, env: Env): Promise<Response> {
    try {
        const { username, password, email } = await request.json() as {
            username: string;
            password: string;
            email: string;
        };

        if (!username || !password || !email) {
            return errorResponse('用户名、密码和邮箱都是必填项');
        }

        if (username.length < 3) {
            return errorResponse('用户名至少3个字符');
        }

        if (password.length < 6) {
            return errorResponse('密码至少6个字符');
        }

        // 检查用户名是否已存在
        const existing = await env.DB.prepare(
            'SELECT id FROM users WHERE username = ?'
        ).bind(username).first();

        if (existing) {
            return errorResponse('用户名已存在');
        }

        // 创建用户
        const hashedPassword = await hashPassword(password);
        await env.DB.prepare(
            'INSERT INTO users (username, password, email) VALUES (?, ?, ?)'
        ).bind(username, hashedPassword, email).run();

        return successResponse(null, '注册成功');
    } catch (error) {
        console.error('Register error:', error);
        return errorResponse('注册失败，请重试', 500);
    }
}

// 用户登录
export async function login(request: Request, env: Env): Promise<Response> {
    try {
        const { username, password } = await request.json() as {
            username: string;
            password: string;
        };

        if (!username || !password) {
            return errorResponse('请输入用户名和密码');
        }

        const user = await env.DB.prepare(
            'SELECT * FROM users WHERE username = ?'
        ).bind(username).first<User>();

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
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return errorResponse('登录失败，请重试', 500);
    }
}

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
            'SELECT id, username, email, resend_api_key, exchangerate_api_key, resend_domain, created_at FROM users WHERE id = ?'
        ).bind(payload.userId).first<Omit<User, 'password'>>();

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
export async function updateSettings(request: Request, env: Env): Promise<Response> {
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

        const { resend_api_key, exchangerate_api_key, resend_domain } = await request.json() as {
            resend_api_key?: string;
            exchangerate_api_key?: string;
            resend_domain?: string;
        };

        await env.DB.prepare(
            'UPDATE users SET resend_api_key = ?, exchangerate_api_key = ?, resend_domain = ? WHERE id = ?'
        ).bind(resend_api_key || '', exchangerate_api_key || '', resend_domain || '', payload.userId).run();

        const user = await env.DB.prepare(
            'SELECT id, username, email, resend_api_key, exchangerate_api_key, resend_domain, created_at FROM users WHERE id = ?'
        ).bind(payload.userId).first<Omit<User, 'password'>>();

        return successResponse(user, '设置已更新');
    } catch (error) {
        console.error('UpdateSettings error:', error);
        return errorResponse('更新设置失败', 500);
    }
}
