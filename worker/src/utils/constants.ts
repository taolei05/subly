// 用户查询字段常量（仅用户表字段）
export const USER_PUBLIC_FIELDS = "id, username, role, site_url";

// 聚合查询：用户 + 所有配置
export const USER_WITH_CONFIG_QUERY = `
  SELECT 
    u.id, u.username, u.role, u.site_url,
    u.totp_enabled,
    r.email, r.api_key as resend_api_key, r.domain as resend_domain, 
    r.enabled as resend_enabled, r.notify_hours as resend_notify_hours,
    r.last_sent_at as resend_last_sent_at,
    r.template_subject as resend_template_subject, r.template_body as resend_template_body,
    s.api_key as serverchan_api_key, s.enabled as serverchan_enabled,
    s.notify_hours as serverchan_notify_hours, s.last_sent_at as serverchan_last_sent_at,
    s.template_title as serverchan_template_title, s.template_body as serverchan_template_body,
    e.api_key as exchangerate_api_key, e.enabled as exchangerate_enabled,
    b.enabled as backup_enabled, b.frequency as backup_frequency,
    b.to_email as backup_to_email, b.to_r2 as backup_to_r2,
    b.backup_subscriptions, b.backup_settings, b.last_at as backup_last_at
  FROM users u
  LEFT JOIN resend_config r ON u.id = r.user_id
  LEFT JOIN serverchan_config s ON u.id = s.user_id
  LEFT JOIN exchangerate_config e ON u.id = e.user_id
  LEFT JOIN backup_config b ON u.id = b.user_id
`.trim();
