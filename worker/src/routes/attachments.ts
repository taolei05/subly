import type {
	ALLOWED_MIME_TYPES,
	Attachment,
	Env,
	MAX_FILE_SIZE,
} from "../types/index";
import { errorResponse, logger, successResponse, verifyToken } from "../utils";

// 允许的 MIME 类型
const ALLOWED_TYPES = [
	"application/pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"image/png",
	"image/jpeg",
];

// 最大文件大小 10MB
const MAX_SIZE = 10 * 1024 * 1024;

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

	// 再尝试从 URL 参数获取（用于下载/预览等场景）
	const url = new URL(request.url);
	const tokenParam = url.searchParams.get("token");
	if (tokenParam) {
		const payload = await verifyToken(tokenParam);
		if (payload?.userId) return payload.userId;
	}

	return null;
}

/**
 * 检查用户是否为 demo 用户
 */
async function isDemoUser(env: Env, userId: number): Promise<boolean> {
	const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?")
		.bind(userId)
		.first<{ role: string }>();
	return user?.role === "demo";
}

/**
 * 生成唯一文件名（保留原始文件名，添加时间戳前缀）
 */
function generateFilename(originalName: string): string {
	const timestamp = Date.now();
	// 移除文件名中的特殊字符，保留中文、字母、数字、点、下划线、横线
	const safeName = originalName.replace(/[^\u4e00-\u9fa5a-zA-Z0-9._-]/g, "_");
	return `${timestamp}-${safeName}`;
}

/**
 * 获取订阅的所有附件
 */
export async function getAttachments(
	request: Request,
	env: Env,
	subscriptionId: string,
): Promise<Response> {
	try {
		const userId = await getUserId(request);
		if (!userId) return errorResponse("未授权", 401);

		// 验证订阅属于当前用户
		const subscription = await env.DB.prepare(
			"SELECT id FROM subscriptions WHERE id = ? AND user_id = ?",
		)
			.bind(subscriptionId, userId)
			.first();

		if (!subscription) {
			return errorResponse("订阅不存在", 404);
		}

		const { results } = await env.DB.prepare(
			"SELECT * FROM attachments WHERE subscription_id = ? AND user_id = ? ORDER BY created_at DESC",
		)
			.bind(subscriptionId, userId)
			.all<Attachment>();

		return successResponse(results);
	} catch (error) {
		logger.error("GetAttachments error", error);
		return errorResponse("获取附件失败", 500);
	}
}

/**
 * 上传附件
 */
export async function uploadAttachment(
	request: Request,
	env: Env,
	subscriptionId: string,
): Promise<Response> {
	try {
		const userId = await getUserId(request);
		if (!userId) return errorResponse("未授权", 401);

		if (await isDemoUser(env, userId)) {
			return errorResponse("演示账户不能上传附件", 403);
		}

		if (!env.BACKUP_BUCKET) {
			return errorResponse("存储服务未配置", 500);
		}

		// 验证订阅属于当前用户
		const subscription = await env.DB.prepare(
			"SELECT id FROM subscriptions WHERE id = ? AND user_id = ?",
		)
			.bind(subscriptionId, userId)
			.first();

		if (!subscription) {
			return errorResponse("订阅不存在", 404);
		}

		// 解析 multipart/form-data
		const formData = await request.formData();
		const file = formData.get("file") as File | null;

		if (!file) {
			return errorResponse("请选择文件", 400);
		}

		// 验证文件类型
		if (!ALLOWED_TYPES.includes(file.type)) {
			return errorResponse("不支持的文件类型，仅支持 PDF、Word、PNG、JPG", 400);
		}

		// 验证文件大小
		if (file.size > MAX_SIZE) {
			return errorResponse("文件大小不能超过 10MB", 400);
		}

		// 生成唯一文件名和 R2 key
		const filename = generateFilename(file.name);
		const r2Key = `attachments/${userId}/${subscriptionId}/${filename}`;

		// 上传到 R2
		const arrayBuffer = await file.arrayBuffer();
		await env.BACKUP_BUCKET.put(r2Key, arrayBuffer, {
			httpMetadata: { contentType: file.type },
		});

		// 保存到数据库
		const result = await env.DB.prepare(`
			INSERT INTO attachments (user_id, subscription_id, filename, original_name, mime_type, size, r2_key)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`)
			.bind(
				userId,
				subscriptionId,
				filename,
				file.name,
				file.type,
				file.size,
				r2Key,
			)
			.run();

		const newId = result.meta.last_row_id;
		const attachment = await env.DB.prepare(
			"SELECT * FROM attachments WHERE id = ?",
		)
			.bind(newId)
			.first<Attachment>();

		logger.info("Attachment uploaded", {
			userId,
			subscriptionId,
			filename,
		});

		return successResponse(attachment, "附件上传成功");
	} catch (error) {
		logger.error("UploadAttachment error", error);
		return errorResponse("上传附件失败", 500);
	}
}

/**
 * 下载/预览附件
 */
export async function downloadAttachment(
	request: Request,
	env: Env,
	attachmentId: string,
): Promise<Response> {
	try {
		const userId = await getUserId(request);
		if (!userId) return errorResponse("未授权", 401);

		if (!env.BACKUP_BUCKET) {
			return errorResponse("存储服务未配置", 500);
		}

		// 获取附件信息
		const attachment = await env.DB.prepare(
			"SELECT * FROM attachments WHERE id = ? AND user_id = ?",
		)
			.bind(attachmentId, userId)
			.first<Attachment>();

		if (!attachment) {
			return errorResponse("附件不存在", 404);
		}

		// 从 R2 获取文件
		const object = await env.BACKUP_BUCKET.get(attachment.r2_key);
		if (!object) {
			return errorResponse("文件不存在", 404);
		}

		const url = new URL(request.url);
		const isDownload = url.searchParams.get("download") === "true";

		const headers: Record<string, string> = {
			"Content-Type": attachment.mime_type,
			"Content-Length": String(attachment.size),
			"Access-Control-Allow-Origin": "*",
		};

		if (isDownload) {
			headers["Content-Disposition"] =
				`attachment; filename="${encodeURIComponent(attachment.original_name)}"`;
		} else {
			headers["Content-Disposition"] =
				`inline; filename="${encodeURIComponent(attachment.original_name)}"`;
		}

		return new Response(object.body, { headers });
	} catch (error) {
		logger.error("DownloadAttachment error", error);
		return errorResponse("下载附件失败", 500);
	}
}

/**
 * 删除附件
 */
export async function deleteAttachment(
	request: Request,
	env: Env,
	attachmentId: string,
): Promise<Response> {
	try {
		const userId = await getUserId(request);
		if (!userId) return errorResponse("未授权", 401);

		if (await isDemoUser(env, userId)) {
			return errorResponse("演示账户不能删除附件", 403);
		}

		if (!env.BACKUP_BUCKET) {
			return errorResponse("存储服务未配置", 500);
		}

		// 获取附件信息
		const attachment = await env.DB.prepare(
			"SELECT * FROM attachments WHERE id = ? AND user_id = ?",
		)
			.bind(attachmentId, userId)
			.first<Attachment>();

		if (!attachment) {
			return errorResponse("附件不存在", 404);
		}

		// 从 R2 删除文件
		await env.BACKUP_BUCKET.delete(attachment.r2_key);

		// 从数据库删除记录
		await env.DB.prepare("DELETE FROM attachments WHERE id = ?")
			.bind(attachmentId)
			.run();

		logger.info("Attachment deleted", { userId, attachmentId });

		return successResponse(null, "附件删除成功");
	} catch (error) {
		logger.error("DeleteAttachment error", error);
		return errorResponse("删除附件失败", 500);
	}
}
