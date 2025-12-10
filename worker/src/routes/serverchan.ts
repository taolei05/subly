import { sendServerChanMessage } from "../services/serverchan";
import type { Env } from "../types/index";
import { errorResponse, logger, successResponse, verifyToken } from "../utils";

export async function sendTestServerChan(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const authHeader = request.headers.get("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return errorResponse("未授权", 401);
		}

		const token = authHeader.slice(7);
		const payload = await verifyToken(token);
		if (!payload) {
			return errorResponse("Token 无效或已过期", 401);
		}

		let serverchan_api_key = "";
		try {
			const body = (await request.json()) as { serverchan_api_key?: string };
			serverchan_api_key = body.serverchan_api_key || "";
		} catch {}

		if (!serverchan_api_key) {
			const url = new URL(request.url);
			serverchan_api_key = url.searchParams.get("serverchan_api_key") || "";
		}

		if (!serverchan_api_key) {
			const row = await env.DB.prepare(
				"SELECT api_key FROM serverchan_config WHERE user_id = ?",
			)
				.bind(payload.userId)
				.first<{ api_key: string }>();
			serverchan_api_key = row?.api_key || "";
		}

		if (!serverchan_api_key) {
			return errorResponse("请输入或先保存 Server酱 SendKey");
		}

		// 获取站点链接
		const config = await env.DB.prepare(
			"SELECT site_url FROM users WHERE id = ?",
		)
			.bind(payload.userId)
			.first<{ site_url?: string }>();

		const content = `
## 🎉 配置测试成功

这条消息证明您的 Server酱 SendKey 配置正确，订阅到期提醒将会推送到此。
${config?.site_url ? `\n[👉 查看详情](${config.site_url})` : ""}

---

*这是一条测试消息，请勿直接回复。*
`.trim();

		const result = await sendServerChanMessage(
			serverchan_api_key,
			"[Subly] 微信通知配置测试",
			content,
		);

		if (result.code === 0) {
			logger.info("Test ServerChan sent", { userId: payload.userId });
			return successResponse(null, "测试推送已发送");
		} else {
			const msg =
				result.data?.error ||
				result.message ||
				"测试推送发送失败，请检查 SendKey 是否正确";
			return errorResponse(msg);
		}
	} catch (error) {
		logger.error("SendTestServerChan error", error);
		return errorResponse("测试推送失败", 500);
	}
}
