-- 種子資料：童軍分組 ID 假設為 1,2,3（對應 seed.sql 的 INSERT 順序）
-- 為「童軍團」(group_id=1) 建立示範學期

INSERT OR IGNORE INTO group_semesters (group_id, semester, title, description, display_order, is_published) VALUES
  (1, '113-1', '113學年度 第1學期', '113學年度第1學期童軍團活動記錄', 1, 1),
  (1, '112-2', '112學年度 第2學期', '112學年度第2學期童軍團活動記錄', 2, 1),
  (1, '112-1', '112學年度 第1學期', '112學年度第1學期童軍團活動記錄', 3, 1);
