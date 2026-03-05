-- 教練團晉級檢核系統

-- 各階段檢核項目（可調整）
CREATE TABLE IF NOT EXISTS coach_checklist_items (
  id TEXT PRIMARY KEY,
  stage TEXT NOT NULL,          -- 見習教練 / 助理教練 / 指導教練
  description TEXT NOT NULL,    -- 項目描述
  required_count INTEGER DEFAULT 1, -- 需完成幾次（預設1）
  display_order INTEGER DEFAULT 99,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 個人完成記錄
CREATE TABLE IF NOT EXISTS coach_checklist_completions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,      -- 關聯 members.id
  item_id TEXT NOT NULL,        -- 關聯 coach_checklist_items.id
  completed_count INTEGER DEFAULT 1, -- 已完成次數
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  verified_by TEXT,             -- 審核者名稱
  notes TEXT,
  UNIQUE(member_id, item_id)
);

-- 教練團成員目前階段狀態
CREATE TABLE IF NOT EXISTS coach_member_status (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL UNIQUE, -- 關聯 members.id
  current_stage TEXT NOT NULL DEFAULT '預備教練', -- 預備教練/見習教練/助理教練/指導教練
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  promoted_at DATETIME
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_coach_checklist_stage ON coach_checklist_items(stage);
CREATE INDEX IF NOT EXISTS idx_coach_completions_member ON coach_checklist_completions(member_id);
CREATE INDEX IF NOT EXISTS idx_coach_status_member ON coach_member_status(member_id);

-- 預設檢核項目（依圖示晉級條件）
-- 見習教練晉助理教練
INSERT OR IGNORE INTO coach_checklist_items (id, stage, description, required_count, display_order) VALUES
  ('ci_trainee_01', '見習教練', 'G8以上（行義童軍）或正式童軍團員', 1, 1),
  ('ci_trainee_02', '見習教練', '參加過幹訓1次', 1, 2),
  ('ci_trainee_03', '見習教練', '參加園內幹部訓練', 1, 3),
  ('ci_trainee_04', '見習教練', '擔任園慶或考驗營工作人員', 1, 4),
  ('ci_trainee_05', '見習教練', '上台授課經驗', 2, 5);

-- 助理教練晉指導教練
INSERT OR IGNORE INTO coach_checklist_items (id, stage, description, required_count, display_order) VALUES
  ('ci_assist_01', '助理教練', '行義童軍 G9 以上或具備見習資格', 1, 1),
  ('ci_assist_02', '助理教練', '參加過幹訓1次以上', 1, 2),
  ('ci_assist_03', '助理教練', '團慶或考驗營服務', 3, 3),
  ('ci_assist_04', '助理教練', '社團授課', 2, 4),
  ('ci_assist_05', '助理教練', '舉辦幹部訓練', 1, 5),
  ('ci_assist_06', '助理教練', '幹部訓練授課講師', 1, 6);

-- 指導教練條件
INSERT OR IGNORE INTO coach_checklist_items (id, stage, description, required_count, display_order) VALUES
  ('ci_guide_01', '指導教練', '行義童軍或具備助理資格', 1, 1),
  ('ci_guide_02', '指導教練', '參加過幹訓2次以上', 2, 2),
  ('ci_guide_03', '指導教練', '擔任過園慶或考驗營服務工作組長以上', 1, 3),
  ('ci_guide_04', '指導教練', '擔任過幹訓工作人員', 1, 4),
  ('ci_guide_05', '指導教練', '在幹訓授課擔任講師', 1, 5);
