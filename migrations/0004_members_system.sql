-- 人員管理系統

-- 成員資料表
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  chinese_name TEXT NOT NULL,
  english_name TEXT,
  gender TEXT,
  national_id TEXT,
  dob TEXT,
  phone TEXT,
  email TEXT,
  parent_name TEXT,
  section TEXT NOT NULL DEFAULT '童軍',  -- 稚齡童軍/幼童軍/童軍/行義童軍/羅浮童軍/服務員
  rank_level TEXT,                        -- 初級童軍/中級童軍/高級童軍/獅級童軍/長城童軍/國花童軍/見習羅浮/授銜羅浮/服務羅浮
  unit_name TEXT,                         -- 小隊名稱
  role_name TEXT DEFAULT '隊員',          -- 小隊長/副小隊長/隊員/群長/副群長...
  troop TEXT DEFAULT '54團',             -- 54團/404團
  membership_status TEXT DEFAULT 'ACTIVE', -- ACTIVE/INACTIVE/GRADUATED
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 學年度成員記錄（每年建立一份）
CREATE TABLE IF NOT EXISTS member_year_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL,
  year_label TEXT NOT NULL,   -- 114, 115
  section TEXT,
  rank_level TEXT,
  unit_name TEXT,
  role_name TEXT,
  troop TEXT,
  FOREIGN KEY (member_id) REFERENCES members(id),
  UNIQUE(member_id, year_label)
);

-- 出席記錄 - 課程/活動場次
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  section TEXT NOT NULL,        -- junior(童軍)/senior(行義)/rover(羅浮)/all(全體)
  session_number INTEGER,
  topic TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 出席記錄 - 每人出席狀態
CREATE TABLE IF NOT EXISTS attendance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'present',  -- present/absent/leave/late
  note TEXT,
  FOREIGN KEY (session_id) REFERENCES attendance_sessions(id),
  FOREIGN KEY (member_id) REFERENCES members(id),
  UNIQUE(session_id, member_id)
);

-- 進程記錄（晉升/達成紀錄）
CREATE TABLE IF NOT EXISTS progress_records (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  record_type TEXT NOT NULL,   -- rank(晉級)/badge(徽章)/achievement(成就)
  award_id TEXT,
  award_name TEXT NOT NULL,
  year_label TEXT,
  awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (member_id) REFERENCES members(id)
);

-- 公假申請
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  session_id TEXT,
  leave_type TEXT NOT NULL DEFAULT 'official',  -- official(公假)/personal(事假)/sick(病假)
  reason TEXT,
  date TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending/approved/rejected
  approved_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id)
);

-- 教練團成員
CREATE TABLE IF NOT EXISTS coach_members (
  id TEXT PRIMARY KEY,
  member_id TEXT,             -- 對應 members 表，可選
  chinese_name TEXT NOT NULL,
  english_name TEXT,
  coach_level TEXT NOT NULL,  -- 預備教練/見習教練/助理教練/指導教練
  specialties TEXT,           -- 專長（JSON array）
  year_label TEXT,
  section_assigned TEXT,      -- 負責哪個組別
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_members_section ON members(section);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(membership_status);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_date ON attendance_sessions(date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_member ON attendance_records(member_id);
CREATE INDEX IF NOT EXISTS idx_progress_records_member ON progress_records(member_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_member ON leave_requests(member_id);
