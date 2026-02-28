# KCISLK 林口康橋圓桌武士童軍團網站

## 專案概覽
- **名稱**：KCISLK Excalibur Knights Scout Groups 林口康橋圓桌武士童軍團
- **目標**：提供具後台管理功能的童軍團網站，方便團員維護網站內容
- **原始網站**：https://sites.google.com/view/kcislk54

## 網頁結構（仿原站）
| 區塊 | 說明 |
|------|------|
| 導覽列 | 分組、活動、關於我們、後台管理 |
| Hero Banner | 童軍團標題、副標題 |
| 最新公告 | 可於後台新增/隱藏公告 |
| 童軍分組 | Scout Troop / Senior Scout / Rover Scout |
| 活動記錄 | 各類活動（大露營、TECC急救、訓練、服務） |
| 關於我們 | 簡介文字 + Facebook 連結 |
| Footer | 童軍精神標語 |

## 後台管理功能
- **活動管理**：新增/編輯/刪除活動，支援中英文標題、日期、類型、YouTube 影片
- **圖片管理**：每個活動可新增多張圖片（填入圖片URL）
- **童軍分組**：管理分組名稱、年級範圍、說明
- **公告管理**：新增/隱藏公告，支援連結網址
- **網站設定**：修改網站標題、關於我們文字、Facebook 連結

## URLs
- **前台首頁**：http://localhost:3000/
- **後台管理**：http://localhost:3000/admin
- **後台登入**：http://localhost:3000/admin/login

## 登入帳號
- 帳號：`admin`
- 密碼：`admin123`
- ⚠️ 部署後請立即至資料庫更改密碼

## 資料架構
### 資料庫（Cloudflare D1 SQLite）
| 資料表 | 說明 |
|--------|------|
| `activities` | 活動記錄（標題、說明、日期、類型、YouTube ID） |
| `activity_images` | 活動圖片（URL、說明、排序） |
| `scout_groups` | 童軍分組（名稱、年級範圍） |
| `announcements` | 公告（標題、內容、連結） |
| `site_settings` | 網站設定（key-value） |
| `admins` | 管理員帳號 |

### 活動類型
- `general` - 一般活動
- `camping` - 大露營
- `tecc` - TECC 急救訓練
- `training` - 訓練課程
- `service` - 服務活動

## API 端點
| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/activities` | 取得所有活動 |
| POST | `/api/activities` | 新增活動 |
| PUT | `/api/activities/:id` | 更新活動 |
| DELETE | `/api/activities/:id` | 刪除活動 |
| POST | `/api/activities/:id/images` | 新增活動圖片 |
| DELETE | `/api/images/:id` | 刪除圖片 |
| GET | `/api/groups` | 取得童軍分組 |
| GET | `/api/announcements` | 取得公告 |
| GET | `/api/settings` | 取得網站設定 |
| PUT | `/api/settings` | 更新網站設定 |

## 技術架構
- **後端**：Hono + TypeScript
- **前端**：HTML + Tailwind CSS（CDN）+ Font Awesome
- **資料庫**：Cloudflare D1（SQLite）
- **部署**：Cloudflare Pages
- **本地開發**：Wrangler + PM2

## 本地開發指令
```bash
npm run build          # 編譯
npm run db:migrate:local  # 建立本地資料庫
npm run db:seed           # 載入測試資料
pm2 start ecosystem.config.cjs  # 啟動服務
```

## 部署至 Cloudflare Pages
```bash
# 1. 建立 D1 資料庫
npx wrangler d1 create webapp-production
# 將輸出的 database_id 更新至 wrangler.jsonc

# 2. 套用資料庫結構
npx wrangler d1 migrations apply webapp-production

# 3. 部署
npm run deploy
```

## 圖片管理說明
本系統使用圖片 URL 方式管理圖片。建議使用：
1. **Google Drive**：上傳後取得分享連結（需轉換為直連格式）
2. **Imgur**：免費圖床，上傳後直接使用圖片連結
3. **Google Photos**：上傳後取得分享連結

## 部署狀態
- **平台**：Cloudflare Pages
- **狀態**：🔧 開發中（本地沙盒運行）
- **最後更新**：2026-02-28
