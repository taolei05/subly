// 订阅类型选项
export const TYPE_OPTIONS = [
  { label: '域名', value: 'domain' },
  { label: '服务器', value: 'server' },
  { label: '会员', value: 'membership' },
  { label: '软件', value: 'software' },
  { label: '其他', value: 'other' },
] as const;

// 订阅类型筛选选项（包含"全部"）
export const TYPE_FILTER_OPTIONS = [
  { label: '全部', value: null },
  { label: '域名', value: 'domain' },
  { label: '服务器', value: 'server' },
  { label: '会员', value: 'membership' },
  { label: '软件', value: 'software' },
  { label: '其他', value: 'other' },
];

// 订阅类型标签映射
export const TYPE_LABELS: Record<string, string> = {
  domain: '域名',
  server: '服务器',
  membership: '会员',
  software: '软件',
  other: '其他',
};

// 货币选项
export const CURRENCY_OPTIONS = [
  { label: '¥ CNY', value: 'CNY' },
  { label: 'HK$ HKD', value: 'HKD' },
  { label: '$ USD', value: 'USD' },
  { label: '€ EUR', value: 'EUR' },
  { label: '£ GBP', value: 'GBP' },
] as const;

// 货币选项（带完整名称）
export const CURRENCY_OPTIONS_FULL = [
  { label: '人民币 (CNY)', value: 'CNY' },
  { label: '港币 (HKD)', value: 'HKD' },
  { label: '美元 (USD)', value: 'USD' },
  { label: '欧元 (EUR)', value: 'EUR' },
  { label: '英镑 (GBP)', value: 'GBP' },
] as const;

// 货币符号映射
export const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: '¥',
  HKD: 'HK$',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

// 排序选项
export const SORT_OPTIONS = [
  { label: '到期时间', value: 'end_date' },
  { label: '价格', value: 'price' },
  { label: '名称', value: 'name' },
] as const;

// 续订类型选项
export const RENEW_TYPE_OPTIONS = [
  { label: '不续订', value: 'none' },
  { label: '自动续订', value: 'auto' },
  { label: '手动续订', value: 'manual' },
] as const;

// 续订类型标签映射
export const RENEW_TYPE_LABELS: Record<string, string> = {
  none: '不续订',
  auto: '自动续订',
  manual: '手动续订',
};
