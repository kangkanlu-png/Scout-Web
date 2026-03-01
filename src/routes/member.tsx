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

  // 取得出席統計
  const attendStats = await db.prepare(`
    SELECT
      COUNT(DISTINCT ar.session_id) as present_count,
      (SELECT COUNT(*) FROM attendance_sessions WHERE section = ? OR section = 'all') as total_count
    FROM attendance_records ar
    WHERE ar.member_id = ? AND ar.status = 'present'
  `).bind(member.section, memberId).first() as any

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
  ${memberNav(member.chinese_name, member.section)}
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
            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${sectionBadge[member.section] || 'bg-gray-100 text-gray-700'}">${member.section}</span>
          </div>
          <div class="flex flex-wrap gap-3 text-sm text-gray-500">
            <span><i class="fas fa-medal mr-1 text-yellow-500"></i>${member.rank_level || '未設定階級'}</span>
            <span><i class="fas fa-user-tag mr-1 text-blue-500"></i>${member.role_name || '隊員'}</span>
            <span><i class="fas fa-users mr-1 text-green-500"></i>${member.troop || '54團'}</span>
            ${member.unit_name ? `<span><i class="fas fa-sitemap mr-1 text-purple-500"></i>${member.unit_name}</span>` : ''}
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

  // 取得晉升條件（依據目前階級）
  const requirements = await db.prepare(`
    SELECT * FROM advancement_requirements
    WHERE section = ? AND is_active = 1
    ORDER BY rank_from, display_order
  `).bind(member.section).all()

  // 取得個人晉升進度
  const advProgress = await db.prepare(`
    SELECT ap.*, ar.title as req_title, ar.required_count, ar.unit, ar.requirement_type
    FROM advancement_progress ap
    JOIN advancement_requirements ar ON ar.id = ap.requirement_id
    WHERE ap.member_id = ?
  `).bind(memberId).all()

  // 建立進度 Map
  const progressMap: Record<string, any> = {}
  advProgress.results.forEach((p: any) => {
    progressMap[p.requirement_id] = p
  })

  // 計算出席數量（給進度條用）
  const attendCount = await db.prepare(`
    SELECT COUNT(*) as cnt FROM attendance_records WHERE member_id = ? AND status = 'present'
  `).bind(memberId).first() as any

  // 依照 rank_from 分組
  const reqByRank: Record<string, any[]> = {}
  requirements.results.forEach((req: any) => {
    const key = `${req.rank_from} → ${req.rank_to}`
    if (!reqByRank[key]) reqByRank[key] = []
    reqByRank[key].push(req)
  })

  const reqTypeIcon: Record<string, string> = {
    attendance: 'fas fa-calendar-check text-green-500',
    service: 'fas fa-hands-helping text-blue-500',
    badge: 'fas fa-certificate text-yellow-500',
    test: 'fas fa-clipboard-check text-purple-500',
    camp: 'fas fa-campground text-orange-500',
    other: 'fas fa-star text-gray-500'
  }

  const rankSections = Object.entries(reqByRank).map(([rankTitle, reqs]) => {
    const completedCount = reqs.filter(req => {
      const prog = progressMap[req.id]
      // 自動從實際記錄推算
      if (req.requirement_type === 'attendance') {
        return (attendCount?.cnt || 0) >= req.required_count
      }
      return prog && (prog.achieved_count >= req.required_count || prog.status === 'approved')
    }).length
    const totalMandatory = reqs.filter(r => r.is_mandatory).length
    const completedMandatory = reqs.filter(req => {
      if (!req.is_mandatory) return false
      const prog = progressMap[req.id]
      if (req.requirement_type === 'attendance') {
        return (attendCount?.cnt || 0) >= req.required_count
      }
      return prog && (prog.achieved_count >= req.required_count || prog.status === 'approved')
    }).length
    const pct = totalMandatory > 0 ? Math.round((completedMandatory / totalMandatory) * 100) : 0

    return `
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 mb-4">
      <div class="p-4 border-b border-gray-100">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-semibold text-gray-800 flex items-center gap-2">
            <i class="fas fa-level-up-alt text-green-600"></i>${rankTitle}
          </h3>
          <span class="text-sm font-medium ${pct >= 100 ? 'text-green-600' : 'text-orange-500'}">${pct}% 完成</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div class="progress-bar bg-gradient-to-r from-green-500 to-emerald-400 h-2 rounded-full" style="width:${pct}%"></div>
        </div>
        <p class="text-xs text-gray-400 mt-1">必填條件 ${completedMandatory}/${totalMandatory} 已完成</p>
      </div>
      <div class="p-4 space-y-2">
        ${reqs.map(req => {
          const prog = progressMap[req.id]
          let achieved = prog?.achieved_count || 0
          if (req.requirement_type === 'attendance') achieved = attendCount?.cnt || 0
          const isCompleted = achieved >= req.required_count || prog?.status === 'approved'
          const pctReq = Math.min(100, Math.round((achieved / req.required_count) * 100))
          return `
          <div class="flex items-start gap-3 p-2 rounded-lg ${isCompleted ? 'bg-green-50' : 'bg-gray-50'}">
            <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}">
              <i class="fas ${isCompleted ? 'fa-check' : 'fa-clock'} text-white text-xs"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <i class="${reqTypeIcon[req.requirement_type] || reqTypeIcon.other} text-xs"></i>
                <span class="text-sm font-medium text-gray-800">${req.title}</span>
                ${!req.is_mandatory ? `<span class="text-xs text-gray-400 bg-gray-100 px-1 rounded">選填</span>` : ''}
              </div>
              ${req.description ? `<p class="text-xs text-gray-400 mb-1">${req.description}</p>` : ''}
              <div class="flex items-center gap-2">
                <div class="flex-1 bg-gray-200 rounded-full h-1.5">
                  <div class="bg-green-500 h-1.5 rounded-full" style="width:${pctReq}%"></div>
                </div>
                <span class="text-xs font-medium ${isCompleted ? 'text-green-600' : 'text-gray-500'}">
                  ${achieved}/${req.required_count} ${req.unit}
                </span>
              </div>
              ${prog?.evidence_note ? `<p class="text-xs text-blue-500 mt-1"><i class="fas fa-paperclip mr-1"></i>${prog.evidence_note}</p>` : ''}
            </div>
            ${prog?.status === 'approved' ? `<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex-shrink-0">✓ 審核通過</span>` :
              prog?.status === 'submitted' ? `<span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex-shrink-0">⏳ 待審核</span>` : ''}
          </div>`
        }).join('')}
      </div>
    </div>`
  }).join('')

  // 進度紀錄（全部）
  const rankTypeLabel: Record<string, string> = { rank: '🏅 階級', badge: '📛 技能章', achievement: '🏆 成就', award: '⭐ 獎項' }

  return c.html(`${memberHead('晉升進度')}
<body class="bg-gray-50 min-h-screen">
  ${memberNav(member.chinese_name, member.section)}
  <div class="max-w-4xl mx-auto px-4 py-6 fade-in">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">晉升進度追蹤</h1>
        <p class="text-gray-500 text-sm">目前階級：<strong class="text-green-700">${member.rank_level || '未設定'}</strong></p>
      </div>
      <a href="/member/advancement" class="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
        <i class="fas fa-arrow-up"></i>申請晉升
      </a>
    </div>

    <!-- 晉升條件追蹤 -->
    <h2 class="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
      <i class="fas fa-tasks text-green-600"></i>晉升條件完成情況
    </h2>
    ${rankSections || `<div class="bg-white rounded-xl p-8 text-center text-gray-400">
      <i class="fas fa-clipboard-list text-4xl mb-3"></i>
      <p>目前階段尚無晉升條件設定</p>
      <p class="text-sm mt-1">請聯繫管理員新增晉升條件</p>
    </div>`}

    <!-- 已獲得紀錄 -->
    <h2 class="text-lg font-semibold text-gray-700 mb-3 mt-6 flex items-center gap-2">
      <i class="fas fa-history text-yellow-500"></i>已取得紀錄
    </h2>
    <div class="bg-white rounded-xl shadow-sm border border-gray-100">
      ${progressRecords.results.length === 0 ? `<div class="p-8 text-center text-gray-400"><i class="fas fa-medal text-4xl mb-3"></i><p>尚無進度記錄</p></div>` :
        `<div class="divide-y divide-gray-50">
          ${progressRecords.results.map((p: any) => `
          <div class="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
            <div class="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
              <i class="fas fa-award text-yellow-600"></i>
            </div>
            <div class="flex-1">
              <div class="font-medium text-gray-800">${p.award_name}</div>
              <div class="text-xs text-gray-400">${rankTypeLabel[p.record_type] || p.record_type} · ${p.year_label || ''} · ${p.awarded_at?.substring(0,10) || ''}</div>
              ${p.notes ? `<div class="text-xs text-gray-500 mt-0.5">${p.notes}</div>` : ''}
            </div>
          </div>`).join('')}
        </div>`}
    </div>
  </div>
</body></html>`)
})

// ===================== 出席記錄頁面 =====================
memberRoutes.get('/attendance', memberAuthMiddleware, async (c) => {
  const db = c.env.DB
  const sess = c.get('memberSession') as any
  const memberId = sess.memberId
  const member = await db.prepare(`SELECT * FROM members WHERE id = ?`).bind(memberId).first() as any

  const sessions = await db.prepare(`
    SELECT as2.*, ar.status as my_status, ar.note as my_note,
      lr.id as leave_id, lr.status as leave_status, lr.leave_type
    FROM attendance_sessions as2
    LEFT JOIN attendance_records ar ON ar.session_id = as2.id AND ar.member_id = ?
    LEFT JOIN leave_requests lr ON lr.session_id = as2.id AND lr.member_id = ?
    WHERE as2.section = ? OR as2.section = 'all'
    ORDER BY as2.date DESC LIMIT 50
  `).bind(memberId, memberId, member.section).all()

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
  `).bind(memberId, memberId, member.section).first() as any

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
