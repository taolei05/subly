// 用户查询字段常量（仅用户表字段）
export const USER_PUBLIC_FIELDS = "id, username, site_url";

// 聚合查询：用户 + 所有配置
export const USER_WITH_CONFIG_QUERY = `
  SELECT 
    u.id, u.username, u.site_url,
    r.email, r.api_key as resend_api_key, r.domain as resend_domain, 
    r.enabled as resend_enabled, r.notify_time as resend_notify_time, 
    r.notify_interval as resend_notify_interval, r.last_sent_at as resend_last_sent_at,
    s.api_key as serverchan_api_key, s.enabled as serverchan_enabled,
    s.notify_time as serverchan_notify_time, s.notify_interval as serverchan_notify_interval,
    s.last_sent_at as serverchan_last_sent_at,
    e.api_key as exchangerate_api_key, e.enabled as exchangerate_enabled
  FROM users u
  LEFT JOIN resend_config r ON u.id = r.user_id
  LEFT JOIN serverchan_config s ON u.id = s.user_id
  LEFT JOIN exchangerate_config e ON u.id = e.user_id
`.trim();
