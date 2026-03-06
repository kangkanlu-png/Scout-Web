-- 相關網頁連結表
CREATE TABLE IF NOT EXISTS site_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT '童軍相關',
  icon_emoji TEXT DEFAULT '🔗',
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 預設幾個示範連結
INSERT OR IGNORE INTO site_links (title, url, description, category, icon_emoji, display_order) VALUES
  ('中華民國童軍總會', 'https://www.scout.org.tw', '台灣童軍最高組織', '國內童軍', '⚜️', 1),
  ('世界童軍組織 (WOSM)', 'https://www.scout.org', 'World Organization of the Scout Movement', '國際童軍', '🌍', 2),
  ('亞太地區童軍組織', 'https://www.scout.org/apo', 'Asia Pacific Regional Scout Organization', '國際童軍', '🌏', 3),
  ('新北市童軍會', 'https://www.ntpcscouting.org.tw', '新北市童軍地方組織', '國內童軍', '🏙️', 4);
