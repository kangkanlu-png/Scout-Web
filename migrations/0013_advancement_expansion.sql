-- 進程系統擴充：專科章與標準版本控制

-- 1. 專科章定義表
CREATE TABLE IF NOT EXISTS specialty_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,           -- 專科章名稱 (e.g. 露營, 烹飪)
  category TEXT,                -- 類別 (e.g. 服務類, 技能類, 健身類)
  image_url TEXT,               -- 圖示
  description TEXT,             -- 描述
  is_active INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 學員專科章紀錄
CREATE TABLE IF NOT EXISTS member_specialty_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL,
  badge_id INTEGER NOT NULL,
  obtained_date TEXT,           -- 獲得日期
  examiner TEXT,                -- 考驗委員/認證者
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (badge_id) REFERENCES specialty_badges(id),
  UNIQUE(member_id, badge_id)   -- 同一個章一個人只有一個紀錄
);

-- 3. 擴充進程標準表，加入版本控制
ALTER TABLE advancement_requirements ADD COLUMN version_year TEXT DEFAULT '113'; -- 預設為 113 學年版

-- 4. 建立索引
CREATE INDEX IF NOT EXISTS idx_spec_badges_cat ON specialty_badges(category);
CREATE INDEX IF NOT EXISTS idx_mem_spec_badges_mem ON member_specialty_badges(member_id);
CREATE INDEX IF NOT EXISTS idx_adv_req_ver ON advancement_requirements(version_year);

-- 5. 預設一些常見專科章 (範例)
INSERT INTO specialty_badges (name, category, display_order) VALUES 
('露營', '技能', 1),
('急救', '服務', 2),
('國家公民', '服務', 3),
('世界公民', '服務', 4),
('社區公民', '服務', 5),
('生態保育', '技能', 6),
('旅行', '技能', 7),
('測量', '技能', 8);
