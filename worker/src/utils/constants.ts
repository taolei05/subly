// 用户查询字段常量
export const USER_PUBLIC_FIELDS = `
  id, username, email,
  resend_api_key, resend_domain, resend_enabled, resend_notify_time, resend_notify_interval,
  serverchan_api_key, serverchan_enabled, serverchan_notify_time, serverchan_notify_interval,
  exchangerate_api_key, exchangerate_enabled, site_url
`.trim();

export const USER_SETTINGS_FIELDS = `
  email, resend_api_key, resend_domain, resend_enabled, resend_notify_time, resend_notify_interval,
  serverchan_api_key, serverchan_enabled, serverchan_notify_time, serverchan_notify_interval,
  exchangerate_api_key, exchangerate_enabled, site_url
`.trim();
