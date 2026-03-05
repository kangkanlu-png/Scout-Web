-- ============================================================
-- Migration 0016: 成員職位定義資料表
-- 支援各童軍階段的職位管理，可透過後台設定新增/刪除/修改
-- ============================================================

CREATE TABLE IF NOT EXISTS member_roles (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  scopes      TEXT,           -- NULL 表示通用(所有階段)，否則為逗號分隔的階段名稱，如 "童軍,行義童軍"
  display_order INTEGER DEFAULT 99,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_member_roles_order ON member_roles(display_order);

-- ============================================================
-- 預設職位資料（依使用者提供的清單）
-- ============================================================

-- 通用職位（適用所有階段）
INSERT OR IGNORE INTO member_roles (id, name, scopes, display_order) VALUES
  ('role_01', '隊員',           NULL, 1),
  ('role_02', '小隊長',         NULL, 2),
  ('role_03', '副小隊長',       NULL, 3),
  ('role_04', '群長',           NULL, 4),
  ('role_05', '副群長',         NULL, 5),
  ('role_06', '群顧問',         NULL, 6),
  ('role_07', '服務員',         NULL, 7);

-- 童軍團專屬職位
INSERT OR IGNORE INTO member_roles (id, name, scopes, display_order) VALUES
  ('role_10', '童軍團器材長',   '童軍', 10),
  ('role_11', '副器材長',       '童軍', 11),
  ('role_12', '行政長',         '童軍', 12),
  ('role_13', '副行政長',       '童軍', 13),
  ('role_14', '考驗營總協',     '童軍', 14),
  ('role_15', '器材組員',       '童軍', 15),
  ('role_16', '行政組員',       '童軍', 16),
  ('role_17', '公關組長',       '童軍', 17),
  ('role_18', '副公關組長',     '童軍', 18),
  ('role_19', '公關組員',       '童軍', 19),
  ('role_20', '展演組長',       '童軍', 20),
  ('role_21', '副展演組長',     '童軍', 21),
  ('role_22', '活動組長',       '童軍', 22),
  ('role_23', '副活動組長',     '童軍', 23);

-- 行義童軍專屬職位
INSERT OR IGNORE INTO member_roles (id, name, scopes, display_order) VALUES
  ('role_30', '聯隊長',         '行義童軍', 30),
  ('role_31', '副聯隊長',       '行義童軍', 31),
  ('role_32', '團長',           '行義童軍', 32),
  ('role_33', '副團長',         '行義童軍', 33),
  ('role_34', '教練團主席',     '行義童軍', 34),
  ('role_35', '總團長',         '行義童軍', 35);

-- 羅浮童軍專屬職位
INSERT OR IGNORE INTO member_roles (id, name, scopes, display_order) VALUES
  ('role_40', '羅浮團長',       '羅浮童軍', 40),
  ('role_41', '羅浮副團長',     '羅浮童軍', 41);

-- 服務員專屬職位  
INSERT OR IGNORE INTO member_roles (id, name, scopes, display_order) VALUES
  ('role_50', '群長',           '服務員', 50),
  ('role_51', '副群長',         '服務員', 51),
  ('role_52', '組長',           '服務員', 52),
  ('role_53', '服務員',         '服務員', 53);
