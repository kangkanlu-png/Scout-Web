import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

type Bindings = {
  DB: D1Database
}

export const memberRoutes = new Hono<{ Bindings: Bindings }>()

// ===================== 工具函數 =====================

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function generateSessionId(): string {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function getMemberSession(c: any): Promise<{ memberId: string; memberName: string; section: string } | null> {
  const session = getCookie(c, 'member_session')
  if (!session) return null
  try {
    // UTF-8 safe Base64 解碼
    const binary = atob(session)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const decoded = new TextDecoder().decode(bytes)
    const data = JSON.parse(decoded)
    if (!data.memberId || !data.exp || Date.now() > data.exp) return null
    return data
  } catch {
    return null
  }
}

async function memberAuthMiddleware(c: any, next: any) {
  const session = await getMemberSession(c)
  if (!session) {
    return c.redirect('/member/login')
  }
  c.set('memberSession', session)
  await next()
}

function memberHead(title: string) {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - 童軍團會員入口</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    .hero-gradient { background: linear-gradient(135deg, #1a472a 0%, #2d6a4f 50%, #40916c 100%); }
    .card-hover { transition: transform 0.2s, box-shadow 0.2s; }
    .card-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.15); }
    .status-pending { background:#fef3c7; color:#92400e; }
    .status-approved { background:#d1fae5; color:#065f46; }
    .status-rejected { background:#fee2e2; color:#991b1b; }
    .status-reviewing { background:#dbeafe; color:#1e40af; }
    .progress-bar { transition: width 0.8s ease; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    .fade-in { animation: fadeIn 0.4s ease forwards; }
  </style>
</head>`
}

function memberNav(memberName: string, section: string, activePage?: string) {
  const sectionIcon = section.includes('羅浮') ? '⚜️' : section.includes('行義') ? '🔰' : '🏕️'
  const navItems = [
    { href: '/member',            icon: 'fas fa-th-large',      label: '總覽',   key: 'home' },
    { href: '/member/attendance', icon: 'fas fa-calendar-check', label: '出席',   key: 'attendance' },
    { href: '/member/progress',   icon: 'fas fa-chart-line',    label: '晉升',   key: 'progress' },
    { href: '/member/activities', icon: 'fas fa-campground',    label: '活動',   key: 'activities' },
  ]
  return `
<nav class="bg-[#1a472a] text-white shadow-lg sticky top-0 z-50">
  <div class="max-w-5xl mx-auto px-4">
    <div class="flex items-center justify-between h-14">
      <div class="flex items-center gap-3">
        <a href="/" class="text-lg font-bold text-yellow-400 hover:text-yellow-300 flex items-center gap-2">
          <i class="fas fa-home text-sm"></i>
          <span class="hidden sm:inline">童軍團</span>
        </a>
        <span class="text-green-400 text-sm">/</span>
        <a href="/member" class="text-white font-semibold flex items-center gap-1">
          <i class="fas fa-user-circle"></i>
          <span class="hidden sm:inline">會員入口</span>
        </a>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-yellow-400 text-sm hidden sm:inline">${sectionIcon} ${memberName}</span>
        <a href="/member/logout" class="bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-full transition-colors">
          <i class="fas fa-sign-out-alt mr-1"></i>登出
        </a>
      </div>
    </div>
    <div class="flex gap-1 pb-2 overflow-x-auto">
      ${navItems.map(item => {
        const isActive = activePage === item.key || (!activePage && item.key === 'home')
        return `<a href="${item.href}" class="text-xs whitespace-nowrap px-3 py-1 rounded-full transition-colors flex items-center gap-1 ${isActive ? 'bg-white text-[#1a472a] font-semibold' : 'bg-white/10 hover:bg-white/20'}">
          <i class="${item.icon}"></i>${item.label}
        </a>`
      }).join('')}
    </div>
  </div>
</nav>`
}

function weekdayLabel(dow: number): string {
  return ['日','一','二','三','四','五','六'][dow] || ''
}

// ===================== 登入頁面 =====================
memberRoutes.get('/login', async (c) => {
  const session = await getMemberSession(c)
  if (session) return c.redirect('/member')
  const error = c.req.query('error')
  return c.html(`${memberHead('登入')}
<body class="bg-gradient-to-br from-green-900 to-green-700 min-h-screen flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden fade-in">
    <div class="hero-gradient text-white p-8 text-center">
      <div class="text-6xl mb-3">⚜️</div>
      <h1 class="text-2xl font-bold">會員入口</h1>
      <p class="text-green-200 text-sm mt-1">林口康橋童軍團</p>
    </div>
    <div class="p-6">
      ${error === '1' ? `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
        <i class="fas fa-exclamation-circle"></i>帳號或密碼錯誤，請重試。
      </div>` : ''}
      ${error === '2' ? `<div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
        <i class="fas fa-info-circle"></i>帳號已停用，請聯繫管理員。
      </div>` : ''}
      <form method="POST" action="/member/login" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">會員帳號</label>
          <input type="text" name="username" required autofocus
            class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            placeholder="請輸入帳號（如 scout001）">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">密碼</label>
          <input type="password" name="password" required
            class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            placeholder="請輸入密碼">
        </div>
        <button type="submit"
          class="w-full bg-green-700 hover:bg-green-600 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
          <i class="fas fa-sign-in-alt"></i>登入會員入口
        </button>
      </form>
      <div class="mt-4 text-center text-xs text-gray-400">
        忘記密碼或尚未開通帳號？請聯繫童軍團管理員<br>
        <a href="/admin" class="text-green-600 hover:underline mt-1 inline-block">管理員登入</a>
      </div>
    </div>
  </div>
</body></html>`)
})

memberRoutes.post('/login', async (c) => {
  const db = c.env.DB
  const body = await c.req.parseBody()
  const username = String(body.username || '').trim().toLowerCase()
  const password = String(body.password || '')

  if (!username || !password) return c.redirect('/member/login?error=1')

  const hash = await sha256(password)
  const account = await db.prepare(`
    SELECT ma.*, m.chinese_name, m.section, m.rank_level, m.membership_status
    FROM member_accounts ma
    JOIN members m ON m.id = ma.member_id
    WHERE ma.username = ? AND ma.password_hash = ?
  `).bind(username, hash).first() as any

  if (!account) return c.redirect('/member/login?error=1')
  if (!account.is_active) return c.redirect('/member/login?error=2')

  // 更新最後登入時間
  await db.prepare(`UPDATE member_accounts SET last_login = CURRENT_TIMESTAMP WHERE id = ?`).bind(account.id).run()

  // 建立 session（UTF-8 safe Base64 編碼，7天有效）
  const sessionData = JSON.stringify({
    memberId: account.member_id,
    memberName: account.chinese_name,
    section: account.section,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000
  })
  // 使用 TextEncoder 確保中文可正確 Base64 編碼
  const sessionBytes = new TextEncoder().encode(sessionData)
  const sessionToken = btoa(String.fromCharCode(...sessionBytes))

  setCookie(c, 'member_session', sessionToken, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
    sameSite: 'Lax'
  })

  return c.redirect('/member')
})

memberRoutes.get('/logout', (c) => {
  deleteCookie(c, 'member_session', { path: '/' })
  return c.redirect('/member/login')
})

// ===================== 會員首頁（總覽） =====================
memberRoutes.get('/', memberAuthMiddleware, async (c) => {
  const db = c.env.DB
  const sess = c.get('memberSession') as any
  const memberId = sess.memberId

  // 取得完整成員資料
  const member = await db.prepare(`SELECT * FROM members WHERE id = ?`).bind(memberId).first() as any
  if (!member) return c.redirect('/member/login')

  // 取得今年在籍資料（含小隊、職位、進程）
  const yearSetting = await db.prepare(`SELECT value FROM site_settings WHERE key='current_year_label'`).first() as any
  const currentYear = yearSetting?.value || '114'
  const enrollment = await db.prepare(`
    SELECT * FROM member_enrollments WHERE member_id=? AND year_label=? AND is_active=1
  `).bind(memberId, currentYear).first() as any

  // 年度在籍資料優先，否則用主表
  const displaySection = enrollment?.section || member.section
  const displayUnit = enrollment?.unit_name || member.unit_name
  const displayRank = enrollment?.rank_level || member.rank_level
  const displayRole = enrollment?.role_name || member.role_name

  // 取得出席統計
  const attendStats = await db.prepare(`
    SELECT
      COUNT(DISTINCT ar.session_id) as present_count,
      (SELECT COUNT(*) FROM attendance_sessions WHERE section = ? OR section = 'all') as total_count
    FROM attendance_records ar
    WHERE ar.member_id = ? AND ar.status = 'present'
  `).bind(displaySection, memberId).first() as any

  // 取得請假記錄（最近 5 筆）
  const recentLeaves = await db.prepare(`
    SELECT lr.*, COALESCE(as2.title, '自填日期') as session_title
    FROM leave_requests lr
    LEFT JOIN attendance_sessions as2 ON as2.id = lr.session_id
    WHERE lr.member_id = ?
    ORDER BY lr.created_at DESC LIMIT 5
  `).bind(memberId).all()

  // 取得進度記錄（最近 5 筆）
  const recentProgress = await db.prepare(`
    SELECT * FROM progress_records WHERE member_id = ? ORDER BY awarded_at DESC LIMIT 5
  `).bind(memberId).all()

  // 取得晉升申請
  const advApplications = await db.prepare(`
    SELECT * FROM advancement_applications WHERE member_id = ? ORDER BY created_at DESC LIMIT 3
  `).bind(memberId).all()

  // 教練團進程資料
  const coachStatus = await db.prepare(`SELECT * FROM coach_member_status WHERE member_id = ?`).bind(memberId).first() as any
  const coachItems = coachStatus ? await db.prepare(`SELECT * FROM coach_checklist_items WHERE stage = ? ORDER BY display_order`).bind(coachStatus.current_stage).all() : { results: [] }
  const coachCompletions = coachStatus ? await db.prepare(`SELECT item_id FROM coach_checklist_completions WHERE member_id = ?`).bind(memberId).all() : { results: [] }
  const coachDoneIds = new Set((coachCompletions.results as any[]).map((r: any) => r.item_id))

  // 計算出席率
  const presentCount = attendStats?.present_count || 0
  const totalCount = Math.max(attendStats?.total_count || 1, 1)
  const attendRate = Math.round((presentCount / totalCount) * 100)

  const sectionBadge: Record<string, string> = {
    '童軍': 'bg-blue-100 text-blue-800',
    '行義童軍': 'bg-purple-100 text-purple-800',
    '羅浮童軍': 'bg-green-100 text-green-800'
  }

  return c.html(`${memberHead('個人總覽')}
<body class="bg-gray-50 min-h-screen">
  ${memberNav(member.chinese_name, displaySection, 'home')}
  <div class="max-w-5xl mx-auto px-4 py-6 fade-in">

    <!-- 個人資訊卡 -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div class="w-16 h-16 rounded-full bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center text-white text-2xl font-bold shadow-md flex-shrink-0">
          ${member.chinese_name.charAt(0)}
        </div>
        <div class="flex-1">
          <div class="flex flex-wrap items-center gap-2 mb-1">
            <h1 class="text-2xl font-bold text-gray-800">${member.chinese_name}</h1>
            ${member.english_name ? `<span class="text-gray-400 text-sm">${member.english_name}</span>` : ''}
            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${sectionBadge[displaySection] || 'bg-gray-100 text-gray-700'}">${displaySection}</span>
            ${enrollment ? `<span class="px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 border border-green-200">${currentYear}學年</span>` : ''}
          </div>
          <div class="flex flex-wrap gap-3 text-sm text-gray-500">
            <span><i class="fas fa-medal mr-1 text-yellow-500"></i>${displayRank || '未設定階級'}</span>
            <span><i class="fas fa-user-tag mr-1 text-blue-500"></i>${displayRole || '隊員'}</span>
            <span><i class="fas fa-users mr-1 text-green-500"></i>${member.troop || '54團'}</span>
            ${displayUnit ? `<span><i class="fas fa-sitemap mr-1 text-purple-500"></i>${displayUnit}</span>` : ''}
          </div>
        </div>
        <div class="flex gap-2 flex-wrap">
          <a href="/member/progress" class="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-1">
            <i class="fas fa-chart-line"></i>查看進度
          </a>
          <a href="/member/attendance?tab=leave" class="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-1">
            <i class="fas fa-calendar-plus"></i>申請請假
          </a>
        </div>
      </div>
    </div>

    <!-- 統計卡片 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 card-hover">
        <div class="text-3xl font-bold text-green-600">${attendRate}%</div>
        <div class="text-xs text-gray-500 mt-1"><i class="fas fa-calendar-check mr-1"></i>出席率</div>
        <div class="text-xs text-gray-400">${presentCount}/${totalCount} 場</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 card-hover">
        <div class="text-3xl font-bold text-blue-600">${recentLeaves.results.length}</div>
        <div class="text-xs text-gray-500 mt-1"><i class="fas fa-calendar-times mr-1"></i>請假紀錄</div>
        <div class="text-xs text-gray-400">近期申請</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 card-hover">
        <div class="text-3xl font-bold text-purple-600">${recentProgress.results.length}</div>
        <div class="text-xs text-gray-500 mt-1"><i class="fas fa-trophy mr-1"></i>進度記錄</div>
        <div class="text-xs text-gray-400">已獲得</div>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 card-hover">
        <div class="text-3xl font-bold text-orange-600">${advApplications.results.length}</div>
        <div class="text-xs text-gray-500 mt-1"><i class="fas fa-arrow-up mr-1"></i>晉升申請</div>
        <div class="text-xs text-gray-400">歷史記錄</div>
      </div>
    </div>

    <div class="grid sm:grid-cols-2 gap-6">
      <!-- 最近請假 -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100">
        <div class="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 class="font-semibold text-gray-800 flex items-center gap-2">
            <i class="fas fa-calendar-times text-blue-500"></i>最近請假
          </h2>
          <a href="/member/attendance?tab=leave" class="text-xs text-green-600 hover:underline">全部查看</a>
        </div>
        <div class="p-4 space-y-2">
          ${recentLeaves.results.length === 0 ? `<p class="text-gray-400 text-sm text-center py-4">尚無請假記錄</p>` :
            recentLeaves.results.map((l: any) => `
            <div class="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-gray-50">
              <div>
                <div class="font-medium text-gray-700">${l.session_title || l.date}</div>
                <div class="text-xs text-gray-400">${l.leave_type === 'official' ? '⚡ 公假' : l.leave_type === 'sick' ? '🏥 病假' : '📝 事假'} · ${l.date}</div>
              </div>
              <span class="px-2 py-0.5 rounded-full text-xs font-medium status-${l.status}">
                ${l.status === 'pending' ? '待審' : l.status === 'approved' ? '已核准' : l.status === 'rejected' ? '未核准' : l.status}
              </span>
            </div>`).join('')
          }
          <a href="/member/attendance?tab=leave" class="block w-full text-center py-2 mt-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm rounded-lg transition-colors">
            <i class="fas fa-plus mr-1"></i>新增請假申請
          </a>
        </div>
      </div>

      <!-- 最近進度 -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100">
        <div class="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 class="font-semibold text-gray-800 flex items-center gap-2">
            <i class="fas fa-trophy text-yellow-500"></i>最近進度
          </h2>
          <a href="/member/progress" class="text-xs text-green-600 hover:underline">查看全部</a>
        </div>
        <div class="p-4 space-y-2">
          ${recentProgress.results.length === 0 ? `<p class="text-gray-400 text-sm text-center py-4">尚無進度記錄</p>` :
            recentProgress.results.map((p: any) => `
            <div class="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-gray-50">
              <div class="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <i class="fas fa-medal text-yellow-600 text-xs"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-700 truncate">${p.award_name}</div>
                <div class="text-xs text-gray-400">${p.year_label || ''} · ${p.record_type}</div>
              </div>
            </div>`).join('')
          }
        </div>
      </div>
    </div>

    <!-- 晉升申請狀態 -->
    ${advApplications.results.length > 0 ? `
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
      <div class="p-4 border-b border-gray-100 flex items-center justify-between">
        <h2 class="font-semibold text-gray-800 flex items-center gap-2">
          <i class="fas fa-arrow-circle-up text-green-500"></i>晉升申請狀態
        </h2>
        <a href="/member/progress?tab=advancement" class="text-xs text-green-600 hover:underline">查看詳情</a>
      </div>
      <div class="p-4 space-y-2">
        ${advApplications.results.map((a: any) => `
        <div class="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
          <div>
            <span class="font-medium text-gray-800">${a.rank_from} → ${a.rank_to}</span>
            <div class="text-xs text-gray-400 mt-0.5">申請日期：${a.apply_date}</div>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-medium status-${a.status}">
            ${a.status === 'pending' ? '⏳ 待審核' : a.status === 'approved' ? '✅ 已通過' : a.status === 'rejected' ? '❌ 未通過' : a.status === 'reviewing' ? '🔍 審核中' : a.status}
          </span>
        </div>`).join('')}
      </div>
    </div>` : ''}

    ${coachStatus ? `
    <!-- 教練團進程 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
      <div class="p-4 border-b border-gray-100 flex items-center justify-between">
        <h2 class="font-semibold text-gray-800 flex items-center gap-2">
          <i class="fas fa-chalkboard-teacher text-emerald-600"></i>教練團進程
        </h2>
        <span class="px-3 py-1 rounded-full text-xs font-semibold ${coachStatus.current_stage === '指導教練' ? 'bg-purple-100 text-purple-800' : coachStatus.current_stage === '助理教練' ? 'bg-blue-100 text-blue-800' : coachStatus.current_stage === '見習教練' ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-700'}">
          ${coachStatus.current_stage}
        </span>
      </div>
      <div class="p-4">
        ${coachItems.results.length === 0 ? '<p class="text-sm text-gray-400 text-center py-4">此階段尚無檢核項目</p>' : (() => {
          const items = coachItems.results as any[]
          const doneCount = items.filter((it: any) => coachDoneIds.has(it.id)).length
          const pct = Math.round(doneCount / items.length * 100)
          return `
          <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>晉升條件進度</span><span class="${pct>=100?'text-green-600 font-semibold':'text-gray-400'}">${doneCount}/${items.length}</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2 mb-3">
            <div class="h-2 rounded-full ${pct>=100?'bg-green-500':'bg-teal-400'}" style="width:${pct}%"></div>
          </div>
          <div class="space-y-2">
            ${items.map((it: any) => {
              const done = coachDoneIds.has(it.id)
              return `<div class="flex items-center gap-2 text-sm ${done?'text-green-700':'text-gray-600'}">
                <i class="fas ${done?'fa-check-circle text-green-500':'fa-circle text-gray-300'} text-sm flex-shrink-0"></i>
                <span class="${done?'line-through opacity-60':''}">${it.description}</span>
                ${it.required_count>1?`<span class="text-xs text-gray-400 ml-auto">×${it.required_count}</span>`:''}
              </div>`
            }).join('')}
          </div>
          ${pct>=100?`<div class="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-center text-sm text-green-700 font-medium">
            🎉 已完成所有晉升條件！請聯繫服務員申請晉升。
          </div>`:''}
          `
        })()}
      </div>
    </div>` : ''}

  </div>
</body></html>`)
})

// ===================== 晉升進度頁面 =====================
memberRoutes.get('/progress', memberAuthMiddleware, async (c) => {
  const db = c.env.DB
  const sess = c.get('memberSession') as any
  const memberId = sess.memberId
  const activeTab = c.req.query('tab') || 'progress'

  const member = await db.prepare(`SELECT * FROM members WHERE id = ?`).bind(memberId).first() as any
  if (!member) return c.redirect('/member/login')

  // 取得所有進度記錄
  const progressRecords = await db.prepare(`
    SELECT * FROM progress_records WHERE member_id = ? ORDER BY awarded_at DESC
  `).bind(memberId).all()

  // 取得本組全部啟用的晉升條件（按 rank_to 分組，顯示「升到哪個階段需要做什麼」）
  const requirements = await db.prepare(`
    SELECT * FROM advancement_requirements
    WHERE section = ? AND is_active = 1
    ORDER BY rank_from, display_order, id
  `).bind(member.section).all()

  // 取得個人晉升進度回報
  const advProgress = await db.prepare(`
    SELECT ap.*, ar.title as req_title, ar.required_count, ar.unit, ar.requirement_type
    FROM advancement_progress ap
    JOIN advancement_requirements ar ON ar.id = ap.requirement_id
    WHERE ap.member_id = ?
  `).bind(memberId).all()

  const progressMap: Record<string, any> = {}
  advProgress.results.forEach((p: any) => { progressMap[p.requirement_id] = p })

  // 計算出席場次（給 attendance 類型使用）
  const attendCount = await db.prepare(`
    SELECT COUNT(*) as cnt FROM attendance_records WHERE member_id = ? AND status = 'present'
  `).bind(memberId).first() as any
  const myAttend = attendCount?.cnt || 0

  // 各條件達成判斷函式
  function isReqDone(req: any): boolean {
    if (req.requirement_type === 'attendance') return myAttend >= req.required_count
    const prog = progressMap[req.id]
    return prog && (prog.achieved_count >= req.required_count || prog.status === 'approved')
  }
  function getAchieved(req: any): number {
    if (req.requirement_type === 'attendance') return myAttend
    return progressMap[req.id]?.achieved_count || 0
  }

  // 按 rank_to（目標階段）分組
  const groupsByTarget: Record<string, any[]> = {}
  requirements.results.forEach((req: any) => {
    const k = req.rank_to
    if (!groupsByTarget[k]) groupsByTarget[k] = []
    groupsByTarget[k].push(req)
  })

  // 正確的階段順序（依組別）
  const sectionRankOrder: Record<string, string[]> = {
    '童軍':    ['初級童軍','中級童軍','高級童軍','獅級童軍','長城童軍','國花童軍'],
    '行義童軍': ['見習童軍','初級童軍','中級童軍','高級童軍','獅級童軍','長城童軍','國花童軍'],
    '羅浮童軍': ['授銜羅浮','服務羅浮'],
  }
  const rankOrder = sectionRankOrder[member.section] || []
  const orderedTargets = [
    ...rankOrder.filter(r => groupsByTarget[r]),
    ...Object.keys(groupsByTarget).filter(r => !rankOrder.includes(r))
  ]

  // 找出「當前應該升級的階段」（rank_from === 目前階級）
  const currentRank = member.rank_level || ''

  // 取得晉升申請中的進行中申請
  const activeApp = await db.prepare(`
    SELECT * FROM advancement_applications
    WHERE member_id = ? AND status IN ('pending','reviewing')
    ORDER BY created_at DESC LIMIT 1
  `).bind(memberId).first() as any

  // ===== 教練團進程資料 =====
  const coachStatusProg = await db.prepare(`SELECT * FROM coach_member_status WHERE member_id = ?`).bind(memberId).first() as any
  const coachChecklistAll = coachStatusProg
    ? await db.prepare(`SELECT * FROM coach_checklist_items ORDER BY stage, display_order`).all()
    : { results: [] }
  const coachCompletionsProg = coachStatusProg
    ? await db.prepare(`SELECT item_id FROM coach_checklist_completions WHERE member_id = ?`).bind(memberId).all()
    : { results: [] }
  const coachDoneSetProg = new Set((coachCompletionsProg.results as any[]).map((r: any) => r.item_id))

  // 取得專科章資料（用於進程頁面的晉級檢核區塊）
  const allBadgesProgress = await db.prepare(`SELECT * FROM specialty_badges WHERE is_active=1 ORDER BY category, display_order`).all()
  const myBadgesProgress = await db.prepare(`
    SELECT msb.badge_id, sb.name, sb.category, msb.obtained_date
    FROM member_specialty_badges msb
    JOIN specialty_badges sb ON sb.id = msb.badge_id
    WHERE msb.member_id = ?
  `).bind(memberId).all()
  const myBadgeSetProgress = new Set(myBadgesProgress.results.map((b:any) => b.name))
  const myBadgeCountProgress = myBadgesProgress.results.length

  // ===== 全域必備章清單（不論哪個階段，這些章都是「保留給必備用途」的）=====
  // 擇一組的每個選項都計入，因為任一個都可能是某個階段的必備章
  const ALL_REQUIRED_BADGE_NAMES = new Set([
    '露營', '旅行', '社區公民',          // 獅級固定必備
    '國家公民', '急救',                    // 長城固定必備
    '游泳', '自行車', '越野',              // 長城擇一
    '世界公民', '生態保育', '測量',        // 國花固定必備
    '植物', '昆蟲', '賞鳥',               // 國花生物擇一
    '音樂', '舞蹈', '攝影'                // 國花藝術擇一
  ])

  // 純自選章（排除所有必備章名稱）
  const pureElectiveBadges = myBadgesProgress.results.filter((b:any) => !ALL_REQUIRED_BADGE_NAMES.has(b.name))
  const pureElectiveCount = pureElectiveBadges.length

  // 適用於童軍與行義童軍的晉級必備章定義
  type BadgeReqItem = { name: string, isOptional: boolean, choices: string[] }
  type RankBadgeReq = {
    rank: string, totalRequired: number, color: string,
    bgColor: string, textColor: string, borderColor: string,
    requiredBadges: BadgeReqItem[],
    electiveBadges: number, description: string
  }
  const rankBadgeReqsProgress: RankBadgeReq[] = member.section !== '羅浮童軍' ? [
    {
      rank: '獅級童軍', totalRequired: 5, color: 'amber',
      bgColor: 'bg-amber-50', textColor: 'text-amber-800', borderColor: 'border-amber-300',
      requiredBadges: [
        { name: '露營', isOptional: false, choices: [] },
        { name: '旅行', isOptional: false, choices: [] },
        { name: '社區公民', isOptional: false, choices: [] }
      ],
      electiveBadges: 2,
      description: '含 3 枚必備章 + 自選 2 枚（非必備類）技能章'
    },
    {
      rank: '長城童軍', totalRequired: 11, color: 'red',
      bgColor: 'bg-red-50', textColor: 'text-red-800', borderColor: 'border-red-300',
      requiredBadges: [
        { name: '國家公民', isOptional: false, choices: [] },
        { name: '急救', isOptional: false, choices: [] },
        { name: '運動（擇一）', isOptional: true, choices: ['游泳', '自行車', '越野'] }
      ],
      electiveBadges: 8,
      description: '含 3 枚必備章（運動擇一）+ 自選 8 枚（非必備類）'
    },
    {
      rank: '國花童軍', totalRequired: 18, color: 'purple',
      bgColor: 'bg-purple-50', textColor: 'text-purple-800', borderColor: 'border-purple-300',
      requiredBadges: [
        { name: '世界公民', isOptional: false, choices: [] },
        { name: '生態保育', isOptional: false, choices: [] },
        { name: '測量', isOptional: false, choices: [] },
        { name: '生物（擇一）', isOptional: true, choices: ['植物', '昆蟲', '賞鳥'] },
        { name: '藝術（擇一）', isOptional: true, choices: ['音樂', '舞蹈', '攝影'] }
      ],
      electiveBadges: 13,
      description: '含 5 枚必備章（生物、藝術各擇一）+ 自選 13 枚（非必備類）'
    }
  ] : []

  // ===== 正確的計算函數 =====

  // 判斷某必備章項目是否達成（擇一組：只要有任一個即達成，但只算1枚）
  function checkBadgeReqProgress(req: BadgeReqItem, has: Set<string>): boolean {
    if (req.isOptional && req.choices.length > 0) return req.choices.some(c => has.has(c))
    return has.has(req.name)
  }

  // 計算某階段的正確「有效枚數」與完整狀態
  function calcRankBadgeStatus(req: RankBadgeReq) {
    // 1. 必備章達成數（擇一組只算1）
    const reqDoneCount = req.requiredBadges.filter(b => checkBadgeReqProgress(b, myBadgeSetProgress)).length
    const allReqDone = reqDoneCount === req.requiredBadges.length

    // 2. 純自選章（排除所有必備章）可用數，上限為本階段自選需求數
    const electiveUsed = Math.min(pureElectiveCount, req.electiveBadges)

    // 3. 有效總枚數
    const effectiveTotal = reqDoneCount + electiveUsed

    // 4. 判斷是否達標
    const isFullyDone = allReqDone && effectiveTotal >= req.totalRequired

    return { reqDoneCount, allReqDone, electiveUsed, effectiveTotal, isFullyDone }
  }

  // 生成「專科章與晉級檢核」儀表板 HTML
  const badgeDashboardHtml = rankBadgeReqsProgress.length > 0 ? `
  <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-bold text-gray-800 flex items-center gap-2 text-lg">
        <i class="fas fa-medal text-amber-500"></i>專科章與晉級檢核
      </h2>
      <div class="text-right">
        <span class="text-2xl font-bold text-amber-600">${myBadgeCountProgress}</span>
        <span class="text-xs text-gray-400 ml-1">枚已取得</span>
      </div>
    </div>

    <!-- 整體進度概覽列 -->
    <div class="flex items-center justify-around bg-gray-50 rounded-xl p-3 mb-4">
      ${rankBadgeReqsProgress.map((req, idx) => {
        const { effectiveTotal, isFullyDone } = calcRankBadgeStatus(req)
        return `
        ${idx > 0 ? '<i class="fas fa-chevron-right text-gray-300 text-xs"></i>' : ''}
        <div class="flex flex-col items-center gap-1">
          <div class="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shadow-sm
            ${isFullyDone ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}">
            ${isFullyDone ? '<i class="fas fa-check"></i>' : `${effectiveTotal}/${req.totalRequired}`}
          </div>
          <div class="text-xs font-medium ${isFullyDone ? 'text-green-700' : 'text-gray-500'} text-center leading-tight">
            ${req.rank.replace('童軍', '')}<br>
            <span class="text-gray-400 font-normal">${req.totalRequired}枚</span>
          </div>
        </div>`
      }).join('')}
    </div>

    <!-- 三個階段的必備章詳情卡 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      ${rankBadgeReqsProgress.map((req) => {
        const { reqDoneCount, allReqDone, electiveUsed, effectiveTotal, isFullyDone } = calcRankBadgeStatus(req)
        const pct = Math.min(100, Math.round(effectiveTotal / req.totalRequired * 100))

        return `
        <div class="rounded-xl border-2 p-3.5 ${isFullyDone ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'}">
          <!-- 標題列 -->
          <div class="flex items-center justify-between mb-2.5">
            <div>
              <div class="font-bold text-sm ${isFullyDone ? 'text-green-800' : req.textColor}">${req.rank}</div>
              <div class="text-xs text-gray-400">共需 ${req.totalRequired} 枚</div>
            </div>
            ${isFullyDone
              ? '<div class="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center"><i class="fas fa-check text-white text-xs"></i></div>'
              : `<div class="text-sm font-bold ${req.textColor}">${reqDoneCount}/${req.requiredBadges.length} 必備</div>`
            }
          </div>

          <!-- 必備章列表 -->
          <div class="space-y-1.5 mb-2.5">
            ${req.requiredBadges.map((badge) => {
              const obtained = checkBadgeReqProgress(badge, myBadgeSetProgress)
              const obtainedName = badge.isOptional ? (badge.choices.find(c => myBadgeSetProgress.has(c)) || '') : ''
              return `
              <div class="flex items-center gap-2 ${obtained ? '' : 'opacity-60'}">
                <div class="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center
                  ${obtained ? 'bg-green-500' : 'bg-white border-2 border-gray-300'}">
                  ${obtained ? '<i class="fas fa-check text-white" style="font-size:9px"></i>' : ''}
                </div>
                <span class="text-xs ${obtained ? 'text-gray-800 font-medium' : 'text-gray-500'}">
                  ${badge.isOptional ? (obtainedName || badge.choices.join('/')) : badge.name}
                  ${badge.isOptional ? '<span class="text-gray-400 ml-0.5">（擇一）</span>' : ''}
                </span>
              </div>`
            }).join('')}
          </div>

          <!-- 自選章進度條 + 列表（顯示所有已取得的自選章） -->
          <div class="border-t border-gray-100 pt-2">
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="text-gray-500">自選章（${electiveUsed}/${req.electiveBadges}）</span>
              <span class="${effectiveTotal >= req.totalRequired ? 'text-green-700 font-bold' : 'text-gray-400'}">${effectiveTotal}/${req.totalRequired} 枚</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-1.5 mb-2">
              <div class="h-1.5 rounded-full transition-all ${isFullyDone ? 'bg-green-500' : 'bg-' + req.color + '-400'}"
                style="width:${pct}%"></div>
            </div>
            ${pureElectiveCount > 0 ? `
            <div class="flex flex-wrap gap-1">
              ${pureElectiveBadges.map((b:any) => `
                <span class="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">${b.name}</span>
              `).join('')}
              ${pureElectiveCount > req.electiveBadges ? `<span class="text-[10px] text-gray-400 self-center">（已足夠）</span>` : ''}
            </div>` : `<p class="text-[10px] text-gray-400">尚無自選章（需非必備章）</p>`}
          </div>
          <p class="text-xs text-gray-400 mt-2 leading-tight">${req.description}</p>
        </div>`
      }).join('')}
    </div>

    <!-- 純自選章總覽 -->
    <div class="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
          <i class="fas fa-star text-blue-500"></i>已取得自選章（${pureElectiveCount} 枚）
        </span>
        <span class="text-[10px] text-blue-600 bg-white border border-blue-200 px-2 py-0.5 rounded-full">非必備章</span>
      </div>
      ${pureElectiveCount > 0 ? `
      <div class="flex flex-wrap gap-1.5">
        ${pureElectiveBadges.map((b:any) => `
          <span class="text-xs bg-white text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full shadow-sm">${b.name}</span>
        `).join('')}
      </div>` : `<p class="text-xs text-blue-500 opacity-70">尚無自選章。自選章指非必備章類別的章（例如：電工、體勢能等）</p>`}
    </div>

    <div class="mt-3 text-xs text-gray-400 flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-2">
      <i class="fas fa-info-circle text-blue-400"></i>
      自選章不包含任何必備章（露營、急救、游泳等），如有疑問請聯繫服務員。
      <a href="/member/progress?tab=advancement" class="text-green-600 underline ml-auto flex-shrink-0">申請晉升 →</a>
    </div>
  </div>` : ''

  const reqTypeIcon: Record<string, string> = {
    attendance: 'fas fa-calendar-check',
    service:    'fas fa-hands-helping',
    badge:      'fas fa-certificate',
    test:       'fas fa-clipboard-check',
    camp:       'fas fa-campground',
    other:      'fas fa-star'
  }
  const reqTypeColor: Record<string, string> = {
    attendance: 'text-green-500',
    service:    'text-blue-500',
    badge:      'text-yellow-500',
    test:       'text-purple-500',
    camp:       'text-orange-500',
    other:      'text-gray-400'
  }
  const rankTypeLabel: Record<string, string> = {
    rank: '🏅 階級', badge: '📛 技能章', achievement: '🏆 成就', award: '⭐ 獎項'
  }

  // 計算整體進度（只算必填）
  const allMandatory = requirements.results.filter((r: any) => r.is_mandatory)
  const allCompleted = allMandatory.filter((r: any) => isReqDone(r))
  const overallPct = allMandatory.length > 0
    ? Math.round((allCompleted.length / allMandatory.length) * 100) : 0

  // 各階段卡片 HTML（按正確的升級順序排列）
  const stageSections = orderedTargets.map((targetRank, stageIdx) => {
    const reqs = groupsByTarget[targetRank] || []
    const mandatory = reqs.filter((r: any) => r.is_mandatory)
    const completedMandatory = mandatory.filter((r: any) => isReqDone(r))
    const pct = mandatory.length > 0
      ? Math.round((completedMandatory.length / mandatory.length) * 100) : 0
    // 當前目標：rank_from 等於目前階級，或目前無階級時第一個
    const isCurrentTarget = currentRank
      ? reqs.some((r: any) => r.rank_from === currentRank)
      : stageIdx === 0
    // 已完成階段：在當前目標之前的所有階段
    const currentIdx = orderedTargets.findIndex(t =>
      groupsByTarget[t]?.some((r: any) => r.rank_from === currentRank))
    const isPast = stageIdx < currentIdx
    const isFuture = stageIdx > currentIdx && currentIdx !== -1

    return `
    <div class="bg-white rounded-2xl shadow-sm border ${isCurrentTarget ? 'border-green-300 ring-2 ring-green-100' : isPast ? 'border-gray-100 opacity-70' : 'border-gray-100'} mb-4 overflow-hidden">
      <!-- 階段標題 -->
      <div class="${isCurrentTarget ? 'bg-gradient-to-r from-green-600 to-emerald-500 text-white' : isPast ? 'bg-gray-100 text-gray-500' : 'bg-gray-50 text-gray-600'} px-5 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full ${isCurrentTarget ? 'bg-white/20' : isPast ? 'bg-green-100' : 'bg-gray-200'} flex items-center justify-center text-sm font-bold">
              ${isPast ? '<i class="fas fa-check text-green-600 text-base"></i>' : pct >= 100 ? '<i class="fas fa-check text-green-400"></i>' : pct > 0 ? `${pct}%` : `<span class="text-gray-400">${stageIdx+1}</span>`}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-bold text-base">${targetRank}</h3>
                ${isCurrentTarget ? '<span class="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">🎯 進行中</span>' : ''}
                ${isPast ? '<span class="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">✅ 已達成</span>' : ''}
                ${isFuture ? '<span class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">未來目標</span>' : ''}
              </div>
              <p class="${isCurrentTarget ? 'text-green-100' : 'text-gray-400'} text-xs mt-0.5">
                ${reqs[0]?.rank_from ? `${reqs[0].rank_from} → ${targetRank}` : `升至 ${targetRank}`} ·
                ${completedMandatory.length}/${mandatory.length} 必填完成
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            ${pct >= 100 && !activeApp && isCurrentTarget ? `
            <a href="/member/progress?tab=advancement" class="bg-white text-green-700 text-xs font-medium px-3 py-1.5 rounded-full hover:opacity-90 transition-opacity shadow-sm">
              🚀 申請晉升
            </a>` : ''}
            ${pct < 100 && isCurrentTarget ? `
            <div class="flex items-center gap-2">
              <span class="text-white/80 text-xs">${pct}%</span>
              <div class="w-24 bg-white/30 rounded-full h-2">
                <div class="bg-white h-2 rounded-full transition-all" style="width:${pct}%"></div>
              </div>
            </div>` : ''}
          </div>
        </div>
      </div>

      <!-- 標準清單 -->
      <div class="divide-y divide-gray-50">
        ${reqs.map((req: any) => {
          const done = isReqDone(req)
          const achieved = getAchieved(req)
          const prog = progressMap[req.id]
          const pctReq = Math.min(100, req.required_count > 0
            ? Math.round((achieved / req.required_count) * 100) : 0)
          const icon = reqTypeIcon[req.requirement_type] || reqTypeIcon.other
          const iconColor = reqTypeColor[req.requirement_type] || reqTypeColor.other

          return `
          <div class="flex items-start gap-3 px-5 py-3.5 ${done ? 'bg-green-50/50' : ''} hover:bg-gray-50 transition-colors">
            <!-- 完成狀態圖示 -->
            <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${done ? 'bg-green-500 shadow-sm' : 'bg-gray-200'}">
              <i class="fas ${done ? 'fa-check' : 'fa-clock'} text-white text-xs"></i>
            </div>

            <!-- 條件內容 -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                <i class="${icon} ${iconColor} text-xs"></i>
                <span class="text-sm font-medium ${done ? 'text-green-800' : 'text-gray-800'}">${req.title}</span>
                ${!req.is_mandatory ? `<span class="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">選填</span>` : ''}
                ${prog?.status === 'approved' ? `<span class="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">✓ 已審核</span>` :
                  prog?.status === 'submitted' ? `<span class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">⏳ 審核中</span>` : ''}
              </div>
              ${req.description ? `<p class="text-xs text-gray-400 mb-1">${req.description}</p>` : ''}

              <!-- 進度條 -->
              ${req.required_count > 1 ? `
              <div class="flex items-center gap-2">
                <div class="flex-1 bg-gray-200 rounded-full h-1.5 max-w-xs">
                  <div class="${done ? 'bg-green-500' : 'bg-blue-400'} h-1.5 rounded-full progress-bar" style="width:${pctReq}%"></div>
                </div>
                <span class="text-xs font-medium ${done ? 'text-green-600' : 'text-gray-500'} whitespace-nowrap">
                  ${achieved}/${req.required_count} ${req.unit}
                </span>
              </div>` : `
              <div class="text-xs text-gray-400">需完成 ${req.required_count} ${req.unit}</div>`}

              ${prog?.evidence_note ? `
              <p class="text-xs text-blue-500 mt-1 flex items-center gap-1">
                <i class="fas fa-paperclip"></i>${prog.evidence_note}
              </p>` : ''}

              <!-- 回報進度按鈕（未完成且非出席類型） -->
              ${!done && req.requirement_type !== 'attendance' && prog?.status !== 'submitted' ? `
              <button onclick="openReportForm('${req.id}', '${req.title.replace(/'/g, "\\'")}', ${req.required_count}, '${req.unit}')"
                class="mt-1.5 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline">
                <i class="fas fa-edit"></i>回報達成進度
              </button>` : ''}
            </div>
          </div>`
        }).join('')}
      </div>
    </div>`
  }).join('')

  // ── 晉升申請 Tab 所需資料 ──
  const applications = await db.prepare(`
    SELECT * FROM advancement_applications WHERE member_id = ? ORDER BY created_at DESC
  `).bind(memberId).all()

  // rank paths (可申請哪些晉升)
  const rankPathsAdv: { from: string, to: string }[] = []
  const seenAdv = new Set<string>()
  requirements.results.forEach((r: any) => {
    const k = `${r.rank_from}→${r.rank_to}`
    if (!seenAdv.has(k)) { seenAdv.add(k); rankPathsAdv.push({ from: r.rank_from, to: r.rank_to }) }
  })

  const statusLabelAdv: Record<string, string> = {
    pending: '⏳ 待審核', reviewing: '🔍 審核中', approved: '✅ 已通過', rejected: '❌ 未通過'
  }

  // 晉升申請 tab HTML
  const tabAdvancementHtml = `
    ${badgeDashboardHtml}

    <!-- 申請新晉升 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <h2 class="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <i class="fas fa-paper-plane text-green-600"></i>提交晉升申請
      </h2>
      <form id="advForm" class="space-y-4">
        <div class="grid sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">目前階級</label>
            <input type="text" value="${member.rank_level || ''}" readonly
              class="w-full border border-gray-200 rounded-lg px-4 py-2.5 bg-gray-50 text-sm text-gray-600">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">申請晉升至</label>
            <select name="rank_to" required
              class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm">
              <option value="">-- 選擇目標階級 --</option>
              ${rankPathsAdv.map(r => `<option value="${r.to}" data-from="${r.from}">${r.from} → ${r.to}</option>`).join('')}
            </select>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">申請日期</label>
          <input type="date" name="apply_date" value="${new Date().toISOString().slice(0,10)}" required
            class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm">
        </div>
        <div id="advFormMsg"></div>
        <button type="submit"
          class="w-full bg-green-700 hover:bg-green-600 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
          <i class="fas fa-arrow-up"></i>提交晉升申請
        </button>
      </form>
    </div>

    <!-- 申請記錄 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100">
      <div class="p-4 border-b border-gray-100">
        <h2 class="font-semibold text-gray-800 flex items-center gap-2"><i class="fas fa-history text-gray-400"></i>申請記錄</h2>
      </div>
      ${applications.results.length === 0 ? `<div class="p-8 text-center text-gray-400">
        <i class="fas fa-clipboard-list text-4xl mb-3 block"></i>
        <p>尚無晉升申請記錄</p>
      </div>` : `<div class="divide-y divide-gray-50">
        ${applications.results.map((a: any) => `
        <div class="p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-medium text-gray-800">${a.rank_from} → ${a.rank_to}</div>
              <div class="text-xs text-gray-400 mt-0.5">${a.section} · 申請日期：${a.apply_date}</div>
              ${a.admin_notes ? `<div class="text-xs text-blue-600 mt-1 bg-blue-50 px-2 py-1 rounded"><i class="fas fa-comment mr-1"></i>${a.admin_notes}</div>` : ''}
              ${a.reviewed_at ? `<div class="text-xs text-gray-400 mt-0.5">審核時間：${a.reviewed_at?.substring(0,10)}</div>` : ''}
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-medium status-${a.status} flex-shrink-0">
              ${statusLabelAdv[a.status] || a.status}
            </span>
          </div>
        </div>`).join('')}
      </div>`}
    </div>`

  // 晉升進度 tab HTML（原有內容）
  const tabProgressHtml = `
    <!-- 整體進度卡 -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex flex-wrap items-center gap-3">
            <span class="text-gray-500 text-sm">目前階級：<strong class="text-green-700 text-base">${member.rank_level || '見習'}</strong></span>
            <span class="text-gray-300">·</span>
            <span class="text-gray-500 text-sm">${member.section}</span>
            ${orderedTargets.length > 0 && currentRank ? (() => {
              const nextIdx = orderedTargets.findIndex(t =>
                groupsByTarget[t]?.some((r:any) => r.rank_from === currentRank))
              const nextTarget = nextIdx >= 0 ? orderedTargets[nextIdx] : null
              return nextTarget ? `<span class="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">🎯 目標：${nextTarget}</span>` : ''
            })() : ''}
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-center">
            <div class="text-3xl font-bold ${overallPct >= 100 ? 'text-green-600' : 'text-blue-500'}">${overallPct}%</div>
            <div class="text-xs text-gray-400">整體完成</div>
          </div>
          <a href="/member/progress?tab=advancement"
            class="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-xl transition-colors flex items-center gap-2 shadow-sm">
            <i class="fas fa-arrow-up"></i>申請晉升
          </a>
        </div>
      </div>

      <!-- 整體進度條 -->
      <div class="mt-4">
        <div class="flex justify-between text-xs text-gray-400 mb-1">
          <span>必填條件進度 ${allCompleted.length}/${allMandatory.length}</span>
          <span>${overallPct}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-3">
          <div class="progress-bar ${overallPct >= 100 ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-blue-500 to-blue-400'} h-3 rounded-full"
            style="width:${overallPct}%"></div>
        </div>
      </div>

      ${activeApp ? `
      <div class="mt-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm">
        <i class="fas fa-spinner fa-spin text-blue-500"></i>
        <span class="text-blue-700">晉升申請進行中：<strong>${activeApp.rank_from} → ${activeApp.rank_to}</strong>（${activeApp.status === 'pending' ? '待審核' : '審核中'}）</span>
      </div>` : ''}
    </div>

    <!-- 專科章儀表板 -->
    ${badgeDashboardHtml}

    <!-- 各階段晉升標準 -->
    ${stageSections || `
    <div class="bg-white rounded-2xl p-10 text-center border border-gray-100 shadow-sm">
      <div class="text-5xl mb-4">📋</div>
      <h3 class="text-lg font-semibold text-gray-600 mb-2">尚未設定進程標準</h3>
      <p class="text-gray-400 text-sm">請聯繫管理員設定 ${member.section} 的晉升條件</p>
    </div>`}

    <!-- 出席資訊提醒 -->
    <div class="bg-blue-50 rounded-2xl p-4 mb-6 flex items-start gap-3 border border-blue-100">
      <i class="fas fa-info-circle text-blue-500 mt-0.5 flex-shrink-0"></i>
      <div class="text-sm text-blue-700">
        <strong>出席場次：</strong>目前已記錄出席 <strong>${myAttend} 場</strong>。
        出席類型的標準會自動從出席記錄計算，無需手動回報。
        <a href="/member/attendance" class="underline ml-1">查看出席記錄</a>
      </div>
    </div>

    <!-- 已獲得紀錄 -->
    <h2 class="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <i class="fas fa-history text-yellow-500"></i>已取得紀錄
    </h2>
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100">
      ${progressRecords.results.length === 0
        ? `<div class="p-8 text-center text-gray-400"><i class="fas fa-medal text-4xl mb-3 block"></i>尚無進度記錄</div>`
        : `<div class="divide-y divide-gray-50">
          ${progressRecords.results.map((p: any) => `
          <div class="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
            <div class="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
              <i class="fas fa-award text-yellow-600 text-sm"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-medium text-gray-800 text-sm truncate">${p.award_name}</div>
              <div class="text-xs text-gray-400">
                ${rankTypeLabel[p.record_type] || p.record_type}
                ${p.year_label ? ` · ${p.year_label}` : ''}
                · ${p.awarded_at?.substring(0,10) || ''}
              </div>
              ${p.notes ? `<div class="text-xs text-gray-500 mt-0.5">${p.notes}</div>` : ''}
            </div>
          </div>`).join('')}
        </div>`}
    </div>`

  // ===== 教練團進程 tab HTML =====
  const coachStageOrder = ['預備教練','見習教練','助理教練','指導教練']
  const stageBadgeClass: Record<string,string> = {
    '預備教練': 'bg-gray-100 text-gray-700',
    '見習教練': 'bg-teal-100 text-teal-800',
    '助理教練': 'bg-blue-100 text-blue-800',
    '指導教練': 'bg-purple-100 text-purple-800',
  }
  const stageHeaderClass: Record<string,string> = {
    '預備教練': 'from-gray-500 to-gray-400',
    '見習教練': 'from-teal-600 to-teal-500',
    '助理教練': 'from-blue-600 to-blue-500',
    '指導教練': 'from-purple-700 to-purple-600',
  }

  let tabCoachHtml: string
  if (!coachStatusProg) {
    tabCoachHtml = `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
      <div class="text-5xl mb-4">🧢</div>
      <h3 class="text-lg font-semibold text-gray-600 mb-2">尚未加入教練團進程</h3>
      <p class="text-gray-400 text-sm">如需加入教練團進程，請聯繫服務員。</p>
    </div>`
  } else {
    const currentStage = coachStatusProg.current_stage || '預備教練'
    // 計算各階段進度（顯示所有 3 個晉升階段：見習、助理、指導）
    const displayStages = ['見習教練','助理教練','指導教練']
    const stageCards = displayStages.map(stage => {
      const items = (coachChecklistAll.results as any[]).filter((it: any) => it.stage === stage)
      const doneCount = items.filter((it: any) => coachDoneSetProg.has(it.id)).length
      const pct = items.length > 0 ? Math.round(doneCount / items.length * 100) : 0
      const isCurrentStage = stage === currentStage
      const stageIdx = coachStageOrder.indexOf(stage)
      const currentIdx = coachStageOrder.indexOf(currentStage)
      const isPast = stageIdx < currentIdx
      const isFuture = stageIdx > currentIdx

      return `
      <div class="bg-white rounded-2xl border-2 ${isCurrentStage ? 'border-green-400 shadow-md' : isPast ? 'border-gray-200' : 'border-gray-100 opacity-70'} overflow-hidden">
        <div class="bg-gradient-to-r ${stageHeaderClass[stage]} text-white px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-sm">${stage}</span>
            ${isCurrentStage ? '<span class="text-xs bg-white/20 px-2 py-0.5 rounded-full">目前階段</span>' : ''}
            ${isPast ? '<span class="text-xs bg-white/20 px-2 py-0.5 rounded-full">✓ 已完成</span>' : ''}
          </div>
          ${items.length > 0 ? `<span class="text-xs font-medium text-white/80">${doneCount}/${items.length} 項</span>` : ''}
        </div>
        <div class="p-4">
          ${items.length === 0 ? `<p class="text-xs text-gray-400 text-center py-4">此階段尚無檢核項目</p>` : `
          <!-- 進度條 -->
          <div class="mb-3">
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="text-gray-500">完成進度</span>
              <span class="${pct>=100?'text-green-600 font-bold':'text-gray-400'}">${pct}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div class="h-2 rounded-full ${pct>=100?'bg-green-500':isCurrentStage?'bg-blue-400':'bg-gray-300'} transition-all" style="width:${pct}%"></div>
            </div>
          </div>
          <!-- 檢核清單 -->
          <div class="space-y-2">
            ${items.map((it: any) => {
              const done = coachDoneSetProg.has(it.id)
              return `
              <div class="flex items-start gap-2.5 ${done?'':'opacity-80'}">
                <div class="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5
                  ${done?'bg-green-500':'border-2 border-gray-300 bg-white'}">
                  ${done?'<i class="fas fa-check text-white" style="font-size:9px"></i>':''}
                </div>
                <div class="flex-1">
                  <span class="text-sm ${done?'text-green-800 font-medium':'text-gray-700'}">${it.description}</span>
                  ${it.required_count>1?`<span class="text-xs text-gray-400 ml-1">(需 ${it.required_count} 次)</span>`:''}
                </div>
              </div>`
            }).join('')}
          </div>
          ${pct>=100 && isCurrentStage ? `
          <div class="mt-3 bg-green-50 border border-green-200 rounded-xl p-3 text-center text-sm text-green-700 font-medium">
            🎉 已完成所有晉升條件！請聯繫服務員申請晉升至下一階段。
          </div>` : ''}`}
        </div>
      </div>`
    }).join('')

    tabCoachHtml = `
    <!-- 教練團狀態卡 -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-bold text-gray-800 flex items-center gap-2">
            <i class="fas fa-chalkboard-teacher text-emerald-600"></i>教練團進程
          </h2>
          <p class="text-sm text-gray-400 mt-0.5">${member.chinese_name} · 加入於 ${coachStatusProg.added_at?.substring(0,10)||''}</p>
        </div>
        <div class="flex flex-col items-end gap-1">
          <span class="px-3 py-1.5 rounded-full text-sm font-semibold ${stageBadgeClass[currentStage]||'bg-gray-100 text-gray-700'}">
            ${currentStage}
          </span>
          ${coachStatusProg.promoted_at ? `<span class="text-xs text-gray-400">晉升於 ${coachStatusProg.promoted_at.substring(0,10)}</span>` : ''}
        </div>
      </div>
      <!-- 整體進度路徑 -->
      <div class="mt-4 flex items-center gap-2 justify-center">
        ${coachStageOrder.map((s,i) => {
          const idx = coachStageOrder.indexOf(currentStage)
          const isPast2 = i < idx
          const isCurrent = i === idx
          return `
          ${i > 0 ? `<div class="flex-1 h-0.5 ${isPast2 || isCurrent ? 'bg-green-400' : 'bg-gray-200'}"></div>` : ''}
          <div class="flex flex-col items-center gap-1">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
              ${isCurrent ? 'bg-green-600 text-white ring-2 ring-green-300' : isPast2 ? 'bg-green-200 text-green-700' : 'bg-gray-100 text-gray-400'}">
              ${isPast2 ? '✓' : i+1}
            </div>
            <span class="text-[10px] text-gray-500 text-center leading-tight">${s}</span>
          </div>`
        }).join('')}
      </div>
    </div>

    <!-- 各階段檢核卡 -->
    <div class="grid grid-cols-1 gap-4">
      ${stageCards}
    </div>`
  }

  const progressTabs = [
    { key: 'progress',    label: '晉升進度',    icon: 'fas fa-chart-line' },
    { key: 'advancement', label: '晉升申請',    icon: 'fas fa-arrow-up' },
    ...(coachStatusProg ? [{ key: 'coach', label: '教練團進程', icon: 'fas fa-chalkboard-teacher' }] : []),
  ]

  return c.html(`${memberHead('晉升')}
<body class="bg-gray-50 min-h-screen">
  ${memberNav(member.chinese_name, member.section, 'progress')}
  <div class="max-w-3xl mx-auto px-4 py-6 fade-in">

    <!-- 頁面標題 -->
    <div class="mb-5">
      <h1 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
        <i class="fas fa-chart-line text-green-600"></i>晉升管理
      </h1>
      <p class="text-sm text-gray-400 mt-0.5">${member.chinese_name} · ${member.section}</p>
    </div>

    <!-- Tab 列 -->
    <div class="flex gap-2 mb-5 border-b border-gray-200">
      ${progressTabs.map(t => `
      <a href="/member/progress?tab=${t.key}" class="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px
        ${activeTab === t.key
          ? 'border-green-600 text-green-700 bg-white'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}">
        <i class="${t.icon}"></i>${t.label}
      </a>`).join('')}
    </div>

    <!-- Tab 內容 -->
    ${activeTab === 'advancement' ? tabAdvancementHtml : activeTab === 'coach' ? tabCoachHtml : tabProgressHtml}
  </div>

  <!-- 回報進度 Modal -->
  <div id="reportModal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
      <div class="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-4 text-white">
        <h3 class="font-bold flex items-center gap-2"><i class="fas fa-edit"></i>回報達成進度</h3>
        <p id="reportTitle" class="text-blue-100 text-xs mt-0.5"></p>
      </div>
      <div class="p-5 space-y-4">
        <input type="hidden" id="reportReqId">
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
            已達成數量 <span id="reportUnit" class="text-gray-400 font-normal text-xs"></span>
          </label>
          <input id="reportCount" type="number" min="0"
            class="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none text-center text-lg font-bold">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">佐證說明（選填）</label>
          <textarea id="reportNote" rows="2" placeholder="例：第三次服務學習活動，2025/01/15"
            class="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none resize-none"></textarea>
        </div>
        <div id="reportMsg"></div>
        <div class="flex gap-3">
          <button onclick="submitReport()"
            class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
            送出回報
          </button>
          <button onclick="document.getElementById('reportModal').classList.add('hidden')"
            class="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm transition-colors">
            取消
          </button>
        </div>
      </div>
    </div>
  </div>

  <script>
  function openReportForm(reqId, title, requiredCount, unit) {
    document.getElementById('reportReqId').value = reqId;
    document.getElementById('reportTitle').textContent = title;
    document.getElementById('reportUnit').textContent = '需 ' + requiredCount + ' ' + unit;
    document.getElementById('reportCount').value = '';
    document.getElementById('reportCount').max = requiredCount;
    document.getElementById('reportNote').value = '';
    document.getElementById('reportMsg').innerHTML = '';
    document.getElementById('reportModal').classList.remove('hidden');
    document.getElementById('reportCount').focus();
  }

  async function submitReport() {
    const reqId = document.getElementById('reportReqId').value;
    const count = parseInt(document.getElementById('reportCount').value) || 0;
    const note = document.getElementById('reportNote').value.trim();
    const msg = document.getElementById('reportMsg');
    if (count < 0) { msg.innerHTML = '<p class="text-red-500 text-sm">請輸入正確數量</p>'; return; }
    msg.innerHTML = '<p class="text-gray-400 text-sm">送出中...</p>';
    try {
      const res = await fetch('/api/member/advancement-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement_id: reqId, achieved_count: count, evidence_note: note })
      });
      const r = await res.json();
      if (r.success) {
        msg.innerHTML = '<p class="text-green-600 text-sm">✅ 已送出，等待管理員審核</p>';
        setTimeout(() => location.reload(), 1200);
      } else {
        msg.innerHTML = '<p class="text-red-500 text-sm">失敗：' + (r.error || '未知錯誤') + '</p>';
      }
    } catch(e) {
      msg.innerHTML = '<p class="text-red-500 text-sm">網路錯誤</p>';
    }
  }

  document.getElementById('reportModal').addEventListener('click', function(e) {
    if (e.target === this) this.classList.add('hidden');
  });
  </script>
</body></html>`)
})


// ===================== 活動報名 =====================
memberRoutes.get('/activities', memberAuthMiddleware, async (c) => {
  const db = c.env.DB
  const sess = c.get('memberSession') as any
  const memberId = sess.memberId
  const member = await db.prepare(`SELECT * FROM members WHERE id = ?`).bind(memberId).first() as any

  // 取得開放報名的活動
  const activities = await db.prepare(`
    SELECT a.*, 
      (SELECT status FROM activity_registrations WHERE activity_id = a.id AND member_id = ?) as my_status
    FROM activities a
    WHERE a.is_published = 1
    ORDER BY a.activity_date DESC
  `).bind(memberId).all()

  // 分類活動
  const upcoming: any[] = []
  const past: any[] = []
  const today = new Date().toISOString().substring(0, 10)

  activities.results.forEach((a: any) => {
    if (a.activity_date >= today) upcoming.push(a)
    else past.push(a)
  })

  // 狀態標籤
  const statusLabel: Record<string, string> = {
    pending: '<span class="px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs">審核中</span>',
    approved: '<span class="px-2 py-1 rounded bg-green-100 text-green-800 text-xs">✅ 已錄取</span>',
    rejected: '<span class="px-2 py-1 rounded bg-red-100 text-red-800 text-xs">未錄取</span>',
    waiting: '<span class="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs">候補中</span>',
    cancelled: '<span class="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs">已取消</span>'
  }

  const renderActivityCard = (a: any) => {
    const isRegOpen = a.is_registration_open && 
      (!a.registration_start || new Date(a.registration_start) <= new Date()) &&
      (!a.registration_end || new Date(a.registration_end) >= new Date())
    
    return `
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <div class="md:flex">
        <div class="md:w-1/3 h-48 md:h-auto bg-gray-200 relative">
          <img src="${a.cover_image || 'https://placehold.co/600x400?text=Activity'}" class="w-full h-full object-cover">
          ${a.my_status ? `<div class="absolute top-2 right-2">${statusLabel[a.my_status]}</div>` : ''}
        </div>
        <div class="p-5 md:w-2/3 flex flex-col justify-between">
          <div>
            <div class="flex justify-between items-start">
              <span class="text-xs font-bold text-green-600 mb-1 block">${a.category}</span>
              ${a.cost ? `<span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">${a.cost}</span>` : ''}
            </div>
            <h3 class="text-lg font-bold text-gray-800 mb-2">${a.title}</h3>
            <div class="text-sm text-gray-500 space-y-1 mb-3">
              <div class="flex items-center gap-2"><i class="fas fa-calendar-alt w-4"></i> ${a.date_display || a.activity_date}</div>
              ${a.location ? `<div class="flex items-center gap-2"><i class="fas fa-map-marker-alt w-4"></i> ${a.location}</div>` : ''}
            </div>
            <p class="text-sm text-gray-600 line-clamp-2">${a.description || ''}</p>
          </div>
          
          <div class="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
            ${isRegOpen && !a.my_status ? `
              <button onclick="openRegisterModal(${a.id}, '${a.title}')" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                我要報名
              </button>
            ` : a.my_status ? `
              <span class="text-sm text-gray-500">您已報名此活動</span>
            ` : `
              <span class="text-sm text-gray-400">報名未開放或已截止</span>
            `}
            <button onclick="showDetails(${a.id})" class="text-blue-600 text-sm hover:underline">查看詳情</button>
          </div>
        </div>
      </div>
      
      <!-- 詳情區塊 (Hidden by default) -->
      <div id="details-${a.id}" class="hidden p-5 border-t border-gray-100 bg-gray-50 text-sm">
        <h4 class="font-bold text-gray-700 mb-2">活動內容</h4>
        <div class="prose prose-sm max-w-none text-gray-600 mb-4">${a.content || a.description || '無詳細內容'}</div>
        ${a.registration_end ? `<p class="text-xs text-red-500">報名截止：${a.registration_end.replace('T', ' ')}</p>` : ''}
      </div>
    </div>
    `
  }

  return c.html(`${memberHead('活動報名')}
  <body class="bg-gray-50 min-h-screen">
    ${memberNav(member.chinese_name, member.section, 'activities')}
    <div class="max-w-4xl mx-auto px-4 py-8 fade-in">
      <h1 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <i class="fas fa-campground text-green-600"></i> 活動報名
      </h1>

      <div class="space-y-8">
        <section>
          <h2 class="text-lg font-bold text-gray-700 mb-4 border-l-4 border-green-500 pl-3">即將到來的活動</h2>
          ${upcoming.length > 0 ? `<div class="space-y-4">${upcoming.map(renderActivityCard).join('')}</div>` : 
            `<div class="text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-100">目前沒有即將到來的活動</div>`}
        </section>

        <section>
          <h2 class="text-lg font-bold text-gray-700 mb-4 border-l-4 border-gray-400 pl-3">歷史活動</h2>
          ${past.length > 0 ? `<div class="space-y-4 opacity-75 hover:opacity-100 transition-opacity">${past.map(renderActivityCard).join('')}</div>` : 
            `<div class="text-center py-8 text-gray-400">尚無歷史活動</div>`}
        </section>
      </div>
    </div>

    <!-- 報名 Modal -->
    <div id="regModal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div class="p-5 border-b border-gray-100">
          <h3 class="text-lg font-bold text-gray-800">報名活動</h3>
          <p id="regTitle" class="text-sm text-green-600"></p>
        </div>
        <div class="p-5">
          <input type="hidden" id="regActivityId">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">備註 (飲食習慣、特殊需求等)</label>
            <textarea id="regNotes" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"></textarea>
          </div>
          <div class="flex gap-3">
            <button onclick="submitRegistration()" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium">確認報名</button>
            <button onclick="document.getElementById('regModal').classList.add('hidden')" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg text-sm">取消</button>
          </div>
        </div>
      </div>
    </div>

    <script>
      function showDetails(id) {
        const el = document.getElementById('details-' + id);
        el.classList.toggle('hidden');
      }

      function openRegisterModal(id, title) {
        document.getElementById('regActivityId').value = id;
        document.getElementById('regTitle').textContent = title;
        document.getElementById('regNotes').value = '';
        document.getElementById('regModal').classList.remove('hidden');
      }

      async function submitRegistration() {
        const id = document.getElementById('regActivityId').value;
        const notes = document.getElementById('regNotes').value;
        
        if (!confirm('確定要報名此活動嗎？')) return;

        try {
          const res = await fetch('/api/activities/' + id + '/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_notes: notes })
          });
          
          const result = await res.json();
          if (result.success) {
            alert('報名成功！請等待管理員審核。');
            location.reload();
          } else {
            alert('報名失敗：' + (result.error || '未知錯誤'));
          }
        } catch (e) {
          alert('系統錯誤，請稍後再試');
        }
      }
    </script>
  </body></html>`)
})

// ===================== 出席 / 請假 / 公假 整合頁面 =====================
memberRoutes.get('/attendance', memberAuthMiddleware, async (c) => {
  const db = c.env.DB
  const sess = c.get('memberSession') as any
  const memberId = sess.memberId
  const activeTab = c.req.query('tab') || 'attendance'
  const member = await db.prepare(`SELECT * FROM members WHERE id = ?`).bind(memberId).first() as any

  // ── 年度在籍 ──
  const yearSetting = await db.prepare(`SELECT value FROM site_settings WHERE key='current_year_label'`).first() as any
  const currentYear = yearSetting?.value || '114'
  const enrollment = await db.prepare(`SELECT section FROM member_enrollments WHERE member_id=? AND year_label=? AND is_active=1`).bind(memberId, currentYear).first() as any
  const displaySection = enrollment?.section || member.section

  // ── Tab 1：出席記錄資料 ──
  const sessions = await db.prepare(`
    SELECT as2.*, ar.status as my_status, ar.note as my_note,
      lr.id as leave_id, lr.status as leave_status, lr.leave_type
    FROM attendance_sessions as2
    LEFT JOIN attendance_records ar ON ar.session_id = as2.id AND ar.member_id = ?
    LEFT JOIN leave_requests lr ON lr.session_id = as2.id AND lr.member_id = ?
    WHERE as2.section = ? OR as2.section = 'all'
    ORDER BY as2.date DESC LIMIT 50
  `).bind(memberId, memberId, displaySection).all()

  const stats = await db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN ar.status='present' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN ar.status='absent' THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN lr.id IS NOT NULL THEN 1 ELSE 0 END) as leave_cnt
    FROM attendance_sessions as2
    LEFT JOIN attendance_records ar ON ar.session_id = as2.id AND ar.member_id = ?
    LEFT JOIN leave_requests lr ON lr.session_id = as2.id AND lr.member_id = ?
    WHERE as2.section = ? OR as2.section = 'all'
  `).bind(memberId, memberId, displaySection).first() as any

  const total = stats?.total || 0
  const present = stats?.present || 0
  const rate = total > 0 ? Math.round((present / total) * 100) : 0

  // ── Tab 2：請假申請資料 ──
  const leaves = await db.prepare(`
    SELECT lr.*, COALESCE(as2.title, '自訂日期') as session_title, as2.date as session_date_actual
    FROM leave_requests lr
    LEFT JOIN attendance_sessions as2 ON as2.id = lr.session_id
    WHERE lr.member_id = ?
    ORDER BY lr.created_at DESC
  `).bind(memberId).all()

  const upcomingSessions = await db.prepare(`
    SELECT as2.id, as2.title, as2.date, as2.section
    FROM attendance_sessions as2
    WHERE (as2.section = ? OR as2.section = 'all')
      AND NOT EXISTS (
        SELECT 1 FROM leave_requests lr WHERE lr.session_id = as2.id AND lr.member_id = ?
      )
    ORDER BY as2.date DESC LIMIT 20
  `).bind(displaySection, memberId).all()

  const statusLabel: Record<string, string> = { pending: '⏳ 待審核', approved: '✅ 已核准', rejected: '❌ 未核准' }
  const leaveTypeLabel: Record<string, string> = { official: '⚡ 公假', sick: '🏥 病假', personal: '📝 事假', other: '📌 其他' }

  // ── Tab 3：公假行事曆資料 ──
  const settingRows = await db.prepare(`SELECT key, value FROM site_settings WHERE key LIKE 'official_leave%'`).all()
  const sMap: Record<string,string> = {}
  settingRows.results.forEach((r: any) => { sMap[r.key] = r.value })
  const semStart = sMap['official_leave_semester_start'] || ''
  const semEnd   = sMap['official_leave_semester_end'] || ''
  let recurringRules: any[] = []
  try { recurringRules = JSON.parse(sMap['official_leave_recurring_rules'] || '[]') } catch {}

  const weekParam = c.req.query('week')
  let weekStart: Date
  if (weekParam) {
    weekStart = new Date(weekParam + 'T12:00:00')
  } else {
    const today = new Date()
    const dow = today.getDay()
    const diff = dow === 0 ? -6 : 1 - dow
    weekStart = new Date(today)
    weekStart.setDate(today.getDate() + diff)
  }
  weekStart.setHours(12,0,0,0)

  const fmtDate = (d: Date) => d.toISOString().substring(0,10)
  const weekDays: Date[] = []
  for (let i=0; i<7; i++) {
    const d = new Date(weekStart); d.setDate(weekStart.getDate()+i); weekDays.push(d)
  }
  const weekEnd = weekDays[6]
  const wStart = fmtDate(weekStart), wEnd = fmtDate(weekEnd)
  const prevWeek = new Date(weekStart); prevWeek.setDate(weekStart.getDate()-7)
  const nextWeek = new Date(weekStart); nextWeek.setDate(weekStart.getDate()+7)
  const today2 = new Date(); today2.setHours(12,0,0,0)
  const todayStr = fmtDate(today2)
  const cmDiff = today2.getDay()===0?-6:1-today2.getDay()
  const curMon = new Date(today2); curMon.setDate(today2.getDate()+cmDiff)
  const curMonStr = fmtDate(curMon)

  const weekEvents = await db.prepare(`SELECT * FROM leave_calendar_events WHERE date >= ? AND date <= ? ORDER BY date`).bind(wStart, wEnd).all()
  const approvedLeaves = await db.prepare(`
    SELECT ola.leave_date, ola.timeslots, m.chinese_name, m.section
    FROM official_leave_applications ola
    JOIN members m ON m.id = ola.member_id
    WHERE ola.status='approved' AND ola.leave_date>=? AND ola.leave_date<=?
    ORDER BY ola.leave_date
  `).bind(wStart, wEnd).all()
  const semEvents = semStart ? await db.prepare(`SELECT * FROM leave_calendar_events WHERE date>=? AND date<=? ORDER BY date`).bind(semStart, semEnd).all() : { results: [] }

  const blockedDates = new Set(weekEvents.results.filter((e:any)=>e.type==='blocked').map((e:any)=>e.date))
  const evTypeStyle: Record<string,string> = {
    blocked: 'bg-gray-100 border-l-4 border-gray-500 text-gray-700',
    holiday: 'bg-red-50 border-l-4 border-red-400 text-red-800',
    exam:    'bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800',
    event:   'bg-purple-50 border-l-4 border-purple-400 text-purple-800'
  }
  const evTypeIcon: Record<string,string> = { blocked:'⛔', holiday:'🔴', exam:'📋', event:'📌' }

  const dayColumns = weekDays.map(d => {
    const dStr = fmtDate(d)
    const isToday = dStr===todayStr, isWeekend = d.getDay()===0||d.getDay()===6
    const dayEv = weekEvents.results.filter((e:any)=>e.date===dStr)
    const dayRules = recurringRules.filter((r:any)=>r.dayOfWeek===d.getDay())
    const dayLeaves = approvedLeaves.results.filter((l:any)=>l.leave_date===dStr)
    const isBlocked = blockedDates.has(dStr)
    const evHtml = dayEv.map((e:any)=>{
      const s = evTypeStyle[e.type]||evTypeStyle.event
      const icon = evTypeIcon[e.type]||'📌'
      return `<div class="p-1.5 rounded text-xs font-medium ${s}">${icon} ${e.title}${e.description?`<div class="text-xs opacity-70 font-normal">${e.description}</div>`:''}</div>`
    }).join('')
    const ruleHtml = dayRules.map((r:any)=>`<div class="p-1.5 rounded text-xs font-medium bg-indigo-50 border-l-4 border-indigo-400 text-indigo-800">🔄 ${r.title}${r.description?`<div class="text-xs opacity-70 font-normal">${r.description}</div>`:''}</div>`).join('')
    const leaveHtml = dayLeaves.length>0 ? `<div class="mt-1"><div class="text-xs font-bold text-gray-500 border-b pb-0.5 mb-1">公假名單 (${dayLeaves.length})</div>${dayLeaves.map((l:any)=>{const ts=(()=>{try{return JSON.parse(l.timeslots)}catch{return[]}})();return `<div class="bg-green-50 text-green-800 text-xs p-1 rounded border border-green-100"><span class="font-bold">${l.chinese_name}</span><div class="text-gray-400 text-[10px]">${ts.join(', ')}</div></div>`}).join('')}</div>` : ''
    const isEmpty = dayEv.length===0&&dayRules.length===0&&dayLeaves.length===0
    return `<div class="${isToday?'ring-2 ring-blue-500':''} ${isWeekend?'bg-gray-50':'bg-white'} rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-[180px]">
      <div class="${isToday?'bg-blue-500 text-white':'bg-gray-100 text-gray-700'} px-3 py-2 rounded-t-xl text-center border-b">
        <div class="font-bold text-sm">星期${weekdayLabel(d.getDay())}</div>
        <div class="text-xs">${dStr.substring(5).replace('-','/')}</div>
        ${isBlocked?`<div class="text-xs text-red-500 mt-0.5">🔒 封鎖</div>`:''}
      </div>
      <div class="p-2 flex-1 space-y-1 text-sm">
        ${evHtml}${ruleHtml}${leaveHtml}
        ${isEmpty?'<p class="text-gray-300 text-xs text-center mt-4">無事項</p>':''}
      </div>
    </div>`
  }).join('')

  let semMonthsHtml = ''
  if (semStart && semEnd) {
    const s2 = new Date(semStart+'T12:00:00'), e2 = new Date(semEnd+'T12:00:00')
    const months: string[] = []
    const cur = new Date(s2.getFullYear(), s2.getMonth(), 1)
    while (cur <= e2) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`)
      cur.setMonth(cur.getMonth()+1)
    }
    const evStyles: Record<string,string> = {
      blocked:'bg-gray-100 text-gray-600', holiday:'bg-red-50 text-red-800',
      exam:'bg-yellow-50 text-yellow-800', event:'bg-blue-50 text-blue-800'
    }
    semMonthsHtml = months.map(m => {
      const mEv = (semEvents.results as any[]).filter(e=>e.date.startsWith(m))
      const mLabel = `${m.substring(0,4)} 年 ${parseInt(m.substring(5))} 月`
      const eRows = mEv.length===0
        ? '<div class="text-center text-gray-400 text-xs py-4">無特殊活動</div>'
        : mEv.map(e=>{
            const day = parseInt(e.date.substring(8))
            return `<div class="flex gap-2 items-start text-xs p-1.5 rounded ${evStyles[e.type]||evStyles.event}"><span class="font-mono font-bold w-5 shrink-0">${String(day).padStart(2,'0')}</span><div><div class="font-bold">${e.title}</div>${e.description?`<div class="opacity-70">${e.description}</div>`:''}</div></div>`
          }).join('')
      return `<div class="border rounded-lg overflow-hidden"><div class="bg-gray-200 py-1.5 text-center text-sm font-bold text-gray-700">${mLabel}</div><div class="p-2 space-y-1.5">${eRows}</div></div>`
    }).join('')
  }

  // ── 各 Tab 的 HTML 內容 ──
  const tabAttendanceHtml = `
    <!-- 統計卡 -->
    <div class="grid grid-cols-4 gap-3 mb-5">
      <div class="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
        <div class="text-2xl font-bold text-gray-700">${total}</div>
        <div class="text-xs text-gray-400 mt-1">總場次</div>
      </div>
      <div class="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
        <div class="text-2xl font-bold text-green-600">${present}</div>
        <div class="text-xs text-gray-400 mt-1">出席</div>
      </div>
      <div class="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
        <div class="text-2xl font-bold text-red-500">${stats?.absent || 0}</div>
        <div class="text-xs text-gray-400 mt-1">缺席</div>
      </div>
      <div class="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
        <div class="text-2xl font-bold ${rate >= 80 ? 'text-green-600' : rate >= 60 ? 'text-yellow-500' : 'text-red-500'}">${rate}%</div>
        <div class="text-xs text-gray-400 mt-1">出席率</div>
      </div>
    </div>

    <!-- 記錄列表 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100">
      <div class="p-4 border-b border-gray-100 flex items-center justify-between">
        <h2 class="font-semibold text-gray-800">近期出席狀況</h2>
        <button onclick="showLeaveForm()" class="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
          <i class="fas fa-calendar-plus"></i>申請請假
        </button>
      </div>
      ${sessions.results.length === 0 ? `<div class="p-8 text-center text-gray-400">尚無出席記錄</div>` :
        `<div class="divide-y divide-gray-50">
          ${sessions.results.map((s: any) => {
            let statusHtml = ''
            if (s.leave_id) {
              const ls = s.leave_status
              const lt = s.leave_type === 'official' ? '公假' : s.leave_type === 'sick' ? '病假' : '事假'
              statusHtml = `<span class="px-2 py-0.5 rounded-full text-xs status-${ls}">${lt} (${ls === 'approved' ? '已核准' : ls === 'pending' ? '待審' : '未核准'})</span>`
            } else if (s.my_status === 'present') {
              statusHtml = `<span class="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">✓ 出席</span>`
            } else if (s.my_status === 'absent') {
              statusHtml = `<span class="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">✗ 缺席</span>`
            } else {
              statusHtml = `<span class="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">未記錄</span>`
            }
            return `
            <div class="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div>
                <div class="font-medium text-gray-800 text-sm">${s.title}</div>
                <div class="text-xs text-gray-400 mt-0.5">${s.date} · ${s.section}${s.topic ? ` · ${s.topic}` : ''}</div>
              </div>
              <div class="flex items-center gap-2">
                ${statusHtml}
                ${!s.leave_id && s.my_status !== 'present' ? `
                <button onclick="showLeaveForm('${s.id}', '${s.title.replace(/'/g,"\\'")}', '${s.date}')" class="text-xs text-blue-500 hover:text-blue-700">
                  <i class="fas fa-calendar-plus"></i>
                </button>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>`}
    </div>`

  const tabLeaveHtml = `
    <div class="bg-white rounded-xl shadow-sm border border-gray-100">
      <div class="p-4 border-b border-gray-100 flex items-center justify-between">
        <h2 class="font-semibold text-gray-800">請假申請記錄</h2>
        <button onclick="showLeaveForm()" class="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
          <i class="fas fa-plus"></i>新增申請
        </button>
      </div>
      ${leaves.results.length === 0 ? `<div class="p-8 text-center text-gray-400">
        <i class="fas fa-calendar-times text-4xl mb-3 block"></i>
        <p>尚無請假記錄</p>
        <button onclick="showLeaveForm()" class="mt-3 bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-sm hover:bg-blue-100 transition-colors">
          <i class="fas fa-plus mr-1"></i>新增第一筆請假申請
        </button>
      </div>` : `
      <div class="divide-y divide-gray-50">
        ${leaves.results.map((l: any) => `
        <div class="p-4 hover:bg-gray-50 transition-colors">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1">
              <div class="font-medium text-gray-800">${l.session_title}</div>
              <div class="text-xs text-gray-400 mt-0.5">${leaveTypeLabel[l.leave_type] || l.leave_type} · 日期：${l.date}</div>
              ${l.reason ? `<div class="text-sm text-gray-600 mt-1">${l.reason}</div>` : ''}
              ${l.admin_note ? `<div class="text-xs text-blue-600 mt-1 bg-blue-50 px-2 py-1 rounded"><i class="fas fa-comment mr-1"></i>管理員：${l.admin_note}</div>` : ''}
            </div>
            <div class="flex flex-col items-end gap-1">
              <span class="px-3 py-1 rounded-full text-xs font-medium status-${l.status}">
                ${statusLabel[l.status] || l.status}
              </span>
              <span class="text-xs text-gray-400">${l.created_at?.substring(0,10) || ''}</span>
            </div>
          </div>
        </div>`).join('')}
      </div>`}
    </div>`

  const tabOfficialHtml = `
    <!-- 公假操作列 -->
    <div class="flex gap-2 flex-wrap mb-4">
      <a href="/member/official-leave/apply" class="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 shadow-sm">
        <i class="fas fa-edit"></i>申請公假
      </a>
      <a href="/member/official-leave/my" class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2">
        <i class="fas fa-list"></i>我的公假申請
      </a>
    </div>
    <!-- 週視圖導航 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-3 mb-4 flex items-center gap-4 flex-wrap">
      <a href="/member/attendance?tab=official-leave&week=${fmtDate(prevWeek)}" class="flex items-center gap-1 text-gray-600 hover:text-blue-600 font-medium text-sm"><i class="fas fa-chevron-left"></i>上一週</a>
      <h2 class="text-base font-bold text-gray-800 flex-1 text-center">${wStart.substring(0,4)}/${wStart.substring(5,7)}/${wStart.substring(8,10)} - ${wEnd.substring(5,7)}/${wEnd.substring(8,10)}</h2>
      <a href="/member/attendance?tab=official-leave&week=${fmtDate(nextWeek)}" class="flex items-center gap-1 text-gray-600 hover:text-blue-600 font-medium text-sm">下一週<i class="fas fa-chevron-right"></i></a>
      ${wStart!==curMonStr?`<a href="/member/attendance?tab=official-leave&week=${curMonStr}" class="text-blue-600 hover:underline text-sm">回到今天</a>`:''}
    </div>
    <!-- 週曆格 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">${dayColumns}</div>
    ${semStart?`
    <div class="bg-white rounded-2xl shadow-sm border-t-4 border-indigo-600 p-5 mb-4">
      <h2 class="text-lg font-bold text-indigo-900 flex items-center gap-2 mb-4"><i class="fas fa-school text-indigo-600"></i>學期行事曆 <span class="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">${semStart} ～ ${semEnd}</span></h2>
      ${recurringRules.length>0?`<div class="mb-4 bg-indigo-50 p-3 rounded-lg border border-indigo-100"><div class="flex flex-wrap gap-3">${recurringRules.map((r:any)=>`<div class="flex items-center gap-1.5 text-sm"><span class="bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded font-bold text-xs">週${weekdayLabel(r.dayOfWeek)}</span><span class="font-medium text-gray-800">${r.title}</span>${r.description?`<span class="text-gray-500 text-xs">(${r.description})</span>`:''}</div>`).join('')}</div></div>`:''}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${semMonthsHtml}</div>
    </div>`:''}
  `

  // Tab 定義
  const tabs = [
    { key: 'attendance',    label: '出席記錄', icon: 'fas fa-calendar-check' },
    { key: 'leave',         label: '請假申請', icon: 'fas fa-calendar-times' },
    { key: 'official-leave', label: '公假行事曆', icon: 'fas fa-calendar-alt' },
  ]

  const tabContent = activeTab === 'leave' ? tabLeaveHtml : activeTab === 'official-leave' ? tabOfficialHtml : tabAttendanceHtml

  return c.html(`${memberHead('出席與請假')}
<body class="bg-gray-50 min-h-screen">
  ${memberNav(member.chinese_name, member.section, 'attendance')}
  <div class="max-w-5xl mx-auto px-4 py-6 fade-in">

    <!-- 頁面標題 -->
    <div class="mb-5">
      <h1 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
        <i class="fas fa-calendar-check text-blue-600"></i>出席管理
      </h1>
      <p class="text-sm text-gray-400 mt-0.5">${member.chinese_name} · ${displaySection}</p>
    </div>

    <!-- Tab 列 -->
    <div class="flex gap-2 mb-5 border-b border-gray-200 pb-0">
      ${tabs.map(t => `
      <a href="/member/attendance?tab=${t.key}" class="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px
        ${activeTab === t.key
          ? 'border-blue-600 text-blue-700 bg-white'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}">
        <i class="${t.icon}"></i>${t.label}
      </a>`).join('')}
    </div>

    <!-- Tab 內容 -->
    <div id="tabContent">
      ${tabContent}
    </div>
  </div>

  <!-- 請假申請 Modal -->
  <div id="leaveModal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
      <div class="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-4 text-white flex items-center justify-between">
        <h3 class="font-bold flex items-center gap-2"><i class="fas fa-calendar-plus"></i>申請請假</h3>
        <button onclick="document.getElementById('leaveModal').classList.add('hidden')" class="text-white/70 hover:text-white text-xl leading-none">&times;</button>
      </div>
      <div class="p-5">
        <form id="leaveModalForm" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">請假類型</label>
            <select name="leave_type" required
              class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
              <option value="personal">📝 事假</option>
              <option value="sick">🏥 病假</option>
              <option value="official">⚡ 公假</option>
              <option value="other">📌 其他</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">關聯例會（選填）</label>
            <select name="session_id" id="leaveSessionSelect"
              class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
              <option value="">-- 自訂日期 --</option>
              ${upcomingSessions.results.map((s: any) => `
              <option value="${s.id}" data-date="${s.date}">${s.date} - ${s.title}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">請假日期 <span class="text-red-500">*</span></label>
            <input type="date" name="date" id="leaveDateInput" required
              class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">請假原因</label>
            <textarea name="reason" rows="2"
              class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              placeholder="請說明請假原因"></textarea>
          </div>
          <div id="leaveModalMsg"></div>
          <button type="submit"
            class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
            <i class="fas fa-paper-plane"></i>送出請假申請
          </button>
        </form>
      </div>
    </div>
  </div>

  <script>
    function showLeaveForm(sessionId, sessionTitle, sessionDate) {
      const modal = document.getElementById('leaveModal')
      const sel = document.getElementById('leaveSessionSelect')
      const dateInput = document.getElementById('leaveDateInput')
      if (sessionId) {
        sel.value = sessionId
        dateInput.value = sessionDate || ''
      } else {
        sel.value = ''
        dateInput.value = ''
      }
      modal.classList.remove('hidden')
    }
    document.getElementById('leaveSessionSelect').addEventListener('change', function() {
      const opt = this.selectedOptions[0]
      if (opt.value && opt.dataset.date) {
        document.getElementById('leaveDateInput').value = opt.dataset.date
      }
    })
    document.getElementById('leaveModalForm').addEventListener('submit', async (e) => {
      e.preventDefault()
      const msg = document.getElementById('leaveModalMsg')
      const form = e.target
      const fd = new FormData(form)
      const data = {
        leave_type: fd.get('leave_type'),
        session_id: fd.get('session_id') || null,
        date: fd.get('date'),
        reason: fd.get('reason')
      }
      if (!data.date) { msg.innerHTML = '<p class="text-red-500 text-sm">請填寫請假日期</p>'; return }
      msg.innerHTML = '<p class="text-gray-400 text-sm">送出中...</p>'
      try {
        const res = await fetch('/api/member/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
        const r = await res.json()
        if (r.success) {
          msg.innerHTML = '<p class="text-green-600 text-sm"><i class="fas fa-check-circle mr-1"></i>申請已送出！</p>'
          setTimeout(() => location.href = '/member/attendance?tab=leave', 1500)
        } else {
          msg.innerHTML = '<p class="text-red-500 text-sm">送出失敗：' + (r.error || '未知錯誤') + '</p>'
        }
      } catch(err) {
        msg.innerHTML = '<p class="text-red-500 text-sm">網路錯誤，請稍後再試</p>'
      }
    })
    // 點擊背景關閉
    document.getElementById('leaveModal').addEventListener('click', function(e) {
      if (e.target === this) this.classList.add('hidden')
    })
  </script>
</body></html>`)
})

// ===================== 晉升申請 → redirect 到 progress?tab=advancement =====================
memberRoutes.get('/advancement', memberAuthMiddleware, (c) => {
  return c.redirect('/member/progress?tab=advancement')
})


// =====================================================================
// 公假行事曆系統
// =====================================================================

// ===== 公假行事曆首頁 → redirect 到 attendance?tab=official-leave =====
memberRoutes.get('/official-leave', memberAuthMiddleware, (c) => {
  const week = c.req.query('week')
  return c.redirect(week ? `/member/attendance?tab=official-leave&week=${week}` : '/member/attendance?tab=official-leave')
})


// ===== 公假申請表單 =====
memberRoutes.get('/official-leave/apply', memberAuthMiddleware, async (c) => {
  const db = c.env.DB
  const sess = c.get('memberSession') as any
  const member = await db.prepare(`SELECT * FROM members WHERE id = ?`).bind(sess.memberId).first() as any
  if (!member) return c.redirect('/member/login')

  const settingRows = await db.prepare(
    `SELECT key, value FROM site_settings WHERE key LIKE 'official_leave%'`
  ).all()
  const sMap: Record<string,string> = {}
  settingRows.results.forEach((r:any) => { sMap[r.key]=r.value })
  const semStart = sMap['official_leave_semester_start']||''
  const semEnd   = sMap['official_leave_semester_end']||''
  let allowedDays: number[] = [1,2,3,4,5]
  try { allowedDays = JSON.parse(sMap['official_leave_allowed_weekdays']||'[1,2,3,4,5]') } catch {}
  const dowLabels = ['日','一','二','三','四','五','六']
  const allowedStr = allowedDays.map(d=>`星期${dowLabels[d]}`).join('、')

  const timeslots = [
    { id:'M',   label:'M（11:30 - 12:10）' },
    { id:'H',   label:'H（12:15 - 12:55）' },
    { id:'午休', label:'午休（12:55 - 13:20）' },
    { id:'其他', label:'其他時間' }
  ]

  return c.html(`${memberHead('午間公假申請')}
<body class="bg-gray-50 min-h-screen">
  ${memberNav(sess.memberName, sess.section, 'attendance')}
  <div class="max-w-2xl mx-auto px-4 py-8 fade-in">
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-5">
        <h1 class="text-2xl font-bold flex items-center gap-2"><i class="fas fa-edit"></i>午間公假申請</h1>
        <p class="text-blue-100 text-sm mt-1">申請成功後需等待管理員審核</p>
      </div>
      <div class="p-6 space-y-5">
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2"><i class="fas fa-user text-blue-500 mr-1"></i>申請人</label>
          <div class="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <div class="font-bold text-gray-900 text-base">${member.chinese_name}</div>
            <div class="grid grid-cols-2 gap-3 mt-2">
              <div class="text-sm text-gray-600"><span class="text-gray-400 text-xs">組別</span><br><span class="font-medium">${member.section}</span></div>
              <div class="text-sm text-gray-600"><span class="text-gray-400 text-xs">隊別</span><br><span class="font-medium">${member.unit_name||'-'}</span></div>
            </div>
          </div>
        </div>
        <div>
          <label for="leave_date" class="block text-sm font-semibold text-gray-700 mb-2"><i class="fas fa-calendar text-blue-500 mr-1"></i>請假日期 <span class="text-red-500">*</span></label>
          <input type="date" id="leave_date" name="leave_date" min="${semStart}" max="${semEnd}"
            class="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-blue-500 focus:outline-none transition-colors"
            onchange="checkDate(this.value)">
          <div id="dateMsg" class="mt-1.5 text-xs text-gray-500">
            <i class="fas fa-info-circle mr-1"></i>請選擇平日午間時段。學期範圍：${semStart||'未設定'} ~ ${semEnd||'未設定'} · 開放日：${allowedStr}
          </div>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2"><i class="fas fa-clock text-blue-500 mr-1"></i>請假時段 <span class="text-red-500">*</span>（可複選）</label>
          <div class="space-y-2">
            ${timeslots.map(t=>`<label class="flex items-center gap-3 p-3 rounded-xl border-2 border-gray-100 hover:border-blue-300 cursor-pointer transition-colors"><input type="checkbox" name="timeslots" value="${t.id}" class="w-4 h-4 text-blue-600 rounded"><span class="text-sm font-medium text-gray-800">${t.label}</span></label>`).join('')}
          </div>
        </div>
        <div>
          <label for="reason" class="block text-sm font-semibold text-gray-700 mb-2"><i class="fas fa-comment-alt text-blue-500 mr-1"></i>事由（選填）</label>
          <textarea id="reason" rows="3" placeholder="請簡要說明公假原因..." class="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-blue-500 focus:outline-none transition-colors resize-none"></textarea>
        </div>
        <div class="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 space-y-3">
          <label class="flex items-start gap-3 cursor-pointer"><input type="checkbox" id="chk_conflict" class="w-4 h-4 mt-0.5 text-blue-600 rounded flex-shrink-0"><span class="text-sm text-gray-700">我確認此時段 <strong>**不與班級重要事務衝突**</strong>（如考試、活動等）。</span></label>
          <label class="flex items-start gap-3 cursor-pointer"><input type="checkbox" id="chk_teacher" class="w-4 h-4 mt-0.5 text-blue-600 rounded flex-shrink-0"><span class="text-sm text-gray-700">我已 <strong>**告知班級導師**</strong> 我將申請此公假。</span></label>
        </div>
        <div id="submitMsg" class="hidden"></div>
        <div class="grid grid-cols-2 gap-3 pt-2">
          <a href="/member/official-leave" class="bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium transition-colors text-center">取消</a>
          <button id="submitBtn" onclick="submitLeave()" class="bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"><i class="fas fa-paper-plane"></i>送出申請</button>
        </div>
      </div>
    </div>
  </div>
  <script>
    const MEMBER_ID = '${sess.memberId}'
    async function checkDate(date) {
      const msg = document.getElementById('dateMsg')
      if (!date) return
      msg.innerHTML = '<span class="text-gray-400"><i class="fas fa-spinner fa-spin mr-1"></i>檢查中...</span>'
      try {
        const res = await fetch('/api/official-leave/check-date?date=' + date)
        const r = await res.json()
        if (r.allowed) {
          msg.innerHTML = '<span class="text-green-600"><i class="fas fa-check-circle mr-1"></i>此日期可以申請公假</span>'
        } else {
          msg.innerHTML = '<span class="text-red-500"><i class="fas fa-times-circle mr-1"></i>' + (r.reason||'此日期不開放申請') + '</span>'
        }
      } catch { msg.innerHTML = '<span class="text-gray-400">無法檢查日期，請繼續填寫</span>' }
    }
    async function submitLeave() {
      const btn = document.getElementById('submitBtn')
      const leave_date = document.getElementById('leave_date').value
      const timeslots = [...document.querySelectorAll('input[name="timeslots"]:checked')].map(c => c.value)
      const reason = document.getElementById('reason').value.trim()
      const conflict = document.getElementById('chk_conflict').checked
      const teacher = document.getElementById('chk_teacher').checked
      if (!leave_date) { showMsg('請選擇請假日期','red'); return }
      if (timeslots.length===0) { showMsg('請至少選擇一個時段','red'); return }
      if (!conflict) { showMsg('請確認不與班級重要事務衝突','red'); return }
      if (!teacher) { showMsg('請確認已告知班級導師','red'); return }
      btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin mr-1"></i>送出中...'
      showMsg('送出中，請稍後...','gray')
      try {
        const res = await fetch('/api/official-leave', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ member_id:MEMBER_ID, leave_date, timeslots, reason:reason||null, is_conflict_checked:true, is_teacher_informed:true })
        })
        const r = await res.json()
        if (r.success) {
          showMsg('✅ 申請已送出！管理員審核後將生效。','green')
          setTimeout(()=>{ window.location.href='/member/official-leave/my' }, 2000)
        } else {
          showMsg('送出失敗：'+(r.error||'未知錯誤'),'red')
          btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i>送出申請'
        }
      } catch(e) {
        showMsg('網路錯誤，請稍後再試','red')
        btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i>送出申請'
      }
    }
    function showMsg(text,color) {
      const msg=document.getElementById('submitMsg')
      msg.classList.remove('hidden')
      const colors={red:'bg-red-50 border-red-200 text-red-700',green:'bg-green-50 border-green-200 text-green-700',gray:'bg-gray-50 border-gray-200 text-gray-600'}
      msg.innerHTML='<div class="px-4 py-3 rounded-xl border text-sm '+(colors[color]||colors.gray)+'">'+text+'</div>'
    }
  </script>
</body></html>`)
})

// ===== 我的公假申請記錄 =====
memberRoutes.get('/official-leave/my', memberAuthMiddleware, async (c) => {
  const db = c.env.DB
  const sess = c.get('memberSession') as any
  const applications = await db.prepare(`
    SELECT id, leave_date, timeslots, reason, status, admin_note, created_at
    FROM official_leave_applications WHERE member_id=? ORDER BY leave_date DESC
  `).bind(sess.memberId).all()

  const statusLabel: Record<string,string> = { pending:'⏳ 待審核', approved:'✅ 已核准', rejected:'❌ 未通過', uploaded:'📤 已上傳' }
  const statusClass: Record<string,string> = { pending:'bg-yellow-100 text-yellow-800', approved:'bg-green-100 text-green-800', rejected:'bg-red-100 text-red-800', uploaded:'bg-blue-100 text-blue-800' }

  const rows = applications.results.map((a:any) => {
    const ts: string[] = (() => { try{return JSON.parse(a.timeslots)}catch{return[]} })()
    return `<div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4" id="app-${a.id}">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1">
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <span class="text-sm font-bold text-gray-800">${a.leave_date}</span>
            <span class="text-xs px-2 py-0.5 rounded-full font-medium ${statusClass[a.status]||'bg-gray-100 text-gray-700'}">${statusLabel[a.status]||a.status}</span>
          </div>
          <div class="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
            <span><i class="fas fa-clock mr-1"></i>${ts.join('、')}</span>
            ${a.reason?`<span><i class="fas fa-comment mr-1"></i>${a.reason}</span>`:''}
          </div>
          ${a.admin_note?`<div class="mt-2 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100"><i class="fas fa-comment-dots mr-1"></i>管理員備註：${a.admin_note}</div>`:''}
        </div>
        ${a.status==='pending'?`<button onclick="cancelLeave('${a.id}')" class="text-red-400 hover:text-red-600 text-xs px-3 py-1.5 rounded-lg hover:bg-red-50 border border-gray-200 transition-colors flex-shrink-0">取消申請</button>`:''}
      </div>
    </div>`
  }).join('')

  return c.html(`${memberHead('我的公假申請')}
<body class="bg-gray-50 min-h-screen">
  ${memberNav(sess.memberName, sess.section, 'attendance')}
  <div class="max-w-2xl mx-auto px-4 py-6 fade-in">
    <div class="flex items-center justify-between mb-5">
      <h1 class="text-xl font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-list text-blue-600"></i>我的公假申請</h1>
      <div class="flex gap-2">
        <a href="/member/official-leave/apply" class="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-xl transition-colors flex items-center gap-2"><i class="fas fa-plus"></i>新增申請</a>
        <a href="/member/official-leave" class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-3 py-2 rounded-xl transition-colors"><i class="fas fa-calendar-alt"></i></a>
      </div>
    </div>
    ${applications.results.length===0
      ? `<div class="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm"><div class="text-5xl mb-3">📋</div><h3 class="font-semibold text-gray-700 mb-2">尚無公假申請記錄</h3><a href="/member/official-leave/apply" class="text-blue-600 hover:underline text-sm">+ 申請公假</a></div>`
      : `<div class="space-y-3">${rows}</div>`}
  </div>
  <script>
    async function cancelLeave(id) {
      if (!confirm('確定取消此公假申請？')) return
      const res = await fetch('/api/official-leave/'+id, {method:'DELETE'})
      const r = await res.json()
      if (r.success) { const el=document.getElementById('app-'+id); if(el) el.remove() }
      else alert('取消失敗：'+(r.error||'未知錯誤'))
    }
  </script>
</body></html>`)
})
