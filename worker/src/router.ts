import {
	batchDeleteSubscriptions,
	batchUpdateRemindDays,
	createSubscription,
	deleteSubscription,
	exportSubscriptions,
	forceNotify,
	getExchangeRate,
	getMe,
	getNotifyStatus,
	getSubscription,
	getSubscriptions,
	importSubscriptions,
	login,
	register,
	resetLastSent,
	sendTestEmail,
	sendTestServerChan,
	updateProfile,
	updateSettings,
	updateSubscription,
	updateSubscriptionStatus,
} from "./routes";
import {
	checkAndSendEmailReminders,
	checkAndSendServerChanReminders,
} from "./services";
import type { Env } from "./types/index";
import { errorResponse, jsonResponse } from "./utils";

type RouteHandler = (request: Request, env: Env) => Promise<Response>;
type ParamRouteHandler = (
	request: Request,
	env: Env,
	id: string,
) => Promise<Response>;

interface Route {
	pattern: string;
	method: string;
	handler: RouteHandler;
}

interface ParamRoute {
	pattern: RegExp;
	method: string;
	handler: ParamRouteHandler;
}

const routes: Route[] = [
	// 认证路由
	{ pattern: "/auth/register", method: "POST", handler: register },
	{ pattern: "/auth/login", method: "POST", handler: login },
	{ pattern: "/auth/me", method: "GET", handler: getMe },
	{ pattern: "/auth/profile", method: "PUT", handler: updateProfile },
	{ pattern: "/auth/test-email", method: "POST", handler: sendTestEmail },
	{ pattern: "/email/test", method: "POST", handler: sendTestEmail },
	{
		pattern: "/auth/test-serverchan",
		method: "POST",
		handler: sendTestServerChan,
	},

	// 设置路由
	{ pattern: "/settings", method: "PUT", handler: updateSettings },

	// 订阅路由
	{ pattern: "/subscriptions", method: "GET", handler: getSubscriptions },
	{ pattern: "/subscriptions", method: "POST", handler: createSubscription },
	{
		pattern: "/subscriptions/export",
		method: "GET",
		handler: exportSubscriptions,
	},
	{
		pattern: "/subscriptions/import",
		method: "POST",
		handler: importSubscriptions,
	},
	{
		pattern: "/subscriptions/batch",
		method: "DELETE",
		handler: batchDeleteSubscriptions,
	},
	{
		pattern: "/subscriptions/batch",
		method: "PATCH",
		handler: batchUpdateRemindDays,
	},

	// 汇率路由
	{ pattern: "/exchange-rate", method: "GET", handler: getExchangeRate },

	// 调试路由
	{
		pattern: "/test-reminder",
		method: "POST",
		handler: async (_req, env) => {
			await checkAndSendEmailReminders(env);
			await checkAndSendServerChanReminders(env);
			return jsonResponse({ success: true, message: "提醒检查已触发" });
		},
	},
	{ pattern: "/debug/notify-status", method: "GET", handler: getNotifyStatus },
	{ pattern: "/debug/force-notify", method: "POST", handler: forceNotify },
	{ pattern: "/debug/reset-last-sent", method: "POST", handler: resetLastSent },
];

// 带参数的路由
const paramRoutes: ParamRoute[] = [
	{
		pattern: /^\/subscriptions\/(\d+)$/,
		method: "GET",
		handler: (req, env, id) => getSubscription(req, env, id),
	},
	{
		pattern: /^\/subscriptions\/(\d+)$/,
		method: "PUT",
		handler: (req, env, id) => updateSubscription(req, env, id),
	},
	{
		pattern: /^\/subscriptions\/(\d+)$/,
		method: "DELETE",
		handler: (req, env, id) => deleteSubscription(req, env, id),
	},
	{
		pattern: /^\/subscriptions\/(\d+)\/status$/,
		method: "PUT",
		handler: (req, env, id) => updateSubscriptionStatus(req, env, id),
	},
];

export async function handleApiRoute(
	request: Request,
	env: Env,
	apiPath: string,
): Promise<Response> {
	const method = request.method;

	// 匹配静态路由
	for (const route of routes) {
		if (route.pattern === apiPath && route.method === method) {
			return route.handler(request, env);
		}
	}

	// 匹配带参数的路由
	for (const route of paramRoutes) {
		if (route.method !== method) continue;
		const match = apiPath.match(route.pattern);
		if (match) {
			return route.handler(request, env, match[1]);
		}
	}

	return errorResponse("API 路由不存在", 404);
}
