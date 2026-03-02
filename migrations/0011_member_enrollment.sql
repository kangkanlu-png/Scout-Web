-- 年度在籍記錄表
-- 記錄哪些成員「參加今年活動」，這是出席管理的人員基礎

CREATE TABLE IF NOT EXISTS member_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL,
  year_label TEXT NOT NULL,             -- 學年度，例：114, 115
  section TEXT,                         -- 童軍/行義童軍/羅浮童軍/服務員
  rank_level TEXT,                      -- 當年度進程
  unit_name TEXT,                       -- 小隊名稱
  role_name TEXT DEFAULT '隊員',        -- 職位
  troop TEXT DEFAULT '54團',
  is_active INTEGER NOT NULL DEFAULT 1, -- 1=參加今年活動, 0=退出
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id),
  UNIQUE(member_id, year_label)
);

-- 成員新增 national_id 欄位（若尚未有）
-- ALTER TABLE members ADD COLUMN national_id TEXT; -- already exists in 0004

-- 新增 school_year 設定到 site_settings（若不存在）
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('current_year_label', '114');

-- 固定小隊清單：童軍第一隊到第五隊
CREATE TABLE IF NOT EXISTS scout_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_name TEXT NOT NULL UNIQUE,
  section TEXT NOT NULL,         -- junior/senior/rover
  unit_order INTEGER DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- 預設小隊資料
INSERT OR IGNORE INTO scout_units (unit_name, section, unit_order) VALUES
  ('遊俠小隊', 'junior', 1),
  ('刺客小隊', 'junior', 2),
  ('戰士小隊', 'junior', 3),
  ('巫師小隊', 'junior', 4),
  ('聖騎士小隊', 'junior', 5);

CREATE INDEX IF NOT EXISTS idx_member_enrollments_member ON member_enrollments(member_id);
CREATE INDEX IF NOT EXISTS idx_member_enrollments_year ON member_enrollments(year_label);
