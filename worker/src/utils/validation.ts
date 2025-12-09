export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: readonly unknown[];
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export function validateRequest<T>(
  data: unknown,
  schema: ValidationSchema,
): { valid: true; data: T } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '请求数据无效' };
  }

  const obj = data as Record<string, unknown>;

  for (const [field, rules] of Object.entries(schema)) {
    const value = obj[field];

    // 必填检查
    if (rules.required && (value === undefined || value === null || value === '')) {
      return { valid: false, error: `${field} 是必填项` };
    }

    // 如果值不存在且非必填，跳过其他验证
    if (value === undefined || value === null) continue;

    // 类型检查
    if (rules.type) {
      if (rules.type === 'array' && !Array.isArray(value)) {
        return { valid: false, error: `${field} 必须是数组` };
      }
      if (rules.type !== 'array' && typeof value !== rules.type) {
        return { valid: false, error: `${field} 类型错误` };
      }
    }

    // 字符串长度检查
    if (typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        return { valid: false, error: `${field} 至少 ${rules.minLength} 个字符` };
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        return { valid: false, error: `${field} 最多 ${rules.maxLength} 个字符` };
      }
    }

    // 数字范围检查
    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        return { valid: false, error: `${field} 不能小于 ${rules.min}` };
      }
      if (rules.max !== undefined && value > rules.max) {
        return { valid: false, error: `${field} 不能大于 ${rules.max}` };
      }
    }

    // 枚举检查
    if (rules.enum && !rules.enum.includes(value)) {
      return { valid: false, error: `${field} 值无效` };
    }
  }

  return { valid: true, data: data as T };
}

// 验证站点 URL 格式
export function isValidSiteUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  return url.startsWith('http://') || url.startsWith('https://');
}
