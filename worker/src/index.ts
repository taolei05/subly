import { handleApiRoute } from "./router";
import {
	checkAndRunBackups,
	checkAndSendEmailReminders,
	checkAndSendServerChanReminders,
} from "./services";
import type { Env } from "./types/index";
import { corsHeaders, logger, setJwtSecret } from "./utils";

// 开发环境默认密钥（仅用于本地开发，生产环境必须设置 JWT_SECRET）
const DEV_JWT_SECRET = "subly-dev-secret-key-do-not-use-in-production!!";

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		try {
			// 初始化 JWT Secret
			// ⚠️ 生产环境请务必通过 wrangler secret put JWT_SECRET 设置安全密钥
			const jwtSecret = env.JWT_SECRET || DEV_JWT_SECRET;
			if (!env.JWT_SECRET && env.ENVIRONMENT === "production") {
				logger.warn(
					"JWT_SECRET not set in production! Using insecure default key.",
				);
			}
			setJwtSecret(jwtSecret);

			// 处理 CORS 预检请求
			if (request.method === "OPTIONS") {
				return new Response(null, { headers: corsHeaders });
			}

			const url = new URL(request.url);
			const path = url.pathname;

			// API 路由
			if (path.startsWith("/api/")) {
				const apiPath = path.slice(4);
				return await handleApiRoute(request, env, apiPath);
			}

			// 静态文件服务
			let response = await env.ASSETS?.fetch(request);

			// SPA 路由回退
			if ((!response || response.status === 404) && request.method === "GET") {
				response = await env.ASSETS?.fetch(new URL("/", request.url));
			}

			return response || new Response("Not Found", { status: 404 });
		} catch (error) {
			logger.error("Worker global error", error);
			return new Response("Internal Server Error", { status: 500 });
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
		await checkAndRunBackups(env);
	},
};
