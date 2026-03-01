# KCISLK Excalibur Knights Scout Groups 林口康橋圓桌武士童軍團

## 專案概覽
- **名稱**：林口康橋圓桌武士童軍團管理系統
- **原始網站**：https://sites.google.com/view/kcislk54
- **目標**：提供完整的童軍團網站與會員管理平台

## 存取 URL

| 功能 | 網址 |
|------|------|
| 前台首頁 | `http://localhost:3000/` |
| 精彩回顧 | `http://localhost:3000/highlights` |
| 榮譽榜 | `http://localhost:3000/honor` |
| 教練團 | `http://localhost:3000/coaches` |
| 統計 | `http://localhost:3000/stats` |
| 出席公開頁 | `http://localhost:3000/attendance` |
| **會員入口** | `http://localhost:3000/member` |
| **後台管理** | `http://localhost:3000/admin` |

## ✅ 已完成功能

### 前台公開頁面
- 首頁（活動/分組/公告/精彩回顧預覽）
- 分組頁面（童軍/行義童軍/羅浮童軍各子頁）
- 精彩回顧相冊（`/highlights`、`/highlights/:id`）
- 榮譽榜（`/honor`）
- 教練團（`/coaches`）
- 統計頁面（`/stats`）
- 出席記錄（`/attendance`）

### 🆕 會員入口系統（`/member`）
- **會員登入** `/member/login` — 帳號密碼驗證（Cookie Session，7天有效）
- **個人總覽** `/member` — 出席率、請假紀錄、進度記錄、晉升申請狀態卡片
- **晉升進度** `/member/progress` — 視覺化條件完成率（進度條、達成/未達成標記）
- **出席記錄** `/member/attendance` — 個人歷史出席表，快速請假連結
- **請假申請** `/member/leave` — 申請記錄列表
- **新增請假** `/member/leave/new` — 關聯例會選擇、假別、原因表單
- **晉升申請** `/member/advancement` — 提交晉升申請、查看歷史申請狀態

### 後台管理（`/admin`）
- 儀表板統計
- 活動/分組/公告/網站設定管理
- 成員管理（含 CSV 批次匯入）
- 出席點名管理
- 進程/榮譽記錄
- 教練團管理
- 📊 統計報表
- 🆕 **請假審核** `/admin/leaves` — 一覽請假申請、一鍵核准/拒絕
- 🆕 **晉升審核** `/admin/advancement` — 審核晉升申請、更新成員階級
- 🆕 **晉升條件管理** `/admin/advancement/requirements` — 設定各組晉升條件
- 🆕 **會員帳號管理** `/admin/member-accounts` — 建立/重設密碼/啟停用帳號

## 預設帳號

### 後台管理員
- 帳號：`admin` / 密碼：`admin123`（請盡快修改）

### 測試會員帳號
| 帳號 | 密碼 | 對應成員 | 組別 |
|------|------|----------|------|
| scout001 | scout123 | m-001（第一位成員） | 羅浮童軍 |
| scout002 | scout123 | m-002 林雨萱 | 羅浮童軍 |
| scout003 | scout123 | m-003 陳子喬 | 羅浮童軍 |

## 資料架構

### 資料庫（Cloudflare D1 SQLite）

| 表名 | 用途 |
|------|------|
| members | 成員基本資料 |
| **member_accounts** | 🆕 會員帳號（登入用） |
| attendance_sessions | 例會場次 |
| attendance_records | 出席記錄 |
| leave_requests | 請假申請 |
| progress_records | 進程/榮譽記錄 |
| **advancement_requirements** | 🆕 晉升條件定義 |
| **advancement_applications** | 🆕 晉升申請記錄 |
| **advancement_progress** | 🆕 晉升條件個人達成記錄 |
| activities | 活動 |
| activity_images | 活動圖片 |
| scout_groups | 童軍分組 |
| group_semesters | 學期資料 |
| coach_members | 教練資料 |
| leader_awards | 領袖獎項定義 |
| member_leader_awards | 成員領袖獎項 |
| announcements | 公告 |
| site_settings | 網站設定 |

### 主要 API

```
POST /api/member/leave          -- 提交請假申請
DELETE /api/member/leave/:id    -- 取消請假申請
POST /api/member/advancement    -- 提交晉升申請
POST /api/member/advancement-progress -- 提交條件進度

GET  /api/admin/leaves          -- 取得請假申請列表
PUT  /api/admin/leaves/:id      -- 審核請假申請
GET  /api/admin/advancement     -- 取得晉升申請列表
PUT  /api/admin/advancement/:id -- 審核晉升申請
GET/POST /api/admin/advancement-requirements -- 晉升條件管理
GET/POST /api/admin/member-accounts          -- 會員帳號管理
PUT /api/admin/member-accounts/:id/password  -- 重設密碼
PUT /api/admin/member-accounts/:id/status    -- 啟停用帳號
```

## 技術堆疊
- **後端**：Hono + TypeScript（Cloudflare Workers/Pages）
- **前端**：純 HTML + Tailwind CSS + Font Awesome（CDN）
- **資料庫**：Cloudflare D1（SQLite）
- **認證**：Cookie Session（SHA-256 密碼雜湊，Base64 JWT-like）
- **部署**：Cloudflare Pages

## 本地開發

```bash
# 安裝依賴
npm install

# 套用資料庫遷移
npm run db:migrate:local

# 載入種子資料
npm run db:seed

# 建置
npm run build

# 啟動（PM2）
pm2 start ecosystem.config.cjs
```

## 部署資訊
- **平台**：Cloudflare Pages
- **狀態**：✅ 開發中（Sandbox 環境）
- **最後更新**：2026-03-01

## 📋 待開發功能

- [ ] 會員修改自己的密碼
- [ ] 管理員批次建立會員帳號（CSV 匯入）
- [ ] 晉升條件進度的詳細佐證上傳
- [ ] Email 通知（請假審核結果、晉升結果）
- [ ] 活動報名功能
- [ ] 部署至 Cloudflare Pages 正式環境
