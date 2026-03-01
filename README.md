# KCISLK 林口康橋圓桌武士童軍團網站

## 專案概覽
- **名稱**：KCISLK Excalibur Knights Scout Groups 林口康橋圓桌武士童軍團
- **目標**：提供具後台管理功能的童軍團網站，方便團員維護網站內容及管理人事資料
- **原始網站**：https://sites.google.com/view/kcislk54
- **參考系統**：https://scout54-manager.fly.dev/

## 已完成功能

### 前台公開頁面
| 路徑 | 說明 |
|------|------|
| `/` | 首頁（活動、公告、分組） |
| `/honor` | 榮譽榜（晉級記錄、成就獎項） |
| `/coaches` | 教練團總覽（依年度列出全體教練） |
| `/stats` | 童軍統計（成員人數、出席率、晉級統計） |
| `/attendance` | 出席記錄查詢（依組別篩選、場次出席率） |
| `/group/:slug` | 分組首頁（學期相冊列表） |
| `/group/:slug/org` | 組織架構 |
| `/group/:slug/cadres` | 現任幹部 |
| `/group/:slug/past-cadres` | 歷屆幹部 |
| `/group/:slug/alumni` | 歷屆名單 |
| `/group/:slug/coaches-list` | 分組教練團（行義科專用） |

### 後台管理功能
| 路徑 | 說明 |
|------|------|
| `/admin` | 儀表板（統計概覽） |
| `/admin/activities` | 活動管理（新增/編輯/刪除/圖片） |
| `/admin/groups` | 分組管理 |
| `/admin/announcements` | 公告管理 |
| `/admin/members` | 成員管理（依組別篩選、搜尋、CRUD） |
| `/admin/members/:id` | 成員詳細頁（出席記錄、進程、領袖獎項） |
| `/admin/members/import` | 成員 CSV 批次匯入（拖曳上傳、預覽、錯誤報告） |
| `/admin/stats` | 統計報表（出席趨勢、進程統計） |
| `/admin/attendance` | 出席管理（場次列表） |
| `/admin/attendance/:id` | 出席點名（單場點名、批次更新） |
| `/admin/progress` | 進程/榮譽管理 |
| `/admin/leaves` | 公假管理 |
| `/admin/coaches` | 教練團管理 |
| `/admin/groups/:id/subpages` | 分組子頁面管理 |
| `/admin/groups/:id/org` | 組織架構管理 |
| `/admin/groups/:id/cadres` | 幹部管理 |
| `/admin/settings` | 網站設定 |

### API 端點（部分）
| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/members` | 取得成員清單（含篩選） |
| GET | `/api/members/:id` | 取得單一成員（含進程、出席） |
| POST/PUT/DELETE | `/api/members` | 成員 CRUD |
| GET | `/api/attendance` | 出席場次列表 |
| GET | `/api/attendance/:id` | 單場出席記錄 |
| POST | `/api/attendance` | 建立場次（自動加入成員） |
| PUT | `/api/attendance/:id/record` | 更新單筆出席 |
| POST | `/api/attendance/:id/bulk` | 批次更新出席 |
| GET/POST/DELETE | `/api/progress` | 進程記錄 |
| GET/POST/PATCH/DELETE | `/api/leaves` | 公假管理 |
| GET/POST/PUT/DELETE | `/api/coaches` | 教練團 |
| GET | `/api/leader-awards` | 領袖獎項定義清單 |
| POST | `/api/leader-awards/member` | 新增成員領袖獎項 |
| DELETE | `/api/leader-awards/member/:id` | 刪除成員領袖獎項 |
| GET | `/api/leader-awards/summary` | 成員最高獎項總覽 |
| GET | `/api/stats` | 整體統計數據 |
| GET | `/api/groups` | 分組資料 |
| GET/POST/PUT/DELETE | `/api/activities` | 活動管理 |
| GET | `/api/announcements` | 公告 |

## 登入帳號
- 帳號：`admin`
- 密碼：`admin123`
- ⚠️ 部署後請立即至資料庫更改密碼

## 資料架構
### 資料庫（Cloudflare D1 SQLite）
| 資料表 | 說明 |
|--------|------|
| `activities` | 活動記錄 |
| `activity_images` | 活動圖片 |
| `scout_groups` | 童軍分組 |
| `group_semesters` | 學期資料 |
| `semester_images` | 學期相冊圖片 |
| `group_org_chart` | 組織架構 |
| `group_cadres` | 幹部資料 |
| `group_alumni` | 歷屆名單 |
| `announcements` | 公告 |
| `banners` | 首頁橫幅 |
| `site_settings` | 網站設定 |
| `admins` | 管理員帳號 |
| `members` | 成員資料（個人資料、在籍狀態） |
| `member_year_records` | 成員年度快照 |
| `attendance_sessions` | 出席場次 |
| `attendance_records` | 出席記錄 |
| `progress_records` | 進程/晉級/榮譽記錄 |
| `leave_requests` | 公假申請 |
| `coach_members` | 教練團成員 |
| `leader_awards` | 領袖獎項定義（12 種） |
| `member_leader_awards` | 成員領袖獎項記錄 |

### 遷移檔案
| 檔案 | 說明 |
|------|------|
| `0001_initial_schema.sql` | 基礎表（活動、分組、公告、設定） |
| `0002_group_semesters.sql` | 學期管理 |
| `0003_add_slug.sql` | 分組 slug 欄位 |
| `0004_members_system.sql` | 成員管理系統 |
| `0005_group_subpages.sql` | 分組子頁面（幹部、名單、組織架構） |
| `0006_leader_awards.sql` | 領袖獎項系統 |

### CSV 匯入格式
```
中文姓名,英文姓名,性別,組別,小隊,職位,級別,所屬團,電話,Email,家長,備注
王小明,Wang Ming,男,童軍,老鷹小隊,隊員,中級童軍,54團,0912345678,,,
```

## 技術架構
- **後端**：Hono + TypeScript
- **前端**：HTML + Tailwind CSS（CDN）+ Font Awesome
- **資料庫**：Cloudflare D1（SQLite）
- **部署**：Cloudflare Pages
- **本地開發**：Wrangler + PM2

## 本地開發指令
```bash
npm run build              # 編譯
npm run db:migrate:local   # 建立/更新本地資料庫
npx wrangler d1 execute webapp-production --local --file=seed.sql  # 載入基礎資料
pm2 start ecosystem.config.cjs  # 啟動服務（port 3000）
pm2 logs --nostream        # 查看記錄（不阻塞）
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

## 待辦事項
- [ ] 實作成員 CSV 匯入的後端 API（目前為前端 UI，需補 POST /api/members/import）
- [ ] 前台首頁 `關於我們` 區塊優化
- [ ] 手機版導覽選單（漢堡選單）
- [ ] 成員照片上傳功能

## 部署狀態
- **平台**：Cloudflare Pages
- **狀態**：🔧 開發中（本地沙盒運行）
- **最後更新**：2026-03-01
