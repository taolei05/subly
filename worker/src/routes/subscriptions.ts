import type { Env, Subscription, SubscriptionRequest } from "../types/index";
import {
	errorResponse,
	logger,
	successResponse,
	validateRequest,
	verifyToken,
} from "../utils";

// ==================== 验证 Schema ====================
const subscriptionSchema = {
	name: {
		required: true,
		type: "string" as const,
		minLength: 1,
		maxLength: 100,
	},
	type: {
		required: true,
		type: "string" as const,
		enum: ["domain", "server", "membership", "software", "other"] as const,
	},
	price: { required: true, type: "number" as const, min: 0 },
	currency: {
		required: true,
		type: "string" as const,
		enum: ["CNY", "HKD", "USD", "EUR", "GBP"] as const,
	},
	start_date: { required: true, type: "string" as const },
	end_date: { required: true, type: "string" as const },
	remind_days: { type: "number" as const, min: 0, max: 365 },
};

// ==================== 辅助函数 ====================

/**
 * 获取认证用户 ID
 */
async function getUserId(request: Request): Promise<number | null> {
	// 先尝试从 Authorization header 获取
	const authHeader = request.headers.get("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		const token = authHeader.slice(7);
		const payload = await verifyToken(token);
		if (payload?.userId) return payload.userId;
	}

	// 再尝试从 URL 参数获取（用于导出等场景）
	const url = new URL(request.url);
	const tokenParam = url.searchParams.get("token");
	if (tokenParam) {
		const payload = await verifyToken(tokenParam);
		if (payload?.userId) return payload.userId;
	}

	return null;
}

/**
 * 转换订阅数据（布尔值处理）
 */
function transformSubscription(sub: Subscription): Subscription {
	return {
		...sub,
		one_time: Boolean(sub.one_time),
	};
}

// ==================== 订阅 CRUD ====================

/**
 * 获取所有订阅
 */
export async function getSubscriptions(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const userId = await getUserId(request);
		if (!userId) return errorResponse("未授权", 401);

		const { results } = await env.DB.prepare(
			"SELECT * FROM subscriptions WHERE user_id = ? ORDER BY end_date ASC",
		)
			.bind(userId)
			.all<Subscription>();

		const subscriptions = results.map(transformSubscription);
		return successResponse(subscriptions);
	} catch (error) {
		logger.error("GetSubscriptions error", error);
		return errorResponse("获取订阅失败", 500);
	}
}

/**
 * 获取单个订阅
 */
export async function getSubscription(
	request: Request,
	env: Env,
	id: string,
): Promise<Response> {
	try {
		const userId = await getUserId(request);
		if (!userId) return errorResponse("未授权", 401);

		const subscription = await env.DB.prepare(
			"SELECT * FROM subscriptions WHERE id = ? AND user_id = ?",
		)
			.bind(id, userId)
			.first<Subscription>();

		if (!subscription) {
			return errorResponse("订阅不存在", 404);
		}

		return successResponse(transformSubscription(subscription));
	} catch (error) {
		logger.error("GetSubscription error", error);
		return errorResponse("获取订阅失败", 500);
	}
}

/**
 * 创建订阅
 */
export async function createSubscription(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const userId = await getUserId(request);
		if (!userId) return errorResponse("未授权", 401);

		const body = await request.json();
		const validation = validateRequest<SubscriptionRequest>(
			body,
			subscriptionSchema,
		);

		if (!validation.valid) {
			return errorResponse(validation.error);
		}

		const data = validation.data;
		const renewType = data.renew_type || "none";

		const result = await env.DB.prepare(`
      INSERT INTO subscriptions 
      (user_id, name, type, type_detail, price, currency, start_date, end_date, remind_days, renew_type, one_time, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
			.bind(
				userId,
				data.name,
				data.type,
				data.type_detail || null,
				data.price,
				data.currency,
				data.start_date,
				data.end_date,
				data.remind_days || 7,
				renewType,
				data.one_time ? 1 : 0,
				data.notes || null,
			)
			.run();

		const newId = result.meta.last_row_id;
		const newSubscription = await env.DB.prepare(
			"SELECT * FROM subscriptions WHERE id = ?",
		)
			.bind(newId)
			.first<Subscription>();

		if (!newSubscription) {
			return errorResponse("创建后获取订阅失败", 500);
		}

		logger.info("Subscription created", { userId, subscriptionId: newId });
		return successResponse(
			transformSubscription(newSubscription),
			"订阅创建成功",
		);
	} catch (error) {
		logger.error("CreateSubscription error", error);
		return errorResponse("创建订阅失败", 500);
	}
}

/**
 * 更新订阅
 */
export async function updateSubscription(
	request: Request,
	env: Env,
	id: string,
): Promise<Response> {
	try {
		const userId = await getUserId(request);
		if (!userId) return errorResponse("未授权", 401);

		const existing = await env.DB.prepare(
			"SELECT id FROM subscriptions WHERE id = ? AND user_id = ?",
		)
			.bind(id, userId)
			.first();

		if (!existing) {
			return errorResponse("订阅不存在", 404);
		}

		const body = await request.json();
		const validation = validateRequest<SubscriptionRequest>(
			body,
			subscriptionSchema,
		);

		if (!validation.valid) {
			return errorResponse(validation.error);
		}

		const data = validation.data;
		const renewType = data.renew_type || "none";

		await env.DB.prepare(`
      UPDATE subscriptions SET
        name = ?, type = ?, type_detail = ?, price = ?, currency = ?,
        start_date = ?, end_date = ?, remind_days = ?, renew_type = ?,
        one_time = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `)
			.bind(
				data.name,
				data.type,
				data.type_detail || null,
				data.price,
				data.currency,
				data.start_date,
				data.end_date,
				data.remind_days || 7,
				renewType,
				data.one_time ? 1 : 0,
				data.notes || null,
				id,
				userId,
			)
			.run();

		const updatedSubscription = await env.DB.prepare(
			"SELECT * FROM subscriptions WHERE id = ?",
		)
			.bind(id)
			.first<Subscription>();

		if (!updatedSubscription) {
			return errorResponse("更新后获取订阅失败", 500);
		}

		logger.info("Subscription updated", { userId, subscriptionId: id });
		return successResponse(
			transformSubscription(updatedSubscription),
			"订阅更新成功",
		);
	} catch (error) {
		logger.error("UpdateSubscription error", error);
		return errorResponse("更新订阅失败", 500);
	}
}

/**
 * 删除订阅
 */
export async function deleteSubscription(
	request: Request,
	env: Env,
	id: string,
): Promise<Response> {
	try {
		const userId = await getUserId(request);
		if (!userId) return errorResponse("未授权", 401);

		const result = await env.DB.prepare(
			"DELETE FROM subscriptions WHERE id = ? AND user_id = ?",
		)
			.bind(id, userId)
			.run();

		if (result.meta.changes === 0) {
			return errorResponse("订阅不存在", 404);
		}

		logger.info("Subscription deleted", { userId, subscriptionId: id });
		return successResponse(null, "订阅删除成功");
	} catch (error) {
		logger.error("DeleteSubscription error", error);
		return errorResponse("删除订阅失败", 500);
	}
}

/**
 * 更新订阅状态
 */
export async function updateSubscriptionStatus(
	request: Request,
	env: Env,
	id: string,
): Promise<Response> {
	try {
		const userId = await getUserId(request);
		if (!userId) return errorResponse("未授权", 401);

		const { status } = (await request.json()) as { status: string };

		await env.DB.prepare(
			"UPDATE subscriptions SET status = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
		)
			.bind(status, id, userId)
			.run();

		return successResponse(null, "状态更新成功");
	} catch (error) {
		logger.error("UpdateSubscriptionStatus error", error);
		return errorResponse("更新状态失败", 500);
	}
}

// ==================== 批量操作 ====================

/**
 * 批量删除订阅
 */
export async function batchDeleteSubscriptions(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const userId = await getUserId(request);
		if (!userId) return errorResponse("未授权", 401);

		const { ids } = (await request.json()) as { ids: number[] };

		if (!Array.isArray(ids) || ids.length === 0) {
			return errorResponse("请选择要删除的订阅", 400);
		}

		const placeholders = ids.map(() => "?").join(",");
		const result = await env.DB.prepare(
			`DELETE FROM subscriptions WHERE id IN (${placeholders}) AND user_id = ?`,
		)
			.bind(...ids, userId)
			.run();

		logger.info("Batch delete completed", {
			userId,
			count: result.meta.changes,
		});
		return successResponse(
			{ deleted: result.meta.changes },
			`成功删除 ${result.meta.changes} 条订阅`,
		);
	} catch (error) {
		logger.error("BatchDeleteSubscriptions error", error);
		return errorResponse("批量删除失败", 500);
	}
}

/**
 * 批量修改提醒天数
 */
export async function batchUpdateRemindDays(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const userId = await getUserId(request);
		if (!userId) return errorResponse("未授权", 401);

		const { ids, remind_days } = (await request.json()) as {
			ids: number[];
			remind_days: number;
		};

		if (!Array.isArray(ids) || ids.length === 0) {
			return errorResponse("请选择要修改的订阅", 400);
		}

		if (
			typeof remind_days !== "number" ||
			remind_days < 1 ||
			remind_days > 365
		) {
			return errorResponse("提醒天数必须在 1-365 之间", 400);
		}

		const placeholders = ids.map(() => "?").join(",");
		const result = await env.DB.prepare(
			`UPDATE subscriptions SET remind_days = ?, updated_at = datetime('now') WHERE id IN (${placeholders}) AND user_id = ?`,
		)
			.bind(remind_days, ...ids, userId)
			.run();

		logger.info("Batch update remind days completed", {
			userId,
			count: result.meta.changes,
		});
		return successResponse(
			{ updated: result.meta.changes },
			`成功修改 ${result.meta.changes} 条订阅的提醒天数`,
		);
	} catch (error) {
		logger.error("BatchUpdateRemindDays error", error);
		return errorResponse("批量修改失败", 500);
	}
}

// ==================== 导入导出 ====================

/**
 * 导出订阅数据
 */
export async function exportSubscriptions(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const userId = await getUserId(request);
		if (!userId) return errorResponse("未授权", 401);

		const url = new URL(request.url);
		const format = url.searchParams.get("format") || "json";

		const { results } = await env.DB.prepare(
			`SELECT name, type, type_detail, price, currency, start_date, end_date, 
              remind_days, renew_type, one_time, status, notes 
       FROM subscriptions WHERE user_id = ? ORDER BY end_date ASC`,
		)
			.bind(userId)
			.all<Subscription>();

		const subscriptions = results.map(transformSubscription);
		const filename = `subly-export-${new Date().toISOString().split("T")[0]}`;

		logger.info("Subscriptions exported", {
			userId,
			format,
			count: subscriptions.length,
		});

		if (format === "csv") {
			return exportAsCsv(subscriptions, filename);
		}

		return exportAsJson(subscriptions, filename);
	} catch (error) {
		logger.error("ExportSubscriptions error", error);
		return errorResponse("导出失败", 500);
	}
}

/**
 * 导入订阅数据
 */
export async function importSubscriptions(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const userId = await getUserId(request);
		if (!userId) return errorResponse("未授权", 401);

		const body = (await request.json()) as {
			data: Array<Record<string, unknown>>;
		};
		const { data } = body;

		if (!Array.isArray(data) || data.length === 0) {
			return errorResponse("导入数据为空或格式错误", 400);
		}

		let imported = 0;
		let failed = 0;

		for (const item of data) {
			try {
				if (!item.name || !item.type || !item.start_date || !item.end_date) {
					failed++;
					continue;
				}

				await env.DB.prepare(`
          INSERT INTO subscriptions 
          (user_id, name, type, type_detail, price, currency, start_date, end_date, remind_days, renew_type, one_time, status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
					.bind(
						userId,
						item.name,
						item.type,
						item.type_detail || null,
						item.price || 0,
						item.currency || "CNY",
						item.start_date,
						item.end_date,
						item.remind_days || 7,
						item.renew_type || "none",
						item.one_time ? 1 : 0,
						item.status || "active",
						item.notes || null,
					)
					.run();
				imported++;
			} catch (e) {
				logger.warn("Import item failed", e);
				failed++;
			}
		}

		logger.info("Subscriptions imported", { userId, imported, failed });
		return successResponse(
			{ imported, failed },
			`成功导入 ${imported} 条，失败 ${failed} 条`,
		);
	} catch (error) {
		logger.error("ImportSubscriptions error", error);
		return errorResponse("导入失败", 500);
	}
}

// ==================== 导出辅助函数 ====================

function exportAsCsv(
	subscriptions: Subscription[],
	filename: string,
): Response {
	const headers = [
		"name",
		"type",
		"type_detail",
		"price",
		"currency",
		"start_date",
		"end_date",
		"remind_days",
		"renew_type",
		"one_time",
		"status",
		"notes",
	];
	const csvRows = [headers.join(",")];

	for (const sub of subscriptions) {
		const row = headers.map((h) => {
			const val = (sub as unknown as Record<string, unknown>)[h];
			if (val === null || val === undefined) return "";
			if (
				typeof val === "string" &&
				(val.includes(",") || val.includes('"') || val.includes("\n"))
			) {
				return `"${val.replace(/"/g, '""')}"`;
			}
			return String(val);
		});
		csvRows.push(row.join(","));
	}

	return new Response(csvRows.join("\n"), {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="${filename}.csv"`,
			"Access-Control-Allow-Origin": "*",
		},
	});
}

function exportAsJson(
	subscriptions: Subscription[],
	filename: string,
): Response {
	return new Response(JSON.stringify(subscriptions, null, 2), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Content-Disposition": `attachment; filename="${filename}.json"`,
			"Access-Control-Allow-Origin": "*",
		},
	});
}
