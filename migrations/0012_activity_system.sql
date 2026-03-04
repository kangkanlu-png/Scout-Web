-- 活動系統擴充：詳細資訊與報名功能

-- 1. 擴充 activities 表
-- SQLite 不支援一次新增多個欄位，需分開執行
-- 新增：地點
ALTER TABLE activities ADD COLUMN location TEXT;

-- 新增：費用 (存文字描述，例如 "200元" 或 "免費")
ALTER TABLE activities ADD COLUMN cost TEXT;

-- 新增：詳細內容 (HTML/Markdown)
ALTER TABLE activities ADD COLUMN content TEXT;

-- 新增：報名開始時間
ALTER TABLE activities ADD COLUMN registration_start DATETIME;

-- 新增：報名截止時間
ALTER TABLE activities ADD COLUMN registration_end DATETIME;

-- 新增：名額限制 (NULL表示不限)
ALTER TABLE activities ADD COLUMN max_participants INTEGER;

-- 新增：是否開放線上報名 (手動開關，優先於時間)
ALTER TABLE activities ADD COLUMN is_registration_open INTEGER DEFAULT 0;

-- 新增：活動結束日期 (支援區間，原 activity_date 作為開始日期)
ALTER TABLE activities ADD COLUMN activity_end_date TEXT;

-- 2. 建立報名資料表
CREATE TABLE IF NOT EXISTS activity_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL,
  member_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',          -- pending(審核中)/approved(錄取)/rejected(不錄取)/cancelled(取消)/waiting(候補)
  registration_data TEXT,                 -- 額外報名資料 (JSON string)
  user_notes TEXT,                        -- 使用者備註
  admin_notes TEXT,                       -- 管理員備註
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id)
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_registrations_activity ON activity_registrations(activity_id);
CREATE INDEX IF NOT EXISTS idx_registrations_member ON activity_registrations(member_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON activity_registrations(status);
