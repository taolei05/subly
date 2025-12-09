/**
 * 格式化日期为 YYYY-MM-DD 格式
 */
export function formatDate(timestamp: number | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化日期为本地化显示格式
 */
export function formatDateLocale(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

/**
 * 计算两个日期之间的天数差
 */
export function daysBetween(date1: Date, date2: Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 计算距离今天的天数
 */
export function daysFromToday(dateStr: string): number {
  const today = new Date();
  const targetDate = new Date(dateStr);
  return daysBetween(today, targetDate);
}

/**
 * 解析 CSV 文件内容
 */
export function parseCSV(text: string): Record<string, unknown>[] {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(',');
    const obj: Record<string, unknown> = {};

    headers.forEach((h, i) => {
      let val: unknown = values[i]?.replace(/^"|"$/g, '');
      if (h === 'one_time') val = val === 'true' || val === '1';
      if (h === 'price' || h === 'remind_days') val = Number(val) || 0;
      obj[h] = val;
    });

    return obj;
  });
}
