-- =====================================================
-- 童軍進程標準種子資料
-- 童軍 / 行義童軍：6 階段
-- 羅浮童軍：3 階段（見習→授銜→服務）
-- =====================================================

-- 清除舊有測試資料（保留正式資料）
-- 先移除只有空 rank_from 的測試資料
DELETE FROM advancement_requirements WHERE section='童軍' AND id LIKE 'req-%' AND LENGTH(id) > 10 AND id NOT IN ('req-001','req-002','req-003','req-004','req-005','req-006','req-007','req-008','req-009','req-010');

-- ======== 童軍組 - 6 個晉升階段 ========

-- 1. 見習童軍 → 初級童軍
INSERT OR IGNORE INTO advancement_requirements
  (id, section, rank_from, rank_to, requirement_type, title, description, required_count, unit, is_mandatory, display_order)
VALUES
  ('adv-scout-01-01','童軍','見習童軍','初級童軍','attendance','完成例會出席','出席至少12次例會',12,'次',1,1),
  ('adv-scout-01-02','童軍','見習童軍','初級童軍','test','完成初級考核','通過初級童軍知識考核',1,'次',1,2),
  ('adv-scout-01-03','童軍','見習童軍','初級童軍','camp','完成露營','參加至少1次隊伍露營活動',1,'次',1,3),
  ('adv-scout-01-04','童軍','見習童軍','初級童軍','badge','取得專科章','取得至少2枚技能章',2,'枚',0,4),
  ('adv-scout-01-05','童軍','見習童軍','初級童軍','service','完成服務時數','累積至少4小時社區服務',4,'小時',0,5);

-- 2. 初級童軍 → 中級童軍
INSERT OR IGNORE INTO advancement_requirements
  (id, section, rank_from, rank_to, requirement_type, title, description, required_count, unit, is_mandatory, display_order)
VALUES
  ('adv-scout-02-01','童軍','初級童軍','中級童軍','attendance','完成例會出席','出席至少16次例會',16,'次',1,1),
  ('adv-scout-02-02','童軍','初級童軍','中級童軍','test','完成中級考核','通過中級童軍知識考核',1,'次',1,2),
  ('adv-scout-02-03','童軍','初級童軍','中級童軍','camp','完成露營','參加至少2次露營活動',2,'次',1,3),
  ('adv-scout-02-04','童軍','初級童軍','中級童軍','badge','取得專科章','取得至少4枚技能章',4,'枚',1,4),
  ('adv-scout-02-05','童軍','初級童軍','中級童軍','service','完成服務時數','累積至少8小時社區服務',8,'小時',1,5),
  ('adv-scout-02-06','童軍','初級童軍','中級童軍','other','完成急救訓練','通過基本急救訓練',1,'次',0,6);

-- 3. 中級童軍 → 高級童軍
INSERT OR IGNORE INTO advancement_requirements
  (id, section, rank_from, rank_to, requirement_type, title, description, required_count, unit, is_mandatory, display_order)
VALUES
  ('adv-scout-03-01','童軍','中級童軍','高級童軍','attendance','完成例會出席','出席至少20次例會',20,'次',1,1),
  ('adv-scout-03-02','童軍','中級童軍','高級童軍','test','完成高級考核','通過高級童軍知識考核',1,'次',1,2),
  ('adv-scout-03-03','童軍','中級童軍','高級童軍','camp','完成野外露營','參加至少1次野外露營',1,'次',1,3),
  ('adv-scout-03-04','童軍','中級童軍','高級童軍','badge','取得進階專科章','取得至少6枚技能章（含1枚進階）',6,'枚',1,4),
  ('adv-scout-03-05','童軍','中級童軍','高級童軍','service','完成服務時數','累積至少16小時社區服務',16,'小時',1,5),
  ('adv-scout-03-06','童軍','中級童軍','高級童軍','other','擔任領袖職務','在隊伍中擔任一期領袖職務',1,'期',0,6);

-- 4. 高級童軍 → 獅級童軍
INSERT OR IGNORE INTO advancement_requirements
  (id, section, rank_from, rank_to, requirement_type, title, description, required_count, unit, is_mandatory, display_order)
VALUES
  ('adv-scout-04-01','童軍','高級童軍','獅級童軍','attendance','完成例會出席','出席至少24次例會',24,'次',1,1),
  ('adv-scout-04-02','童軍','高級童軍','獅級童軍','test','完成獅級考核','通過獅級童軍知識考核',1,'次',1,2),
  ('adv-scout-04-03','童軍','高級童軍','獅級童軍','camp','完成徒步露營','完成至少1次自立式徒步露營',1,'次',1,3),
  ('adv-scout-04-04','童軍','高級童軍','獅級童軍','badge','取得專科章','取得至少8枚技能章',8,'枚',1,4),
  ('adv-scout-04-05','童軍','高級童軍','獅級童軍','service','完成服務時數','累積至少24小時社區服務',24,'小時',1,5),
  ('adv-scout-04-06','童軍','高級童軍','獅級童軍','other','領導小組活動','帶領小組完成至少1次活動',1,'次',1,6);

-- 5. 獅級童軍 → 長城童軍
INSERT OR IGNORE INTO advancement_requirements
  (id, section, rank_from, rank_to, requirement_type, title, description, required_count, unit, is_mandatory, display_order)
VALUES
  ('adv-scout-05-01','童軍','獅級童軍','長城童軍','attendance','完成例會出席','出席至少28次例會',28,'次',1,1),
  ('adv-scout-05-02','童軍','獅級童軍','長城童軍','test','完成長城考核','通過長城童軍知識考核',1,'次',1,2),
  ('adv-scout-05-03','童軍','獅級童軍','長城童軍','camp','完成多日露營','完成至少3天2夜的露營活動',1,'次',1,3),
  ('adv-scout-05-04','童軍','獅級童軍','長城童軍','badge','取得專科章','取得至少10枚技能章',10,'枚',1,4),
  ('adv-scout-05-05','童軍','獅級童軍','長城童軍','service','完成服務計畫','獨立規劃並執行1次服務活動',1,'次',1,5),
  ('adv-scout-05-06','童軍','獅級童軍','長城童軍','other','擔任副隊長','擔任副隊長一學期',1,'學期',0,6);

-- 6. 長城童軍 → 國花童軍
INSERT OR IGNORE INTO advancement_requirements
  (id, section, rank_from, rank_to, requirement_type, title, description, required_count, unit, is_mandatory, display_order)
VALUES
  ('adv-scout-06-01','童軍','長城童軍','國花童軍','attendance','完成例會出席','出席至少32次例會',32,'次',1,1),
  ('adv-scout-06-02','童軍','長城童軍','國花童軍','test','完成國花考核','通過國花童軍知識考核',1,'次',1,2),
  ('adv-scout-06-03','童軍','長城童軍','國花童軍','camp','領導露營活動','帶領規劃並執行露營活動',1,'次',1,3),
  ('adv-scout-06-04','童軍','長城童軍','國花童軍','badge','取得進階專科章','取得至少12枚技能章',12,'枚',1,4),
  ('adv-scout-06-05','童軍','長城童軍','國花童軍','service','完成大型服務','完成1次大型社區服務計畫',1,'次',1,5),
  ('adv-scout-06-06','童軍','長城童軍','國花童軍','other','擔任隊長','擔任隊長一學期',1,'學期',1,6);


-- ======== 行義童軍組 - 6 個晉升階段 ========

-- 1. 見習行義 → 初級行義
INSERT OR IGNORE INTO advancement_requirements
  (id, section, rank_from, rank_to, requirement_type, title, description, required_count, unit, is_mandatory, display_order)
VALUES
  ('adv-senior-01-01','行義童軍','見習行義','初級行義','attendance','完成例會出席','出席至少12次例會',12,'次',1,1),
  ('adv-senior-01-02','行義童軍','見習行義','初級行義','test','完成初級考核','通過初級行義知識考核',1,'次',1,2),
  ('adv-senior-01-03','行義童軍','見習行義','初級行義','service','完成服務時數','累積至少6小時社區服務',6,'小時',1,3),
  ('adv-senior-01-04','行義童軍','見習行義','初級行義','camp','完成露營活動','參加至少1次露營活動',1,'次',0,4);

-- 2. 初級行義 → 中級行義
INSERT OR IGNORE INTO advancement_requirements
  (id, section, rank_from, rank_to, requirement_type, title, description, required_count, unit, is_mandatory, display_order)
VALUES
  ('adv-senior-02-01','行義童軍','初級行義','中級行義','attendance','完成例會出席','出席至少16次例會',16,'次',1,1),
  ('adv-senior-02-02','行義童軍','初級行義','中級行義','test','完成中級考核','通過中級行義知識考核',1,'次',1,2),
  ('adv-senior-02-03','行義童軍','初級行義','中級行義','service','完成服務時數','累積至少12小時社區服務',12,'小時',1,3),
  ('adv-senior-02-04','行義童軍','初級行義','中級行義','badge','取得技能章','取得至少3枚技能章',3,'枚',1,4),
  ('adv-senior-02-05','行義童軍','初級行義','中級行義','camp','完成露營活動','參加至少2次露營活動',2,'次',0,5);

-- 3. 中級行義 → 高級行義
INSERT OR IGNORE INTO advancement_requirements
  (id, section, rank_from, rank_to, requirement_type, title, description, required_count, unit, is_mandatory, display_order)
VALUES
  ('adv-senior-03-01','行義童軍','中級行義','高級行義','attendance','完成例會出席','出席至少20次例會',20,'次',1,1),
  ('adv-senior-03-02','行義童軍','中級行義','高級行義','test','完成高級考核','通過高級行義知識考核',1,'次',1,2),
  ('adv-senior-03-03','行義童軍','中級行義','高級行義','service','完成服務計畫','規劃執行1次服務活動',1,'次',1,3),
  ('adv-senior-03-04','行義童軍','中級行義','高級行義','badge','取得技能章','取得至少5枚技能章',5,'枚',1,4),
  ('adv-senior-03-05','行義童軍','中級行義','高級行義','camp','完成野外活動','完成至少1次野外技能活動',1,'次',1,5);

-- 4. 高級行義 → 獅級行義
INSERT OR IGNORE INTO advancement_requirements
  (id, section, rank_from, rank_to, requirement_type, title, description, required_count, unit, is_mandatory, display_order)
VALUES
  ('adv-senior-04-01','行義童軍','高級行義','獅級行義','attendance','完成例會出席','出席至少24次例會',24,'次',1,1),
  ('adv-senior-04-02','行義童軍','高級行義','獅級行義','test','完成獅級考核','通過獅級行義知識考核',1,'次',1,2),
  ('adv-senior-04-03','行義童軍','高級行義','獅級行義','service','完成大型服務','帶領完成1次大型社區服務',1,'次',1,3),
  ('adv-senior-04-04','行義童軍','高級行義','獅級行義','badge','取得技能章','取得至少7枚技能章',7,'枚',1,4),
  ('adv-senior-04-05','行義童軍','高級行義','獅級行義','other','擔任領袖','擔任隊伍領袖職務一學期',1,'學期',0,5);

-- 5. 獅級行義 → 長城行義
INSERT OR IGNORE INTO advancement_requirements
  (id, section, rank_from, rank_to, requirement_type, title, description, required_count, unit, is_mandatory, display_order)
VALUES
  ('adv-senior-05-01','行義童軍','獅級行義','長城行義','attendance','完成例會出席','出席至少28次例會',28,'次',1,1),
  ('adv-senior-05-02','行義童軍','獅級行義','長城行義','test','完成長城考核','通過長城行義知識考核',1,'次',1,2),
  ('adv-senior-05-03','行義童軍','獅級行義','長城行義','service','完成持續服務','持續參與社區服務計畫',24,'小時',1,3),
  ('adv-senior-05-04','行義童軍','獅級行義','長城行義','badge','取得技能章','取得至少9枚技能章',9,'枚',1,4),
  ('adv-senior-05-05','行義童軍','獅級行義','長城行義','other','擔任副隊長','擔任副隊長職務',1,'學期',0,5);

-- 6. 長城行義 → 國花行義
INSERT OR IGNORE INTO advancement_requirements
  (id, section, rank_from, rank_to, requirement_type, title, description, required_count, unit, is_mandatory, display_order)
VALUES
  ('adv-senior-06-01','行義童軍','長城行義','國花行義','attendance','完成例會出席','出席至少32次例會',32,'次',1,1),
  ('adv-senior-06-02','行義童軍','長城行義','國花行義','test','完成國花考核','通過國花行義知識考核',1,'次',1,2),
  ('adv-senior-06-03','行義童軍','長城行義','國花行義','service','完成公益計畫','完成1次大型公益服務計畫',1,'次',1,3),
  ('adv-senior-06-04','行義童軍','長城行義','國花行義','badge','取得技能章','取得至少11枚技能章',11,'枚',1,4),
  ('adv-senior-06-05','行義童軍','長城行義','國花行義','other','擔任隊長','擔任隊長職務一學期',1,'學期',1,5);


-- ======== 羅浮童軍組 - 3 個晉升階段 ========

-- 1. 見習羅浮 → 授銜羅浮
INSERT OR IGNORE INTO advancement_requirements
  (id, section, rank_from, rank_to, requirement_type, title, description, required_count, unit, is_mandatory, display_order)
VALUES
  ('adv-rover-01-01','羅浮童軍','見習羅浮','授銜羅浮','attendance','完成例會出席','出席至少16次例會',16,'次',1,1),
  ('adv-rover-01-02','羅浮童軍','見習羅浮','授銜羅浮','test','完成授銜考核','通過羅浮授銜知識考核',1,'次',1,2),
  ('adv-rover-01-03','羅浮童軍','見習羅浮','授銜羅浮','service','完成服務時數','累積至少20小時社區服務',20,'小時',1,3),
  ('adv-rover-01-04','羅浮童軍','見習羅浮','授銜羅浮','camp','完成野外活動','參加至少2次野外活動',2,'次',1,4),
  ('adv-rover-01-05','羅浮童軍','見習羅浮','授銜羅浮','other','完成羅浮精神研習','完成羅浮精神及使命研習課程',1,'次',1,5),
  ('adv-rover-01-06','羅浮童軍','見習羅浮','授銜羅浮','badge','取得專科章','取得至少4枚進階技能章',4,'枚',0,6);

-- 2. 授銜羅浮 → 服務羅浮
INSERT OR IGNORE INTO advancement_requirements
  (id, section, rank_from, rank_to, requirement_type, title, description, required_count, unit, is_mandatory, display_order)
VALUES
  ('adv-rover-02-01','羅浮童軍','授銜羅浮','服務羅浮','attendance','完成例會出席','出席至少20次例會',20,'次',1,1),
  ('adv-rover-02-02','羅浮童軍','授銜羅浮','服務羅浮','service','完成長期服務','累積至少50小時志願服務',50,'小時',1,2),
  ('adv-rover-02-03','羅浮童軍','授銜羅浮','服務羅浮','other','完成服務計畫','獨立規劃並執行1個大型服務計畫',1,'次',1,3),
  ('adv-rover-02-04','羅浮童軍','授銜羅浮','服務羅浮','camp','帶領野外活動','帶領組織至少1次野外活動',1,'次',1,4),
  ('adv-rover-02-05','羅浮童軍','授銜羅浮','服務羅浮','test','完成進階訓練','完成羅浮進階領導力訓練',1,'次',1,5),
  ('adv-rover-02-06','羅浮童軍','授銜羅浮','服務羅浮','badge','取得高階技能章','取得至少6枚高階技能章',6,'枚',0,6);
