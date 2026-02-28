-- 為 scout_groups 加入 slug 欄位（用於 URL）
ALTER TABLE scout_groups ADD COLUMN slug TEXT;

UPDATE scout_groups SET slug = 'scout-troop' WHERE name = '童軍團';
UPDATE scout_groups SET slug = 'senior-scout' WHERE name = '深資童軍團';
UPDATE scout_groups SET slug = 'rover-scout' WHERE name = '羅浮童軍群';
