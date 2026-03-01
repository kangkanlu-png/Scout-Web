-- =====================================================
-- 0009_official_leave.sql
-- 公假申請系統
-- =====================================================

-- 公假申請記錄
CREATE TABLE IF NOT EXISTS official_leave_applications (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  leave_date TEXT NOT NULL,              -- YYYY-MM-DD
  timeslots TEXT NOT NULL DEFAULT '[]',  -- JSON array: ["M","H","午休","其他"]
  reason TEXT,
  is_conflict_checked INTEGER NOT NULL DEFAULT 0,  -- 確認不衝突
  is_teacher_informed INTEGER NOT NULL DEFAULT 0,  -- 已告知導師
  status TEXT NOT NULL DEFAULT 'pending',  -- pending/approved/rejected/uploaded
  admin_note TEXT,
  reviewed_by TEXT,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE INDEX IF NOT EXISTS idx_official_leave_member ON official_leave_applications(member_id);
CREATE INDEX IF NOT EXISTS idx_official_leave_date ON official_leave_applications(leave_date);
CREATE INDEX IF NOT EXISTS idx_official_leave_status ON official_leave_applications(status);

-- 行事曆事件（特殊日期：封鎖/假期/考試/活動等）
CREATE TABLE IF NOT EXISTS leave_calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,   -- YYYY-MM-DD
  type TEXT NOT NULL DEFAULT 'event',  -- event/holiday/exam/blocked
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leave_calendar_date ON leave_calendar_events(date);

-- 系統設定（公假相關）
-- 使用現有的 site_settings 資料表，以 key 區分：
-- official_leave_semester_start  → 學期開始日 (YYYY-MM-DD)
-- official_leave_semester_end    → 學期結束日 (YYYY-MM-DD)
-- official_leave_allowed_weekdays → JSON 陣列 [1,2,3,4,5]
-- official_leave_recurring_rules  → JSON 陣列每週例行事件

-- 插入預設設定
INSERT OR IGNORE INTO site_settings (key, value, description) VALUES
  ('official_leave_semester_start', '2026-02-13', '公假申請學期開始日期'),
  ('official_leave_semester_end',   '2026-07-02', '公假申請學期結束日期'),
  ('official_leave_allowed_weekdays', '[1,2,3,4,5]', '開放申請的星期幾 (0=日,1=一...6=六)'),
  ('official_leave_recurring_rules',  '[]', '每週例行活動 JSON 陣列');
