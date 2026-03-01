-- 分組子頁面系統
-- 對應原網站: 童軍團組織/現任幹部/歷屆幹部/歷屆名單
--              行義團組織架構/教練團/現任幹部/歷屆幹部/歷屆名單

-- 組織架構（純文字/HTML內容）
CREATE TABLE IF NOT EXISTS group_org_chart (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  content TEXT,           -- HTML 或 Markdown 內容（組織圖說明）
  image_url TEXT,         -- 組織圖圖片
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES scout_groups(id)
);

-- 幹部記錄
CREATE TABLE IF NOT EXISTS group_cadres (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  year_label TEXT NOT NULL,     -- 學年度 e.g. 115, 114
  role TEXT NOT NULL,           -- 職位 e.g. 團長、副團長、行政長、器材長
  chinese_name TEXT NOT NULL,
  english_name TEXT,
  photo_url TEXT,               -- 幹部照片
  notes TEXT,
  display_order INTEGER DEFAULT 0,
  is_current INTEGER DEFAULT 0, -- 1=現任, 0=歷屆
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES scout_groups(id)
);

-- 歷屆名單（每學年完整成員名單）
CREATE TABLE IF NOT EXISTS group_alumni (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  year_label TEXT NOT NULL,    -- 學年度 e.g. 115
  member_name TEXT NOT NULL,
  english_name TEXT,
  unit_name TEXT,              -- 小隊
  role_name TEXT,              -- 職位
  rank_level TEXT,             -- 級別
  notes TEXT,
  display_order INTEGER DEFAULT 0,
  FOREIGN KEY (group_id) REFERENCES scout_groups(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_group_cadres_group ON group_cadres(group_id);
CREATE INDEX IF NOT EXISTS idx_group_cadres_year ON group_cadres(year_label);
CREATE INDEX IF NOT EXISTS idx_group_alumni_group ON group_alumni(group_id);
CREATE INDEX IF NOT EXISTS idx_group_alumni_year ON group_alumni(year_label);
