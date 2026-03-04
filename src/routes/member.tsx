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

function memberNav(memberName: string, section: string) {
  const sectionIcon = section.includes('羅浮') ? '⚜️' : section.includes('行義') ? '🔰' : '⚜️'
  return `
<nav class="bg-[#1a472a] text-white shadow-lg sticky top-0 z-50">
  <div class="max-w-6xl mx-auto px-4">
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
        <span class="text-yellow-400 text-sm">${sectionIcon} ${memberName}</span>
        <a href="/member/logout" class="bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-full transition-colors">
          <i class="fas fa-sign-out-alt mr-1"></i>登出
        </a>
      </div>
    </div>
    <div class="flex gap-1 pb-2 overflow-x-auto">
      <a href="/member" class="text-xs whitespace-nowrap px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
        <i class="fas fa-th-large mr-1"></i>總覽
      </a>
      <a href="/member/progress" class="text-xs whitespace-nowrap px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
        <i class="fas fa-chart-line mr-1"></i>晉升進度
      </a>
      <a href="/member/attendance" class="text-xs whitespace-nowrap px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
        <i class="fas fa-calendar-check mr-1"></i>出席記錄
      </a>
      <a href="/member/leave" class="text-xs whitespace-nowrap px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
        <i class="fas fa-calendar-times mr-1"></i>請假申請
      </a>
      <a href="/member/advancement" class="text-xs whitespace-nowrap px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
        <i class="fas fa-arrow-up mr-1"></i>晉升申請
      </a>
      <a href="/member/official-leave" class="text-xs whitespace-nowrap px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
        <i class="fas fa-calendar-alt mr-1"></i>公假行事曆
      </a>
      <a href="/member/activities" class="text-xs whitespace-nowrap px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
        <i class="fas fa-campground mr-1"></i>活動報名
      </a>
    </div>
  </div>
</nav>`
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
  ${memberNav(member.chinese_name, displaySection)}
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
          <a href="/member/leave/new" class="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-1">
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
          <a href="/member/leave" class="text-xs text-green-600 hover:underline">全部查看</a>
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
          <a href="/member/leave/new" class="block w-full text-center py-2 mt-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm rounded-lg transition-colors">
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
        <a href="/member/advancement" class="text-xs text-green-600 hover:underline">查看詳情</a>
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

  </div>
</body></html>`)
})

// ===================== 晉升進度頁面 =====================
memberRoutes.get('/progress', memberAuthMiddleware, async (c) => {
  const db = c.env.DB
  const sess = c.get('memberSession') as any
  const memberId = sess.memberId

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

  // 取得專科章資料（用於進程頁面的晉級檢核區塊）
  const allBadgesProgress = await db.prepare(`SELECT * FROM specialty_badges WHERE is_active=1`).all()
  const myBadgesProgress = await db.prepare(`
    SELECT msb.badge_id, sb.name, msb.obtained_date
    FROM member_specialty_badges msb
    JOIN specialty_badges sb ON sb.id = msb.badge_id
    WHERE msb.member_id = ?
  `).bind(memberId).all()
  const myBadgeSetProgress = new Set(myBadgesProgress.results.map((b:any) => b.name))
  const myBadgeCountProgress = myBadgesProgress.results.length

  // 適用於童軍與行義童軍的晉級必備章定義
  const rankBadgeReqsProgress = member.section !== '羅浮童軍' ? [
    {
      rank: '獅級童軍', totalRequired: 5, color: 'amber',
      bgColor: 'bg-amber-50', textColor: 'text-amber-800', borderColor: 'border-amber-300',
      requiredBadges: [
        { name: '露營', isOptional: false, choices: [] as string[] },
        { name: '旅行', isOptional: false, choices: [] as string[] },
        { name: '社區公民', isOptional: false, choices: [] as string[] }
      ],
      electiveBadges: 2,
      description: '含 3 枚必備章 + 自選 2 枚任意技能章'
    },
    {
      rank: '長城童軍', totalRequired: 11, color: 'red',
      bgColor: 'bg-red-50', textColor: 'text-red-800', borderColor: 'border-red-300',
      requiredBadges: [
        { name: '國家公民', isOptional: false, choices: [] as string[] },
        { name: '急救', isOptional: false, choices: [] as string[] },
        { name: '運動技能', isOptional: true, choices: ['游泳', '自行車', '越野'] }
      ],
      electiveBadges: 8,
      description: '含 3 枚必備章（運動擇一）+ 自選 8 枚'
    },
    {
      rank: '國花童軍', totalRequired: 18, color: 'purple',
      bgColor: 'bg-purple-50', textColor: 'text-purple-800', borderColor: 'border-purple-300',
      requiredBadges: [
        { name: '世界公民', isOptional: false, choices: [] as string[] },
        { name: '生態保育', isOptional: false, choices: [] as string[] },
        { name: '測量', isOptional: false, choices: [] as string[] },
        { name: '生物類', isOptional: true, choices: ['植物', '昆蟲', '賞鳥'] },
        { name: '藝術類', isOptional: true, choices: ['音樂', '舞蹈', '攝影'] }
      ],
      electiveBadges: 13,
      description: '含 5 枚必備章（生物、藝術各擇一）+ 自選 13 枚'
    }
  ] : [] as any[]

  function checkBadgeReqProgress(req: { name: string, isOptional: boolean, choices: string[] }, has: Set<string>): boolean {
    if (req.isOptional && req.choices.length > 0) return req.choices.some(c => has.has(c))
    return has.has(req.name)
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
      ${rankBadgeReqsProgress.map((req: any, idx: number) => {
        const allReqDone = req.requiredBadges.every((b:any) => checkBadgeReqProgress(b, myBadgeSetProgress))
        const hasEnough = myBadgeCountProgress >= req.totalRequired
        const isFullyDone = allReqDone && hasEnough
        return `
        ${idx > 0 ? '<i class="fas fa-chevron-right text-gray-300 text-xs"></i>' : ''}
        <div class="flex flex-col items-center gap-1">
          <div class="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shadow-sm
            ${isFullyDone ? 'bg-green-500 text-white' : allReqDone ? 'bg-' + req.color + '-100 text-' + req.color + '-700 border-2 border-' + req.color + '-300' : 'bg-gray-200 text-gray-400'}">
            ${isFullyDone ? '<i class="fas fa-check"></i>' : myBadgeCountProgress + '/' + req.totalRequired}
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
      ${rankBadgeReqsProgress.map((req: any) => {
        const allReqDone = req.requiredBadges.every((b:any) => checkBadgeReqProgress(b, myBadgeSetProgress))
        const hasEnough = myBadgeCountProgress >= req.totalRequired
        const isFullyDone = allReqDone && hasEnough
        const doneReqCount = req.requiredBadges.filter((b:any) => checkBadgeReqProgress(b, myBadgeSetProgress)).length
        const pct = Math.min(100, Math.round(myBadgeCountProgress / req.totalRequired * 100))

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
              : `<div class="text-sm font-bold ${req.textColor}">${doneReqCount}/${req.requiredBadges.length} 必備</div>`
            }
          </div>

          <!-- 必備章列表 -->
          <div class="space-y-1.5 mb-2.5">
            ${req.requiredBadges.map((badge:any) => {
              const obtained = checkBadgeReqProgress(badge, myBadgeSetProgress)
              const obtainedName = badge.isOptional ? (badge.choices.find((c:string) => myBadgeSetProgress.has(c)) || '') : ''
              return `
              <div class="flex items-center gap-2 ${obtained ? '' : 'opacity-60'}">
                <div class="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center
                  ${obtained ? 'bg-green-500' : 'bg-white border-2 border-gray-300'}">
                  ${obtained ? '<i class="fas fa-check text-white" style="font-size:9px"></i>' : ''}
                </div>
                <span class="text-xs ${obtained ? 'text-gray-800 font-medium' : 'text-gray-500'}">
                  ${badge.isOptional ? (obtainedName || badge.choices.join('/')) : badge.name}
                  ${badge.isOptional ? '<span class="text-gray-400">（擇一）</span>' : ''}
                </span>
              </div>`
            }).join('')}
          </div>

          <!-- 總枚數進度條 -->
          <div class="border-t border-gray-100 pt-2">
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="text-gray-400">自選章進度</span>
              <span class="${hasEnough ? 'text-green-700 font-bold' : 'text-gray-400'}">${myBadgeCountProgress}/${req.totalRequired}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-1.5">
              <div class="h-1.5 rounded-full transition-all ${hasEnough ? 'bg-green-500' : 'bg-' + req.color + '-400'}"
                style="width:${pct}%"></div>
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-2 leading-tight">${req.description}</p>
        </div>`
      }).join('')}
    </div>

    <div class="mt-3 text-xs text-gray-400 flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-2">
      <i class="fas fa-info-circle text-blue-400"></i>
      專科章由服務員在後台記錄，如數量有誤請聯繫服務員。
      <a href="/member/advancement" class="text-green-600 underline ml-auto flex-shrink-0">申請晉升 →</a>
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
            <a href="/member/advancement" class="bg-white text-green-700 text-xs font-medium px-3 py-1.5 rounded-full hover:opacity-90 transition-opacity shadow-sm">
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

  return c.html(`${memberHead('晉升進度')}
<body class="bg-gray-50 min-h-screen">
  ${memberNav(member.chinese_name, member.section)}
  <div class="max-w-3xl mx-auto px-4 py-6 fade-in">

    <!-- 頁面標題 + 整體進度 -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <i class="fas fa-chart-line text-green-600"></i>晉升進度
          </h1>
          <div class="flex flex-wrap items-center gap-3 mt-1">
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
          <a href="/member/advancement"
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

    <!-- 專科章與晉級檢核儀表板 -->
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
    </div>
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
    ${memberNav(member.chinese_name, member.section)}
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

// ===================== 出席記錄頁面 =====================
memberRoutes.get('/attendance', memberAuthMiddleware, async (c) => {
  const db = c.env.DB
  const sess = c.get('memberSession') as any
  const memberId = sess.memberId
  const member = await db.prepare(`SELECT * FROM members WHERE id = ?`).bind(memberId).first() as any

  // 年度在籍資料優先
  const yearSetting = await db.prepare(`SELECT value FROM site_settings WHERE key='current_year_label'`).first() as any
  const currentYear = yearSetting?.value || '114'
  const enrollment = await db.prepare(`SELECT section FROM member_enrollments WHERE member_id=? AND year_label=? AND is_active=1`).bind(memberId, currentYear).first() as any
  const displaySection = enrollment?.section || member.section

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

  return c.html(`${memberHead('出席記錄')}
<body class="bg-gray-50 min-h-screen">
  ${memberNav(member.chinese_name, member.section)}
  <div class="max-w-4xl mx-auto px-4 py-6 fade-in">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-800">出席記錄</h1>
      <a href="/member/leave/new" class="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
        <i class="fas fa-calendar-plus"></i>申請請假
      </a>
    </div>

    <!-- 統計 -->
    <div class="grid grid-cols-4 gap-3 mb-6">
      <div class="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
        <div class="text-2xl font-bold text-gray-700">${total}</div>
        <div class="text-xs text-gray-400">總場次</div>
      </div>
      <div class="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
        <div class="text-2xl font-bold text-green-600">${present}</div>
        <div class="text-xs text-gray-400">出席</div>
      </div>
      <div class="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
        <div class="text-2xl font-bold text-red-500">${stats?.absent || 0}</div>
        <div class="text-xs text-gray-400">缺席</div>
      </div>
      <div class="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
        <div class="text-2xl font-bold ${rate >= 80 ? 'text-green-600' : rate >= 60 ? 'text-yellow-500' : 'text-red-500'}">${rate}%</div>
        <div class="text-xs text-gray-400">出席率</div>
      </div>
    </div>

    <!-- 記錄列表 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100">
      <div class="p-4 border-b border-gray-100">
        <h2 class="font-semibold text-gray-800">近期出席狀況</h2>
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
                <div class="text-xs text-gray-400 mt-0.5">
                  ${s.date} · ${s.section}
                  ${s.topic ? ` · ${s.topic}` : ''}
                </div>
              </div>
              <div class="flex items-center gap-2">
                ${statusHtml}
                ${!s.leave_id && s.my_status !== 'present' ? `
                <a href="/member/leave/new?session_id=${s.id}" class="text-xs text-blue-500 hover:underline">
                  <i class="fas fa-calendar-plus mr-1"></i>請假
                </a>` : ''}
              </div>
            </div>`
          }).join('')}
        </div>`}
    </div>
  </div>
</body></html>`)
})

// ===================== 請假申請 =====================
memberRoutes.get('/leave', memberAuthMiddleware, async (c) => {
  const db = c.env.DB
  const sess = c.get('memberSession') as any
  const memberId = sess.memberId
  const member = await db.prepare(`SELECT * FROM members WHERE id = ?`).bind(memberId).first() as any

  const leaves = await db.prepare(`
    SELECT lr.*, COALESCE(as2.title, '自訂日期') as session_title, as2.date as session_date_actual
    FROM leave_requests lr
    LEFT JOIN attendance_sessions as2 ON as2.id = lr.session_id
    WHERE lr.member_id = ?
    ORDER BY lr.created_at DESC
  `).bind(memberId).all()

  const statusLabel: Record<string, string> = { pending: '⏳ 待審核', approved: '✅ 已核准', rejected: '❌ 未核准' }
  const leaveTypeLabel: Record<string, string> = { official: '⚡ 公假', sick: '🏥 病假', personal: '📝 事假', other: '📌 其他' }

  return c.html(`${memberHead('請假記錄')}
<body class="bg-gray-50 min-h-screen">
  ${memberNav(member.chinese_name, member.section)}
  <div class="max-w-3xl mx-auto px-4 py-6 fade-in">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-800">請假申請記錄</h1>
      <a href="/member/leave/new" class="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
        <i class="fas fa-plus"></i>新增申請
      </a>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100">
      ${leaves.results.length === 0 ? `<div class="p-8 text-center text-gray-400">
        <i class="fas fa-calendar-times text-4xl mb-3"></i>
        <p>尚無請假記錄</p>
        <a href="/member/leave/new" class="mt-3 inline-block bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-sm hover:bg-blue-100 transition-colors">
          <i class="fas fa-plus mr-1"></i>新增第一筆請假申請
        </a>
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
    </div>
  </div>
</body></html>`)
})

// 新增請假申請表單
memberRoutes.get('/leave/new', memberAuthMiddleware, async (c) => {
  const db = c.env.DB
  const sess = c.get('memberSession') as any
  const memberId = sess.memberId
  const preSessionId = c.req.query('session_id') || ''
  const member = await db.prepare(`SELECT * FROM members WHERE id = ?`).bind(memberId).first() as any

  // 取得近期未請假的例會（供選擇）
  const upcomingSessions = await db.prepare(`
    SELECT as2.id, as2.title, as2.date, as2.section
    FROM attendance_sessions as2
    WHERE (as2.section = ? OR as2.section = 'all')
      AND NOT EXISTS (
        SELECT 1 FROM leave_requests lr WHERE lr.session_id = as2.id AND lr.member_id = ?
      )
    ORDER BY as2.date DESC LIMIT 20
  `).bind(member.section, memberId).all()

  const success = c.req.query('success')

  return c.html(`${memberHead('申請請假')}
<body class="bg-gray-50 min-h-screen">
  ${memberNav(member.chinese_name, member.section)}
  <div class="max-w-2xl mx-auto px-4 py-6 fade-in">
    <div class="mb-6">
      <a href="/member/leave" class="text-green-600 hover:underline text-sm flex items-center gap-1">
        <i class="fas fa-arrow-left"></i>返回請假記錄
      </a>
      <h1 class="text-2xl font-bold text-gray-800 mt-2">新增請假申請</h1>
    </div>

    ${success ? `<div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
      <i class="fas fa-check-circle"></i>請假申請已送出，等待管理員審核。
    </div>` : ''}

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <form id="leaveForm" class="space-y-4">
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
          <select name="session_id"
            class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
            <option value="">-- 自訂日期（不選擇例會）--</option>
            ${upcomingSessions.results.map((s: any) => `
            <option value="${s.id}" ${s.id === preSessionId ? 'selected' : ''}>${s.date} - ${s.title}</option>`).join('')}
          </select>
        </div>

        <div id="dateField">
          <label class="block text-sm font-medium text-gray-700 mb-1">請假日期 <span class="text-red-500">*</span></label>
          <input type="date" name="date" required
            class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">請假原因</label>
          <textarea name="reason" rows="3"
            class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
            placeholder="請說明請假原因（可填寫詳細說明讓管理員審核）"></textarea>
        </div>

        <div id="formMsg"></div>
        <button type="submit"
          class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
          <i class="fas fa-paper-plane"></i>送出請假申請
        </button>
      </form>
    </div>
  </div>

  <script>
    const form = document.getElementById('leaveForm')
    const sessionSelect = form.session_id
    const dateField = document.getElementById('dateField')
    const dateInput = form.date

    // 當選擇例會時自動填入日期
    sessionSelect.addEventListener('change', () => {
      const opt = sessionSelect.selectedOptions[0]
      if (opt.value) {
        const dateText = opt.text.split(' - ')[0]
        dateInput.value = dateText
      }
    })

    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const msg = document.getElementById('formMsg')
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
          msg.innerHTML = '<p class="text-green-600 text-sm flex items-center gap-1"><i class="fas fa-check-circle"></i>申請已送出！正在跳轉...</p>'
          setTimeout(() => window.location.href = '/member/leave', 1500)
        } else {
          msg.innerHTML = '<p class="text-red-500 text-sm">送出失敗：' + (r.error || '未知錯誤') + '</p>'
        }
      } catch(e) {
        msg.innerHTML = '<p class="text-red-500 text-sm">網路錯誤，請稍後再試</p>'
      }
    })
  </script>
</body></html>`)
})

// ===================== 晉升申請頁面 =====================
memberRoutes.get('/advancement', memberAuthMiddleware, async (c) => {
  const db = c.env.DB
  const sess = c.get('memberSession') as any
  const memberId = sess.memberId
  const member = await db.prepare(`SELECT * FROM members WHERE id = ?`).bind(memberId).first() as any

  const applications = await db.prepare(`
    SELECT * FROM advancement_applications WHERE member_id = ? ORDER BY created_at DESC
  `).bind(memberId).all()

  const requirements = await db.prepare(`
    SELECT * FROM advancement_requirements
    WHERE section = ? AND is_active = 1
    ORDER BY rank_from, display_order
  `).bind(member.section).all()

  const myProgress = await db.prepare(`
    SELECT ap.*, ar.title as req_title, ar.required_count, ar.unit
    FROM advancement_progress ap
    JOIN advancement_requirements ar ON ar.id = ap.requirement_id
    WHERE ap.member_id = ?
  `).bind(memberId).all()

  const progressMap: Record<string, any> = {}
  myProgress.results.forEach((p: any) => { progressMap[p.requirement_id] = p })

  const attendCount = await db.prepare(`
    SELECT COUNT(*) as cnt FROM attendance_records WHERE member_id = ? AND status = 'present'
  `).bind(memberId).first() as any

  // 取得不重複的 rank 組合
  const rankPaths: { from: string, to: string }[] = []
  const seen = new Set<string>()
  requirements.results.forEach((r: any) => {
    const k = `${r.rank_from}→${r.rank_to}`
    if (!seen.has(k)) { seen.add(k); rankPaths.push({ from: r.rank_from, to: r.rank_to }) }
  })

  // 取得所有專科章 (用於儀表板)
  const allBadges = await db.prepare(`SELECT * FROM specialty_badges WHERE is_active=1`).all()
  const badgeMap: Record<string, number> = {} // name -> id
  allBadges.results.forEach((b:any) => badgeMap[b.name] = b.id)

  // 取得我擁有的專科章
  const myBadges = await db.prepare(`
    SELECT msb.badge_id, sb.name, msb.obtained_date 
    FROM member_specialty_badges msb
    JOIN specialty_badges sb ON sb.id = msb.badge_id
    WHERE msb.member_id = ?
  `).bind(memberId).all()
  const myBadgeSet = new Set(myBadges.results.map((b:any) => b.name)) // 用名稱比對比較直觀
  const myBadgeCount = myBadges.results.length

  // 定義重要階段的必備專科章（完整版，含枚數要求）
  // 童軍體系：獅級(5枚)、長城(11枚)、國花(18枚)
  const rankBadgeRequirements: Array<{
    rank: string, totalRequired: number, color: string, bgColor: string, textColor: string, borderColor: string,
    requiredBadges: Array<{ name: string, isOptional?: boolean, choices?: string[] }>,
    electiveBadges?: number, // 選修章數量
    description: string
  }> = [
    {
      rank: '獅級童軍', totalRequired: 5, color: 'amber',
      bgColor: 'bg-amber-50', textColor: 'text-amber-800', borderColor: 'border-amber-300',
      requiredBadges: [
        { name: '露營' },
        { name: '旅行' },
        { name: '社區公民' }
      ],
      electiveBadges: 2,
      description: '含 3 枚必備章 + 自選 2 枚任意技能章'
    },
    {
      rank: '長城童軍', totalRequired: 11, color: 'red',
      bgColor: 'bg-red-50', textColor: 'text-red-800', borderColor: 'border-red-300',
      requiredBadges: [
        { name: '國家公民' },
        { name: '急救' },
        { name: '運動技能', isOptional: true, choices: ['游泳', '自行車', '越野'] }
      ],
      electiveBadges: 8,
      description: '含 3 枚必備章（運動擇一）+ 自選 8 枚'
    },
    {
      rank: '國花童軍', totalRequired: 18, color: 'purple',
      bgColor: 'bg-purple-50', textColor: 'text-purple-800', borderColor: 'border-purple-300',
      requiredBadges: [
        { name: '世界公民' },
        { name: '生態保育' },
        { name: '測量' },
        { name: '生物類', isOptional: true, choices: ['植物', '昆蟲', '賞鳥'] },
        { name: '藝術類', isOptional: true, choices: ['音樂', '舞蹈', '攝影'] }
      ],
      electiveBadges: 13,
      description: '含 5 枚必備章（生物、藝術各擇一）+ 自選 13 枚'
    }
  ]

  // 計算每個階段的必備章達成情況
  function checkBadgeReq(req: { name: string, isOptional?: boolean, choices?: string[] }, has: Set<string>): boolean {
    if (req.isOptional && req.choices) {
      return req.choices.some(c => has.has(c))
    }
    return has.has(req.name)
  }

  const statusLabel: Record<string, string> = {
    pending: '⏳ 待審核', reviewing: '🔍 審核中', approved: '✅ 已通過', rejected: '❌ 未通過'
  }

  return c.html(`${memberHead('晉升申請')}
<body class="bg-gray-50 min-h-screen">
  ${memberNav(member.chinese_name, member.section)}
  <div class="max-w-3xl mx-auto px-4 py-6 fade-in">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-800">晉升申請</h1>
      <p class="text-gray-500 text-sm">目前階級：<strong class="text-green-700">${member.rank_level || '未設定'}</strong></p>
    </div>

    <!-- 專科章與晉級檢核儀表板 -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <div class="flex items-center justify-between mb-5">
        <h2 class="font-semibold text-gray-800 flex items-center gap-2">
          <i class="fas fa-medal text-amber-500"></i>
          專科章晉級檢核
        </h2>
        <div class="text-right">
          <div class="text-2xl font-bold text-amber-600">${myBadgeCount}</div>
          <div class="text-xs text-gray-400">目前已取得章數</div>
        </div>
      </div>

      <!-- 整體進度列 -->
      <div class="mb-6 p-3 bg-gray-50 rounded-xl">
        <div class="flex items-center gap-4">
          ${rankBadgeRequirements.map(req => {
            const allReqDone = req.requiredBadges.every(b => checkBadgeReq(b, myBadgeSet))
            const hasEnough = myBadgeCount >= req.totalRequired
            const isFullyDone = allReqDone && hasEnough
            return `
            <div class="flex-1 text-center">
              <div class="w-10 h-10 rounded-full mx-auto mb-1 flex items-center justify-center text-sm font-bold ${isFullyDone ? 'bg-green-500 text-white' : allReqDone ? 'bg-' + req.color + '-100 text-' + req.color + '-700' : 'bg-gray-200 text-gray-400'}">
                ${isFullyDone ? '✓' : myBadgeCount + '/' + req.totalRequired}
              </div>
              <div class="text-xs font-medium ${isFullyDone ? 'text-green-700' : 'text-gray-500'}">${req.rank.replace('童軍', '')}</div>
            </div>`
          }).join('<div class="text-gray-300 text-lg">→</div>')}
        </div>
      </div>

      <!-- 三個階段的必備章清單 -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        ${rankBadgeRequirements.map(req => {
          const allReqDone = req.requiredBadges.every(b => checkBadgeReq(b, myBadgeSet))
          const hasEnough = myBadgeCount >= req.totalRequired
          const isFullyDone = allReqDone && hasEnough
          const doneReqCount = req.requiredBadges.filter(b => checkBadgeReq(b, myBadgeSet)).length

          return `
          <div class="rounded-xl border-2 ${isFullyDone ? 'border-green-400 bg-green-50' : allReqDone ? 'border-' + req.color + '-300 ' + req.bgColor : 'border-gray-200 bg-gray-50'} p-4">
            <!-- 標題 -->
            <div class="flex items-center justify-between mb-3">
              <div>
                <h3 class="font-bold ${isFullyDone ? 'text-green-800' : req.textColor} text-sm">${req.rank}</h3>
                <div class="text-xs ${isFullyDone ? 'text-green-600' : 'text-gray-400'} mt-0.5">需 ${req.totalRequired} 枚（含必備）</div>
              </div>
              ${isFullyDone 
                ? '<div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center"><i class="fas fa-check text-white text-xs"></i></div>'
                : `<div class="text-right"><div class="text-lg font-bold ${req.textColor}">${doneReqCount}/${req.requiredBadges.length}</div><div class="text-xs text-gray-400">必備</div></div>`
              }
            </div>

            <!-- 必備章清單 -->
            <div class="space-y-2 mb-3">
              ${req.requiredBadges.map(badge => {
                const obtained = checkBadgeReq(badge, myBadgeSet)
                // 取得實際獲得的章名（擇一）
                let obtainedName = ''
                if (badge.isOptional && badge.choices) {
                  obtainedName = badge.choices.find(c => myBadgeSet.has(c)) || ''
                }
                return `
                <div class="flex items-center gap-2.5 ${obtained ? '' : 'opacity-60'}">
                  <div class="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${obtained ? 'bg-green-500' : 'bg-white border-2 border-gray-300'}">
                    ${obtained ? '<i class="fas fa-check text-white text-[9px]"></i>' : ''}
                  </div>
                  <div class="flex-1 min-w-0">
                    <span class="text-sm ${obtained ? 'text-gray-800 font-medium' : 'text-gray-500'}">
                      ${badge.isOptional ? (obtainedName || badge.choices!.join('/')) : badge.name}
                    </span>
                    ${badge.isOptional ? '<span class="text-xs text-gray-400 ml-1">（擇一）</span>' : ''}
                  </div>
                </div>`
              }).join('')}
            </div>

            <!-- 選修章進度 -->
            ${req.electiveBadges ? `
            <div class="pt-2 border-t border-gray-200">
              <div class="flex items-center justify-between text-xs">
                <span class="text-gray-500">自選章 / 總枚數達標</span>
                <span class="${hasEnough ? 'text-green-700 font-bold' : 'text-gray-400'}">${myBadgeCount}/${req.totalRequired} 枚</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-1.5 mt-1.5">
                <div class="h-1.5 rounded-full transition-all ${hasEnough ? 'bg-green-500' : 'bg-' + req.color + '-400'}" 
                  style="width:${Math.min(100, Math.round(myBadgeCount / req.totalRequired * 100))}%"></div>
              </div>
            </div>` : ''}

            <!-- 說明 -->
            <p class="text-xs text-gray-400 mt-2">${req.description}</p>
          </div>`
        }).join('')}
      </div>

      <!-- 提示 -->
      <div class="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-700 flex items-start gap-2">
        <i class="fas fa-info-circle mt-0.5 flex-shrink-0"></i>
        <div>
          <strong>專科章取得</strong>：專科章由服務員/家長在後台為您記錄。如有疑問，請聯繫您的服務員。
          數字會即時反映您目前已登錄的專科章數量。
        </div>
      </div>
    </div>

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
              ${rankPaths.map(r => `<option value="${r.to}" data-from="${r.from}">${r.from} → ${r.to}</option>`).join('')}
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
    <h2 class="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <i class="fas fa-history text-gray-500"></i>申請記錄
    </h2>
    <div class="bg-white rounded-xl shadow-sm border border-gray-100">
      ${applications.results.length === 0 ? `<div class="p-8 text-center text-gray-400">
        <i class="fas fa-clipboard-list text-4xl mb-3"></i>
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
              ${statusLabel[a.status] || a.status}
            </span>
          </div>
        </div>`).join('')}
      </div>`}
    </div>
  </div>

  <script>
    document.getElementById('advForm').addEventListener('submit', async (e) => {
      e.preventDefault()
      const msg = document.getElementById('advFormMsg')
      const form = e.target
      const fd = new FormData(form)
      const selectedOpt = form.rank_to.selectedOptions[0]
      const data = {
        rank_to: fd.get('rank_to'),
        rank_from: selectedOpt?.dataset?.from || '',
        apply_date: fd.get('apply_date')
      }
      if (!data.rank_to || !data.rank_from) {
        msg.innerHTML = '<p class="text-red-500 text-sm">請選擇目標階級</p>'; return
      }
      msg.innerHTML = '<p class="text-gray-400 text-sm">送出中...</p>'
      try {
        const res = await fetch('/api/member/advancement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
        const r = await res.json()
        if (r.success) {
          msg.innerHTML = '<p class="text-green-600 text-sm">✅ 晉升申請已送出！</p>'
          setTimeout(() => location.reload(), 1500)
        } else {
          msg.innerHTML = '<p class="text-red-500 text-sm">送出失敗：' + (r.error || '未知錯誤') + '</p>'
        }
      } catch(e) {
        msg.innerHTML = '<p class="text-red-500 text-sm">網路錯誤，請稍後再試</p>'
      }
    })
  </script>
</body></html>`)
})

// =====================================================================
// 公假行事曆系統
// =====================================================================

function weekdayLabel(dow: number): string {
  return ['日','一','二','三','四','五','六'][dow] || ''
}

// ===== 公假行事曆首頁 =====
memberRoutes.get('/official-leave', memberAuthMiddleware, async (c) => {
  const db = c.env.DB
  const sess = c.get('memberSession') as any

  const settingRows = await db.prepare(
    `SELECT key, value FROM site_settings WHERE key LIKE 'official_leave%'`
  ).all()
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

  const weekEvents = await db.prepare(
    `SELECT * FROM leave_calendar_events WHERE date >= ? AND date <= ? ORDER BY date`
  ).bind(wStart, wEnd).all()

  const approvedLeaves = await db.prepare(`
    SELECT ola.leave_date, ola.timeslots, m.chinese_name, m.section
    FROM official_leave_applications ola
    JOIN members m ON m.id = ola.member_id
    WHERE ola.status='approved' AND ola.leave_date>=? AND ola.leave_date<=?
    ORDER BY ola.leave_date
  `).bind(wStart, wEnd).all()

  const semEvents = semStart ? await db.prepare(
    `SELECT * FROM leave_calendar_events WHERE date>=? AND date<=? ORDER BY date`
  ).bind(semStart, semEnd).all() : { results: [] }

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

    const ruleHtml = dayRules.map((r:any)=>
      `<div class="p-1.5 rounded text-xs font-medium bg-indigo-50 border-l-4 border-indigo-400 text-indigo-800">🔄 ${r.title}${r.description?`<div class="text-xs opacity-70 font-normal">${r.description}</div>`:''}</div>`
    ).join('')

    const leaveHtml = dayLeaves.length>0 ? `<div class="mt-1"><div class="text-xs font-bold text-gray-500 border-b pb-0.5 mb-1">公假名單 (${dayLeaves.length})</div>${dayLeaves.map((l:any)=>{const ts=(() => { try{return JSON.parse(l.timeslots)}catch{return[]} })();return `<div class="bg-green-50 text-green-800 text-xs p-1 rounded border border-green-100"><span class="font-bold">${l.chinese_name}</span><div class="text-gray-400 text-[10px]">${ts.join(', ')}</div></div>`}).join('')}</div>` : ''

    const isEmpty = dayEv.length===0&&dayRules.length===0&&dayLeaves.length===0

    return `<div class="${isToday?'ring-2 ring-blue-500':''} ${isWeekend?'bg-gray-50':'bg-white'} rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-[200px]">
      <div class="${isToday?'bg-blue-500 text-white':'bg-gray-100 text-gray-700'} px-3 py-2 rounded-t-xl text-center border-b">
        <div class="font-bold text-sm">星期${weekdayLabel(d.getDay())}</div>
        <div class="text-xs">${dStr.substring(5).replace('-','/')}</div>
        ${isBlocked?`<div class="text-xs text-red-500 mt-0.5">🔒 封鎖</div>`:''}
      </div>
      <div class="p-2 flex-1 space-y-1 text-sm">
        ${evHtml}${ruleHtml}${leaveHtml}
        ${isEmpty?'<p class="text-gray-300 text-xs text-center mt-6">無事項</p>':''}
      </div>
    </div>`
  }).join('')

  // 學期視圖
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

  return c.html(`${memberHead('公假行事曆')}
<body class="bg-gray-50 min-h-screen">
  ${memberNav(sess.memberName, sess.section)}
  <div class="max-w-7xl mx-auto px-4 py-6 fade-in">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-calendar-alt text-blue-600"></i>單週公假行事曆</h1>
        <p class="text-gray-500 text-sm mt-0.5">顯示本週已核准之公假與當週活動</p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <a href="/member/official-leave/apply" class="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 shadow-sm"><i class="fas fa-edit"></i>申請公假</a>
        <a href="/member/official-leave/my" class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2"><i class="fas fa-list"></i>我的申請</a>
      </div>
    </div>
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-3 mb-4 flex items-center gap-4 flex-wrap">
      <a href="/member/official-leave?week=${fmtDate(prevWeek)}" class="flex items-center gap-1 text-gray-600 hover:text-blue-600 font-medium text-sm"><i class="fas fa-chevron-left"></i>上一週</a>
      <h2 class="text-base font-bold text-gray-800 flex-1 text-center">${wStart.substring(0,4)}/${wStart.substring(5,7)}/${wStart.substring(8,10)} - ${wEnd.substring(5,7)}/${wEnd.substring(8,10)}</h2>
      <a href="/member/official-leave?week=${fmtDate(nextWeek)}" class="flex items-center gap-1 text-gray-600 hover:text-blue-600 font-medium text-sm">下一週<i class="fas fa-chevron-right"></i></a>
      ${wStart!==curMonStr?`<a href="/member/official-leave?week=${curMonStr}" class="text-blue-600 hover:underline text-sm">回到今天</a>`:''}
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-8">${dayColumns}</div>
    ${semStart?`
    <div class="bg-white rounded-2xl shadow-sm border-t-4 border-indigo-600 p-5 mb-6">
      <h2 class="text-xl font-bold text-indigo-900 flex items-center gap-2 mb-4"><i class="fas fa-school text-indigo-600"></i>童軍團學期行事曆 <span class="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">${semStart} ～ ${semEnd}</span></h2>
      ${recurringRules.length>0?`<div class="mb-4 bg-indigo-50 p-3 rounded-lg border border-indigo-100"><h3 class="font-bold text-indigo-800 text-xs uppercase tracking-wide mb-2">每週例行活動</h3><div class="flex flex-wrap gap-3">${recurringRules.map((r:any)=>`<div class="flex items-center gap-1.5 text-sm"><span class="bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded font-bold text-xs">週${weekdayLabel(r.dayOfWeek)}</span><span class="font-medium text-gray-800">${r.title}</span>${r.description?`<span class="text-gray-500 text-xs">(${r.description})</span>`:''}</div>`).join('')}</div></div>`:''}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${semMonthsHtml}</div>
    </div>`:''}
  </div>
</body></html>`)
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
  ${memberNav(sess.memberName, sess.section)}
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
  ${memberNav(sess.memberName, sess.section)}
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
