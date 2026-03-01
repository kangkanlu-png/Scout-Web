-- Migration 0007: Add cover_image and highlight fields to activities
-- 精彩回顧功能：活動相冊封面圖、是否在精彩回顧展示

ALTER TABLE activities ADD COLUMN cover_image TEXT;
ALTER TABLE activities ADD COLUMN activity_type TEXT DEFAULT 'general';
ALTER TABLE activities ADD COLUMN show_in_highlights INTEGER DEFAULT 0;
