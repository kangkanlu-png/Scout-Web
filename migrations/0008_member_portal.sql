-- =============================================
-- Migration 0008: 會員入口系統
-- 包含：會員帳號、晉升條件、審核記錄
-- =============================================

-- 1. 會員帳號表（登入用）
CREATE TABLE IF NOT EXISTS member_accounts (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,          -- 登入帳號（通常是學號或英文名）
  password_hash TEXT NOT NULL,            -- SHA-256 雜湊
  is_active INTEGER DEFAULT 1,
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE INDEX IF NOT EXISTS idx_member_accounts_username ON member_accounts(username);
CREATE INDEX IF NOT EXISTS idx_member_accounts_member ON member_accounts(member_id);

-- 2. 晉升條件定義表
CREATE TABLE IF NOT EXISTS advancement_requirements (
  id TEXT PRIMARY KEY,
  section TEXT NOT NULL,                  -- 童軍/行義童軍/羅浮童軍
  rank_from TEXT NOT NULL,                -- 目前階級
  rank_to TEXT NOT NULL,                  -- 目標階級
  requirement_type TEXT NOT NULL,         -- attendance/service/badge/test/camp/other
  title TEXT NOT NULL,                    -- 條件名稱
  description TEXT,                       -- 詳細說明
  required_count INTEGER DEFAULT 1,       -- 需達到的次數/數量
  unit TEXT DEFAULT '次',                 -- 單位（次/小時/天）
  is_mandatory INTEGER DEFAULT 1,         -- 是否必填
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_adv_req_section ON advancement_requirements(section);
CREATE INDEX IF NOT EXISTS idx_adv_req_rank ON advancement_requirements(rank_from, rank_to);

-- 3. 晉升申請記錄
CREATE TABLE IF NOT EXISTS advancement_applications (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  section TEXT NOT NULL,
  rank_from TEXT NOT NULL,
  rank_to TEXT NOT NULL,
  apply_date TEXT NOT NULL,
  status TEXT DEFAULT 'pending',          -- pending/reviewing/approved/rejected
  admin_notes TEXT,
  reviewed_by TEXT,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE INDEX IF NOT EXISTS idx_adv_app_member ON advancement_applications(member_id);
CREATE INDEX IF NOT EXISTS idx_adv_app_status ON advancement_applications(status);

-- 4. 晉升條件達成記錄（每個條件的個人完成紀錄）
CREATE TABLE IF NOT EXISTS advancement_progress (
  id TEXT PRIMARY KEY,
  application_id TEXT,                    -- 關聯到申請（可為空，表示一般記錄）
  member_id TEXT NOT NULL,
  requirement_id TEXT NOT NULL,
  achieved_count INTEGER DEFAULT 0,       -- 已達成數量
  status TEXT DEFAULT 'pending',          -- pending/submitted/approved/rejected
  evidence_note TEXT,                     -- 佐證說明
  admin_note TEXT,
  reviewed_by TEXT,
  reviewed_at DATETIME,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (requirement_id) REFERENCES advancement_requirements(id),
  UNIQUE(member_id, requirement_id)
);

CREATE INDEX IF NOT EXISTS idx_adv_progress_member ON advancement_progress(member_id);
CREATE INDEX IF NOT EXISTS idx_adv_progress_req ON advancement_progress(requirement_id);

-- 5. 補充 leave_requests 的 approved_at 欄位（如果缺少）
-- 注意：SQLite 不支援 ADD COLUMN IF NOT EXISTS，用 IGNORE 方式
-- (leave_requests 已在 migration 0004 建立，這裡僅補充欄位)
-- 增加 approved_at 欄位
ALTER TABLE leave_requests ADD COLUMN approved_at DATETIME;
ALTER TABLE leave_requests ADD COLUMN admin_note TEXT;
ALTER TABLE leave_requests ADD COLUMN session_date TEXT;

-- 6. 預設晉升條件資料（童軍 → 初級童軍）
INSERT OR IGNORE INTO advancement_requirements (id, section, rank_from, rank_to, requirement_type, title, description, required_count, unit, is_mandatory, display_order) VALUES
  ('req-001', '童軍', '見習童軍', '初級童軍', 'attendance', '例會出席', '出席童軍例會次數', 8, '次', 1, 1),
  ('req-002', '童軍', '見習童軍', '初級童軍', 'badge', '基礎技能章', '完成基礎童軍技能測驗', 1, '項', 1, 2),
  ('req-003', '童軍', '見習童軍', '初級童軍', 'service', '服務時數', '參與社區服務活動', 4, '小時', 1, 3),
  ('req-004', '童軍', '見習童軍', '初級童軍', 'test', '誓詞與規律', '背誦童軍誓詞與十二條規律', 1, '次', 1, 4),
  ('req-005', '童軍', '見習童軍', '初級童軍', 'camp', '露營', '參加童軍露營', 1, '次', 0, 5),
-- 初級童軍 → 中級童軍
  ('req-006', '童軍', '初級童軍', '中級童軍', 'attendance', '例會出席', '出席童軍例會次數', 12, '次', 1, 1),
  ('req-007', '童軍', '初級童軍', '中級童軍', 'badge', '技能章', '取得技能章', 3, '章', 1, 2),
  ('req-008', '童軍', '初級童軍', '中級童軍', 'service', '服務時數', '參與社區服務活動', 8, '小時', 1, 3),
  ('req-009', '童軍', '初級童軍', '中級童軍', 'camp', '露營', '參加童軍露營', 2, '次', 1, 4),
  ('req-010', '童軍', '初級童軍', '中級童軍', 'other', '領袖訓練', '擔任小組長或參加領袖訓練', 1, '次', 0, 5),
-- 行義童軍
  ('req-011', '行義童軍', '見習行義', '初級行義', 'attendance', '例會出席', '出席行義例會次數', 8, '次', 1, 1),
  ('req-012', '行義童軍', '見習行義', '初級行義', 'service', '服務時數', '參與社區服務活動', 8, '小時', 1, 2),
  ('req-013', '行義童軍', '見習行義', '初級行義', 'badge', '技能章', '取得技能章', 2, '章', 1, 3),
  ('req-014', '行義童軍', '見習行義', '初級行義', 'camp', '露營', '參加露營', 1, '次', 1, 4),
-- 羅浮童軍
  ('req-015', '羅浮童軍', '見習羅浮', '初級羅浮', 'attendance', '例會出席', '出席羅浮例會次數', 8, '次', 1, 1),
  ('req-016', '羅浮童軍', '見習羅浮', '初級羅浮', 'service', '服務時數', '參與社區服務活動', 12, '小時', 1, 2),
  ('req-017', '羅浮童軍', '見習羅浮', '初級羅浮', 'other', '技藝展示', '展示個人專長或技藝', 1, '次', 1, 3),
  ('req-018', '羅浮童軍', '見習羅浮', '初級羅浮', 'camp', '遠征或探索', '參加遠征或探索活動', 1, '次', 0, 4);
