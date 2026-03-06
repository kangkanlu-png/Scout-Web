-- 統計功能增強：羅浮童軍地理分佈
-- 為 members 表加入 country（所在國家）和 university（就讀學校/工作地點）

ALTER TABLE members ADD COLUMN country TEXT DEFAULT NULL;
ALTER TABLE members ADD COLUMN university TEXT DEFAULT NULL;

-- site_settings 表用於儲存羅浮童軍地圖座標（rover_map_coord_*）
-- site_settings 已存在，不需新增
