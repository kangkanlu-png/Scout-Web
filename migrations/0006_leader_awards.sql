-- 領袖獎項系統（對應原 Next.js 系統的 leaderAwards/memberLeaderAwards）

-- 領袖獎項定義表
CREATE TABLE IF NOT EXISTS leader_awards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  category TEXT NOT NULL DEFAULT 'Service',  -- Service/Craft/Leadership/Adventure
  level INTEGER NOT NULL DEFAULT 1,           -- 1=最低, 9=最高
  display_order INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  applicable_sections TEXT,                   -- JSON array: ['童軍','行義童軍','羅浮童軍']
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 成員領袖獎項記錄
CREATE TABLE IF NOT EXISTS member_leader_awards (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  award_id TEXT NOT NULL,
  year_label TEXT,                           -- 學年度
  awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (award_id) REFERENCES leader_awards(id),
  UNIQUE(member_id, award_id)
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_member_leader_awards_member ON member_leader_awards(member_id);
CREATE INDEX IF NOT EXISTS idx_member_leader_awards_award ON member_leader_awards(award_id);
CREATE INDEX IF NOT EXISTS idx_leader_awards_level ON leader_awards(level);

-- 預設童軍領袖進程獎項（根據原系統 fix-award-order.ts 中的9種）
INSERT OR IGNORE INTO leader_awards (id, name, name_en, category, level, display_order, description, applicable_sections) VALUES
  ('la_rank1', '初級童軍', 'Tenderfoot Scout', 'Rank', 1, 1, '完成初級童軍訓練', '["童軍"]'),
  ('la_rank2', '中級童軍', 'Second Class Scout', 'Rank', 2, 2, '完成中級童軍訓練', '["童軍"]'),
  ('la_rank3', '高級童軍', 'First Class Scout', 'Rank', 3, 3, '完成高級童軍訓練', '["童軍"]'),
  ('la_rank4', '獅級童軍', 'Lion Scout', 'Rank', 4, 4, '完成獅級童軍訓練', '["童軍"]'),
  ('la_rank5', '長城童軍', 'Great Wall Scout', 'Rank', 5, 5, '完成長城童軍訓練', '["童軍"]'),
  ('la_rank6', '國花童軍', 'Plum Blossom Scout', 'Rank', 6, 6, '完成國花童軍訓練（最高級）', '["童軍"]'),
  ('la_rank7', '見習羅浮', 'Rover Apprentice', 'Rank', 7, 7, '見習羅浮進程', '["羅浮童軍"]'),
  ('la_rank8', '授銜羅浮', 'Rover Scout', 'Rank', 8, 8, '授銜羅浮進程', '["羅浮童軍"]'),
  ('la_rank9', '服務羅浮', 'Service Rover', 'Rank', 9, 9, '服務羅浮進程（最高級）', '["羅浮童軍"]');

-- 行義童軍進程獎項
INSERT OR IGNORE INTO leader_awards (id, name, name_en, category, level, display_order, description, applicable_sections) VALUES
  ('la_senior1', '行義初級', 'Senior Scout 1st', 'Rank', 1, 10, '行義初級進程', '["行義童軍"]'),
  ('la_senior2', '行義中級', 'Senior Scout 2nd', 'Rank', 2, 11, '行義中級進程', '["行義童軍"]'),
  ('la_senior3', '行義高級', 'Senior Scout 3rd', 'Rank', 3, 12, '行義高級進程', '["行義童軍"]');
