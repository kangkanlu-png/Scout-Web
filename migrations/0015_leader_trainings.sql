-- 服務員訓練記錄系統（木章訓練 + 年資獎章）

-- 訓練項目定義表（木章基本訓練 / 木章訓練）
CREATE TABLE IF NOT EXISTS leader_trainings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Basic',  -- Basic / WoodBadge
  display_order INTEGER DEFAULT 99,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 成員木章訓練完成記錄
CREATE TABLE IF NOT EXISTS member_leader_trainings (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  training_id TEXT NOT NULL,
  completed_at DATE,
  certificate_number TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(member_id, training_id),
  FOREIGN KEY (member_id) REFERENCES members(id),
  FOREIGN KEY (training_id) REFERENCES leader_trainings(id)
);

-- 服務年資設定（記錄外團年資與本團起始日期）
CREATE TABLE IF NOT EXISTS member_service_years (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL UNIQUE,
  prior_years REAL DEFAULT 0,             -- 外團年資（可含小數）
  service_start_date DATE,               -- 本團開始日期
  notes TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_member_lt_member ON member_leader_trainings(member_id);
CREATE INDEX IF NOT EXISTS idx_member_lt_training ON member_leader_trainings(training_id);

-- ===== 預設木章基本訓練項目 =====
INSERT OR IGNORE INTO leader_trainings (id, name, category, display_order) VALUES
  ('lt_basic_01', '幼童軍木章基本訓練',   'Basic', 1),
  ('lt_basic_02', '稚齡童軍木章基本訓練', 'Basic', 2),
  ('lt_basic_03', '童軍木章基本訓練',     'Basic', 3),
  ('lt_basic_04', '行義童軍木章基本訓練', 'Basic', 4),
  ('lt_basic_05', '羅浮童軍木章基本訓練', 'Basic', 5),
  ('lt_basic_06', '童軍及行義木章基本訓練','Basic', 6);

-- ===== 預設木章訓練項目 =====
INSERT OR IGNORE INTO leader_trainings (id, name, category, display_order) VALUES
  ('lt_wb_01', '幼童軍木章訓練',   'WoodBadge', 11),
  ('lt_wb_02', '稚齡童軍木章訓練', 'WoodBadge', 12),
  ('lt_wb_03', '童軍木章訓練',     'WoodBadge', 13),
  ('lt_wb_04', '行義童軍木章訓練', 'WoodBadge', 14),
  ('lt_wb_05', '羅浮童軍木章訓練', 'WoodBadge', 15),
  ('lt_wb_06', '童軍及行義木章訓練','WoodBadge', 16);

-- ===== 補充 leader_awards：總會核發獎章（Association） =====
-- 先清除可能衝突的舊資料，再插入標準資料
INSERT OR IGNORE INTO leader_awards (id, name, name_en, category, level, display_order, description) VALUES
  ('la_assoc_01', '銅豹獎章', 'Bronze Leopard Award', 'Association', 1, 101,
    '凡服務員曾領導重要活動對增進童子軍全體之榮譽，及促進童子軍事業之發展有決定性之影響，以及重大貢獻者。'),
  ('la_assoc_02', '銅獅獎章', 'Bronze Lion Award', 'Association', 2, 102,
    '凡服務員曾領導重要活動對增進童子軍全體之榮譽，及促進童子軍事業之發展有重要之影響，以及重大貢獻者。'),
  ('la_assoc_03', '銅鹿獎章', 'Bronze Deer Award', 'Association', 3, 103,
    '凡服務員從事重要活動或服務對增進中華民國童軍榮譽及發展童子軍事業有深遠之影響及優異之貢獻者。'),
  ('la_assoc_04', '銀羊獎章', 'Silver Ram Award', 'Association', 4, 104,
    '凡服務員從事重要活動或服務能任勞任怨，努力工作克盡職責者。'),
  ('la_assoc_05', '銀狼獎章', 'Silver Wolf Award', 'Association', 5, 105,
    '凡服務員曾從事重要童子軍活動努力不懈，負責盡職，其工作精神與績效足為楷模者。'),
  ('la_assoc_06', '銀牛獎章', 'Silver Buffalo Award', 'Association', 6, 106,
    '凡服務員曾從事重要童子軍活動努力不懈，認真負責，犧牲奉獻，其工作精神與績效均具有啟發及示範作用者。');

-- ===== 補充 leader_awards：年資獎章（Service） =====
INSERT OR IGNORE INTO leader_awards (id, name, name_en, category, level, display_order, description) VALUES
  ('la_svc_01', '銅質青松獎章', 'Bronze Green Pine Medal', 'Service', 1, 201,
    '連續擔任團領導人員(包括各類團)二年以上者。'),
  ('la_svc_02', '銅質翠竹獎章', 'Bronze Green Bamboo Medal', 'Service', 2, 202,
    '曾獲得銅質青松獎章並連續擔任團領導人員二年以上者。'),
  ('la_svc_03', '銅質臘梅獎章', 'Bronze Winter Plum Medal', 'Service', 3, 203,
    '曾獲得銅質翠竹獎章並連續擔任團領導人員三年以上者。'),
  ('la_svc_04', '銀質青松獎章', 'Silver Green Pine Medal', 'Service', 4, 204,
    '曾獲得銅質臘梅獎章並繼續擔任團領導人員(包括各類團)三年以上者。'),
  ('la_svc_05', '銀質翠竹獎章', 'Silver Green Bamboo Medal', 'Service', 5, 205,
    '曾獲得銀質青松獎章並繼續擔任團領導人員(包括各類團)五年以上者。'),
  ('la_svc_06', '銀質臘梅獎章', 'Silver Winter Plum Medal', 'Service', 6, 206,
    '曾獲得銀質翠竹獎章並繼續擔任團領導人員(包括各類團)五年以上者。'),
  ('la_svc_07', '金質青松獎章', 'Gold Green Pine Medal', 'Service', 7, 207,
    '曾獲得銀質臘梅獎章並繼續擔任團領導人員(包括各類團)五年以上者。'),
  ('la_svc_08', '金質翠竹獎章', 'Gold Green Bamboo Medal', 'Service', 8, 208,
    '曾獲得金質青松獎章並繼續擔任團領導人員(包括各類團)五年以上者。'),
  ('la_svc_09', '金質臘梅獎章', 'Gold Winter Plum Medal', 'Service', 9, 209,
    '曾獲得金質翠竹獎章並繼續擔任團領導人員(包括各類團)五年以上者。');
