// CORS 头
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// JSON 响应辅助函数
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// 错误响应
export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ success: false, message }, status);
}

// 成功响应
export function successResponse<T>(data?: T, message?: string): Response {
  return jsonResponse({ success: true, data, message });
}
