import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

type Bindings = {
  DB: D1Database
}

export const adminRoutes = new Hono<{ Bindings: Bindings }>()

// ===================== 驗證中間件 =====================
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function authMiddleware(c: any, next: any) {
  const session = getCookie(c, 'admin_session')
  if (!session || session !== 'authenticated') {
    return c.redirect('/admin/login')
  }
  await next()
}

// ===================== 登入頁面 =====================
adminRoutes.get('/login', (c) => {
  const error = c.req.query('error')
  return c.html(`<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>後台登入 - 童軍團管理系統</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-green-900 to-green-700 min-h-screen flex items-center justify-center">
  <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
    <div class="text-center mb-6">
      <div class="text-5xl mb-3">⚜️</div>
      <h1 class="text-2xl font-bold text-gray-800">後台管理登入</h1>
      <p class="text-gray-500 text-sm mt-1">林口康橋童軍團管理系統</p>
    </div>
    ${error ? `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">帳號或密碼錯誤，請重試。</div>` : ''}
    <form method="POST" action="/admin/login" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">帳號</label>
        <input type="text" name="username" required
          class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="請輸入帳號">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">密碼</label>
        <input type="password" name="password" required
          class="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="請輸入密碼">
      </div>
      <button type="submit"
        class="w-full bg-green-700 hover:bg-green-600 text-white font-medium py-2.5 rounded-lg transition-colors">
        登入
      </button>
    </form>
    <p class="text-center text-xs text-gray-400 mt-4">預設帳號: admin / 密碼: admin123</p>
  </div>
</body>
</html>`)
})

adminRoutes.post('/login', async (c) => {
  const db = c.env.DB
  const body = await c.req.parseBody()
  const username = body['username'] as string
  const password = body['password'] as string

  const passwordHash = await sha256(password)
  const admin = await db.prepare(
    `SELECT * FROM admins WHERE username = ? AND password_hash = ?`
  ).bind(username, passwordHash).first()

  if (!admin) {
    return c.redirect('/admin/login?error=1')
  }

  setCookie(c, 'admin_session', 'authenticated', {
    httpOnly: true,
    secure: false,
    maxAge: 86400 * 7,
    path: '/',
  })
  return c.redirect('/admin')
})

adminRoutes.get('/logout', (c) => {
  deleteCookie(c, 'admin_session', { path: '/' })
  return c.redirect('/admin/login')
})

// ===================== 後台首頁儀表板 =====================
adminRoutes.get('/', authMiddleware, async (c) => {
  const db = c.env.DB
  const activitiesCount = await db.prepare(`SELECT COUNT(*) as cnt FROM activities`).first() as any
  const groupsCount = await db.prepare(`SELECT COUNT(*) as cnt FROM scout_groups`).first() as any
  const announcementsCount = await db.prepare(`SELECT COUNT(*) as cnt FROM announcements`).first() as any
  const imagesCount = await db.prepare(`SELECT COUNT(*) as cnt FROM activity_images`).first() as any
  const membersCount = await db.prepare(`SELECT COUNT(*) as cnt FROM members WHERE membership_status='ACTIVE'`).first() as any
  const coachesCount = await db.prepare(`SELECT COUNT(*) as cnt FROM coach_members`).first() as any
  const sessionsCount = await db.prepare(`SELECT COUNT(*) as cnt FROM attendance_sessions`).first() as any
  const progressCount = await db.prepare(`SELECT COUNT(*) as cnt FROM progress_records`).first() as any
  
  // 各組別人數
  const sectionCounts = await db.prepare(`SELECT section, COUNT(*) as cnt FROM members WHERE membership_status='ACTIVE' GROUP BY section`).all()
  const sectionRows = sectionCounts.results.map((s: any) => `
    <div class="flex items-center justify-between py-1.5 border-b last:border-0">
      <span class="text-sm text-gray-600">${s.section}</span>
      <span class="font-semibold text-gray-800">${s.cnt}</span>
    </div>
  `).join('')

  return c.html(adminLayout('儀表板', `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
        <div class="text-3xl font-bold text-green-700">${activitiesCount?.cnt || 0}</div>
        <div class="text-sm text-green-600 mt-1">活動記錄</div>
      </div>
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
        <div class="text-3xl font-bold text-blue-700">${membersCount?.cnt || 0}</div>
        <div class="text-sm text-blue-600 mt-1">在籍成員</div>
      </div>
      <div class="bg-purple-50 border border-purple-200 rounded-xl p-5 text-center">
        <div class="text-3xl font-bold text-purple-700">${coachesCount?.cnt || 0}</div>
        <div class="text-sm text-purple-600 mt-1">教練人數</div>
      </div>
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
        <div class="text-3xl font-bold text-amber-700">${progressCount?.cnt || 0}</div>
        <div class="text-sm text-amber-600 mt-1">進程記錄</div>
      </div>
    </div>
    
    <div class="grid md:grid-cols-2 gap-6 mb-6">
      <div class="bg-white rounded-xl shadow p-5">
        <h3 class="font-bold text-gray-700 mb-3">👥 組別人數統計</h3>
        ${sectionRows || '<p class="text-sm text-gray-400">尚無成員資料</p>'}
        <a href="/admin/members" class="mt-3 block text-sm text-green-600 hover:text-green-800">→ 查看所有成員</a>
      </div>
      <div class="bg-white rounded-xl shadow p-5">
        <h3 class="font-bold text-gray-700 mb-3">📊 系統概覽</h3>
        <div class="space-y-2">
          <div class="flex justify-between text-sm"><span class="text-gray-500">出席場次</span><span class="font-medium">${sessionsCount?.cnt || 0} 場</span></div>
          <div class="flex justify-between text-sm"><span class="text-gray-500">童軍分組</span><span class="font-medium">${groupsCount?.cnt || 0} 組</span></div>
          <div class="flex justify-between text-sm"><span class="text-gray-500">活動圖片</span><span class="font-medium">${imagesCount?.cnt || 0} 張</span></div>
          <div class="flex justify-between text-sm"><span class="text-gray-500">公告訊息</span><span class="font-medium">${announcementsCount?.cnt || 0} 則</span></div>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow p-6">
      <h3 class="font-bold text-gray-700 mb-4">快速操作</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <a href="/admin/members" class="flex flex-col items-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors">
          <span class="text-2xl">🪖</span>
          <span class="text-sm text-blue-700 font-medium">成員管理</span>
        </a>
        <a href="/admin/attendance" class="flex flex-col items-center gap-2 p-4 bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors">
          <span class="text-2xl">📅</span>
          <span class="text-sm text-teal-700 font-medium">出席管理</span>
        </a>
        <a href="/admin/progress" class="flex flex-col items-center gap-2 p-4 bg-yellow-50 hover:bg-yellow-100 rounded-xl transition-colors">
          <span class="text-2xl">🏅</span>
          <span class="text-sm text-yellow-700 font-medium">進程榮譽</span>
        </a>
        <a href="/admin/coaches" class="flex flex-col items-center gap-2 p-4 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors">
          <span class="text-2xl">🧢</span>
          <span class="text-sm text-emerald-700 font-medium">教練團</span>
        </a>
        <a href="/admin/activities/new" class="flex flex-col items-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors">
          <span class="text-2xl">➕</span>
          <span class="text-sm text-green-700 font-medium">新增活動</span>
        </a>
        <a href="/admin/groups" class="flex flex-col items-center gap-2 p-4 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors">
          <span class="text-2xl">👥</span>
          <span class="text-sm text-purple-700 font-medium">管理分組</span>
        </a>
        <a href="/admin/announcements" class="flex flex-col items-center gap-2 p-4 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors">
          <span class="text-2xl">📢</span>
          <span class="text-sm text-amber-700 font-medium">管理公告</span>
        </a>
        <a href="/admin/leaves" class="flex flex-col items-center gap-2 p-4 bg-red-50 hover:bg-red-100 rounded-xl transition-colors">
          <span class="text-2xl">📝</span>
          <span class="text-sm text-red-700 font-medium">公假管理</span>
        </a>
      </div>
    </div>
  `))
})

// ===================== 活動管理 =====================
adminRoutes.get('/activities', authMiddleware, async (c) => {
  const db = c.env.DB
  const activities = await db.prepare(`
    SELECT a.*, COUNT(ai.id) as image_count
    FROM activities a
    LEFT JOIN activity_images ai ON ai.activity_id = a.id
    GROUP BY a.id
    ORDER BY a.display_order ASC, a.activity_date DESC
  `).all()

  const categoryLabel: Record<string, string> = {
    general: '一般活動', tecc: 'TECC 急救', camping: '大露營', training: '訓練課程', service: '服務活動'
  }
  const rows = activities.results.map((a: any) => `
    <tr class="border-b hover:bg-gray-50">
      <td class="py-3 px-4">
        <span class="inline-block px-2 py-0.5 text-xs rounded-full ${a.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
          ${a.is_published ? '已發佈' : '草稿'}
        </span>
      </td>
      <td class="py-3 px-4 font-medium">${a.title}</td>
      <td class="py-3 px-4 text-sm text-gray-500">${categoryLabel[a.category] || a.category}</td>
      <td class="py-3 px-4 text-sm text-gray-500">${a.date_display || a.activity_date || '-'}</td>
      <td class="py-3 px-4 text-sm text-gray-500">${a.image_count} 張</td>
      <td class="py-3 px-4">
        <div class="flex gap-2 items-center">
          <a href="/admin/activities/${a.id}/edit" class="text-blue-600 hover:text-blue-800 text-sm font-medium">編輯</a>
          <a href="/admin/activities/${a.id}/images" class="text-purple-600 hover:text-purple-800 text-sm font-medium">圖片</a>
          <a href="/admin/activities/${a.id}/registrations" class="text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center gap-1">
            報名${a.is_registration_open ? '<span class="w-2 h-2 rounded-full bg-green-500"></span>' : ''}
          </a>
          <button onclick="deleteActivity(${a.id})" class="text-red-500 hover:text-red-700 text-sm font-medium">刪除</button>
        </div>
      </td>
    </tr>
  `).join('')

  return c.html(adminLayout('活動管理', `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-bold text-gray-800">活動管理</h2>
      <a href="/admin/activities/new" class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">➕ 新增活動</a>
    </div>
    <div class="bg-white rounded-xl shadow overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="py-3 px-4 text-left text-gray-600">狀態</th>
            <th class="py-3 px-4 text-left text-gray-600">標題</th>
            <th class="py-3 px-4 text-left text-gray-600">類型</th>
            <th class="py-3 px-4 text-left text-gray-600">日期</th>
            <th class="py-3 px-4 text-left text-gray-600">圖片</th>
            <th class="py-3 px-4 text-left text-gray-600">操作</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="6" class="py-8 text-center text-gray-400">尚無活動記錄</td></tr>'}
        </tbody>
      </table>
    </div>
    <script>
      async function deleteActivity(id) {
        if (!confirm('確定要刪除此活動嗎？（包含所有圖片）')) return;
        const res = await fetch('/api/activities/' + id, { method: 'DELETE' });
        if (res.ok) location.reload();
        else alert('刪除失敗');
      }
    </script>
  `))
})

// 新增活動表單
adminRoutes.get('/activities/new', authMiddleware, (c) => {
  return c.html(adminLayout('新增活動', activityForm(null)))
})

// 編輯活動表單
adminRoutes.get('/activities/:id/edit', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const activity = await db.prepare(`SELECT * FROM activities WHERE id = ?`).bind(id).first()
  if (!activity) return c.redirect('/admin/activities')
  return c.html(adminLayout('編輯活動', activityForm(activity as any)))
})

// 報名管理頁面
adminRoutes.get('/activities/:id/registrations', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const activity = await db.prepare(`SELECT * FROM activities WHERE id = ?`).bind(id).first() as any
  if (!activity) return c.redirect('/admin/activities')

  // 取得報名資料
  const registrations = await db.prepare(`
    SELECT ar.*, m.chinese_name, m.english_name, m.section, m.unit_name, m.phone, m.email
    FROM activity_registrations ar
    JOIN members m ON m.id = ar.member_id
    WHERE ar.activity_id = ?
    ORDER BY ar.created_at DESC
  `).bind(id).all()

  const statusMap: Record<string, string> = {
    pending: '<span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">審核中</span>',
    approved: '<span class="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">已錄取</span>',
    rejected: '<span class="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">不錄取</span>',
    cancelled: '<span class="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">已取消</span>',
    waiting: '<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">候補中</span>'
  }

  const rows = registrations.results.map((r: any) => `
    <tr class="border-b hover:bg-gray-50 text-sm">
      <td class="py-3 px-4">${r.created_at.substring(0, 16)}</td>
      <td class="py-3 px-4 font-medium">${r.chinese_name} <span class="text-gray-400 text-xs">${r.english_name || ''}</span></td>
      <td class="py-3 px-4 text-gray-600">${r.section} / ${r.unit_name || '-'}</td>
      <td class="py-3 px-4 text-gray-600">${r.phone || '-'}</td>
      <td class="py-3 px-4">${statusMap[r.status] || r.status}</td>
      <td class="py-3 px-4 text-gray-500 text-xs max-w-[200px] truncate" title="${r.user_notes || ''}">${r.user_notes || '-'}</td>
      <td class="py-3 px-4">
        <div class="flex gap-2">
          ${r.status === 'pending' || r.status === 'waiting' ? `
            <button onclick="updateStatus(${r.id}, 'approved')" class="text-green-600 hover:text-green-800 font-medium">錄取</button>
            <button onclick="updateStatus(${r.id}, 'rejected')" class="text-red-600 hover:text-red-800 font-medium">拒絕</button>
            <button onclick="updateStatus(${r.id}, 'waiting')" class="text-blue-600 hover:text-blue-800 font-medium">候補</button>
          ` : `
            <button onclick="updateStatus(${r.id}, 'pending')" class="text-gray-500 hover:text-gray-700 text-xs">重審</button>
          `}
        </div>
      </td>
    </tr>
  `).join('')

  return c.html(adminLayout(`報名管理：${activity.title}`, `
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-xl font-bold text-gray-800">報名管理</h2>
        <p class="text-gray-500 text-sm">${activity.title}</p>
      </div>
      <div class="flex gap-2">
        <a href="/admin/activities" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">返回活動列表</a>
        <a href="/api/activities/${id}/registrations/export" target="_blank" class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hidden">匯出 Excel</a>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div class="text-sm text-gray-500">總報名人數</div>
        <div class="text-2xl font-bold text-gray-800">${registrations.results.length}</div>
      </div>
      <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div class="text-sm text-gray-500">已錄取</div>
        <div class="text-2xl font-bold text-green-600">${registrations.results.filter((r:any) => r.status === 'approved').length}</div>
      </div>
      <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div class="text-sm text-gray-500">待審核</div>
        <div class="text-2xl font-bold text-yellow-600">${registrations.results.filter((r:any) => r.status === 'pending').length}</div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="py-3 px-4 text-left text-gray-600">報名時間</th>
            <th class="py-3 px-4 text-left text-gray-600">姓名</th>
            <th class="py-3 px-4 text-left text-gray-600">組別/小隊</th>
            <th class="py-3 px-4 text-left text-gray-600">電話</th>
            <th class="py-3 px-4 text-left text-gray-600">狀態</th>
            <th class="py-3 px-4 text-left text-gray-600">備註</th>
            <th class="py-3 px-4 text-left text-gray-600">操作</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="7" class="py-8 text-center text-gray-400">尚無報名資料</td></tr>'}
        </tbody>
      </table>
    </div>

    <script>
      async function updateStatus(id, status) {
        if (!confirm('確定要將狀態更新為 ' + status + ' 嗎？')) return;
        const res = await fetch('/api/registrations/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        });
        if (res.ok) location.reload();
        else alert('更新失敗');
      }
    </script>
  `))
})

// 管理活動圖片
adminRoutes.get('/activities/:id/images', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const activity = await db.prepare(`SELECT * FROM activities WHERE id = ?`).bind(id).first() as any
  if (!activity) return c.redirect('/admin/activities')
  const images = await db.prepare(`SELECT * FROM activity_images WHERE activity_id = ? ORDER BY display_order`).bind(id).all()

  const imgCards = images.results.map((img: any) => `
    <div class="bg-white border rounded-xl overflow-hidden shadow-sm" id="img-${img.id}">
      <div class="aspect-video bg-gray-100 overflow-hidden">
        <img src="${img.image_url}" alt="${img.caption || ''}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=\\'flex items-center justify-center h-full text-gray-400 text-sm\\'>圖片無法顯示</div>'">
      </div>
      <div class="p-3">
        <p class="text-xs text-gray-500 truncate mb-1">${img.image_url}</p>
        <p class="text-xs text-gray-600">${img.caption || '（無說明）'}</p>
        <button onclick="deleteImage(${img.id})" class="mt-2 text-red-500 hover:text-red-700 text-xs font-medium">🗑 刪除</button>
      </div>
    </div>
  `).join('')

  return c.html(adminLayout(`圖片管理：${activity.title}`, `
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-xl font-bold text-gray-800">圖片管理</h2>
        <p class="text-gray-500 text-sm">${activity.title}</p>
      </div>
      <a href="/admin/activities" class="text-gray-500 hover:text-gray-700 text-sm">← 返回活動列表</a>
    </div>

    <!-- 新增圖片 -->
    <div class="bg-white rounded-xl shadow p-6 mb-6">
      <h3 class="font-bold text-gray-700 mb-4">➕ 新增圖片</h3>
      <p class="text-sm text-gray-500 mb-3">請輸入圖片的網址（URL）。建議先將圖片上傳至 Google Drive、Imgur 等圖床，再貼上連結。</p>
      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">圖片網址 *</label>
          <input type="url" id="new-image-url" placeholder="https://..." class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">圖片說明</label>
          <input type="text" id="new-image-caption" placeholder="圖片說明（選填）" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">排序（數字越小越前面）</label>
          <input type="number" id="new-image-order" value="${images.results.length}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
        </div>
        <div id="preview-area" class="hidden">
          <p class="text-sm text-gray-600 mb-1">預覽：</p>
          <img id="preview-img" src="" class="max-h-40 rounded-lg border">
        </div>
        <button onclick="previewImage()" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">預覽圖片</button>
        <button onclick="addImage(${id})" class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium ml-2">新增圖片</button>
      </div>
    </div>

    <!-- 現有圖片 -->
    <div class="bg-white rounded-xl shadow p-6">
      <h3 class="font-bold text-gray-700 mb-4">現有圖片（${images.results.length} 張）</h3>
      <div id="images-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        ${imgCards || '<p class="text-gray-400 text-sm col-span-full text-center py-8">尚無圖片</p>'}
      </div>
    </div>

    <script>
      function previewImage() {
        const url = document.getElementById('new-image-url').value;
        if (!url) return;
        document.getElementById('preview-img').src = url;
        document.getElementById('preview-area').classList.remove('hidden');
      }

      async function addImage(activityId) {
        const url = document.getElementById('new-image-url').value;
        const caption = document.getElementById('new-image-caption').value;
        const order = document.getElementById('new-image-order').value;
        if (!url) { alert('請輸入圖片網址'); return; }
        const res = await fetch('/api/activities/' + activityId + '/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: url, caption, display_order: parseInt(order) || 0 })
        });
        if (res.ok) location.reload();
        else alert('新增失敗，請檢查網址是否正確');
      }

      async function deleteImage(id) {
        if (!confirm('確定要刪除此圖片嗎？')) return;
        const res = await fetch('/api/images/' + id, { method: 'DELETE' });
        if (res.ok) document.getElementById('img-' + id).remove();
        else alert('刪除失敗');
      }
    </script>
  `))
})

// ===================== 童軍分組管理 =====================
adminRoutes.get('/groups', authMiddleware, async (c) => {
  const db = c.env.DB
  const groups = await db.prepare(`SELECT * FROM scout_groups ORDER BY display_order`).all()

  const rows = groups.results.map((g: any) => `
    <tr class="border-b hover:bg-gray-50">
      <td class="py-3 px-4 font-medium">${g.name}</td>
      <td class="py-3 px-4 text-sm text-gray-500">${g.name_en || '-'}</td>
      <td class="py-3 px-4 text-sm text-gray-500">${g.grade_range || '-'}</td>
      <td class="py-3 px-4 text-sm">
        <span class="px-2 py-0.5 rounded-full text-xs ${g.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">${g.is_active ? '顯示中' : '已隱藏'}</span>
      </td>
      <td class="py-3 px-4">
        <a href="/admin/groups/${g.id}/semesters" class="text-green-600 hover:text-green-800 text-sm font-medium mr-3">📂 學期/相片</a>
        <a href="/admin/groups/${g.id}/subpages" class="text-purple-600 hover:text-purple-800 text-sm font-medium mr-3">📋 組織/幹部/名單</a>
        <button onclick="editGroup(${g.id}, ${JSON.stringify(g).replace(/"/g, '&quot;')})" class="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3">編輯</button>
        <button onclick="deleteGroup(${g.id})" class="text-red-500 hover:text-red-700 text-sm font-medium">刪除</button>
      </td>
    </tr>
  `).join('')

  return c.html(adminLayout('分組管理', `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-bold text-gray-800">童軍分組管理</h2>
      <button onclick="document.getElementById('add-modal').classList.remove('hidden')" class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">➕ 新增分組</button>
    </div>
    <div class="bg-white rounded-xl shadow overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="py-3 px-4 text-left text-gray-600">名稱</th>
            <th class="py-3 px-4 text-left text-gray-600">英文名稱</th>
            <th class="py-3 px-4 text-left text-gray-600">年級範圍</th>
            <th class="py-3 px-4 text-left text-gray-600">狀態</th>
            <th class="py-3 px-4 text-left text-gray-600">操作</th>
        </tbody>
      </table>
    </div>

    <!-- 新增彈窗 -->
    <div id="add-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-bold mb-4">新增分組</h3>
        ${groupFormFields('add')}
        <div class="flex gap-3 mt-4">
          <button onclick="saveGroup()" class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex-1">儲存</button>
          <button onclick="document.getElementById('add-modal').classList.add('hidden')" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm flex-1">取消</button>
        </div>
      </div>
    </div>

    <!-- 編輯彈窗 -->
    <div id="edit-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-bold mb-4">編輯分組</h3>
        <input type="hidden" id="edit-group-id">
        ${groupFormFields('edit')}
        <div class="flex gap-3 mt-4">
          <button onclick="updateGroup()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex-1">更新</button>
          <button onclick="document.getElementById('edit-modal').classList.add('hidden')" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm flex-1">取消</button>
        </div>
      </div>
    </div>

    <script>
      function editGroup(id, data) {
        document.getElementById('edit-group-id').value = id;
        document.getElementById('edit-name').value = data.name || '';
        document.getElementById('edit-name_en').value = data.name_en || '';
        document.getElementById('edit-slug').value = data.slug || '';
        document.getElementById('edit-grade_range').value = data.grade_range || '';
        document.getElementById('edit-description').value = data.description || '';
        document.getElementById('edit-display_order').value = data.display_order || 0;
        document.getElementById('edit-is_active').checked = data.is_active === 1;
        document.getElementById('edit-modal').classList.remove('hidden');
      }
      async function saveGroup() {
        const data = {
          name: document.getElementById('add-name').value,
          name_en: document.getElementById('add-name_en').value,
          slug: document.getElementById('add-slug').value,
          grade_range: document.getElementById('add-grade_range').value,
          description: document.getElementById('add-description').value,
          display_order: parseInt(document.getElementById('add-display_order').value) || 0,
          is_active: document.getElementById('add-is_active').checked ? 1 : 0,
        };
        if (!data.name) { alert('名稱為必填'); return; }
        const res = await fetch('/api/groups', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        if (res.ok) location.reload(); else alert('儲存失敗');
      }
      async function updateGroup() {
        const id = document.getElementById('edit-group-id').value;
        const data = {
          name: document.getElementById('edit-name').value,
          name_en: document.getElementById('edit-name_en').value,
          slug: document.getElementById('edit-slug').value,
          grade_range: document.getElementById('edit-grade_range').value,
          description: document.getElementById('edit-description').value,
          display_order: parseInt(document.getElementById('edit-display_order').value) || 0,
          is_active: document.getElementById('edit-is_active').checked ? 1 : 0,
        };
        const res = await fetch('/api/groups/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        if (res.ok) location.reload(); else alert('更新失敗');
      }
      async function deleteGroup(id) {
        if (!confirm('確定要刪除此分組嗎？')) return;
        const res = await fetch('/api/groups/' + id, { method: 'DELETE' });
        if (res.ok) location.reload(); else alert('刪除失敗');
      }
    </script>
  `))
})

// ===================== 公告管理 =====================
adminRoutes.get('/announcements', authMiddleware, async (c) => {
  const db = c.env.DB
  const announcements = await db.prepare(`SELECT * FROM announcements ORDER BY created_at DESC`).all()

  const rows = announcements.results.map((a: any) => `
    <tr class="border-b hover:bg-gray-50">
      <td class="py-3 px-4 font-medium">${a.title}</td>
      <td class="py-3 px-4 text-sm text-gray-500">${a.content ? a.content.substring(0, 50) + (a.content.length > 50 ? '...' : '') : '-'}</td>
      <td class="py-3 px-4 text-sm">
        ${a.link_url ? `<a href="${a.link_url}" target="_blank" class="text-blue-500 hover:underline text-xs truncate max-w-[120px] inline-block">${a.link_url}</a>` : '-'}
      </td>
      <td class="py-3 px-4 text-sm">
        <span class="px-2 py-0.5 rounded-full text-xs ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">${a.is_active ? '顯示中' : '已隱藏'}</span>
      </td>
      <td class="py-3 px-4 text-sm text-gray-400">${a.created_at ? a.created_at.substring(0, 10) : ''}</td>
      <td class="py-3 px-4">
        <button onclick="editAnn(${a.id}, ${JSON.stringify(a).replace(/"/g, '&quot;')})" class="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3">編輯</button>
        <button onclick="deleteAnn(${a.id})" class="text-red-500 hover:text-red-700 text-sm font-medium">刪除</button>
      </td>
    </tr>
  `).join('')

  return c.html(adminLayout('公告管理', `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-bold text-gray-800">公告管理</h2>
      <button onclick="document.getElementById('add-ann-modal').classList.remove('hidden')" class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">➕ 新增公告</button>
    </div>
    <div class="bg-white rounded-xl shadow overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="py-3 px-4 text-left text-gray-600">標題</th>
            <th class="py-3 px-4 text-left text-gray-600">內容</th>
            <th class="py-3 px-4 text-left text-gray-600">連結</th>
            <th class="py-3 px-4 text-left text-gray-600">狀態</th>
            <th class="py-3 px-4 text-left text-gray-600">日期</th>
            <th class="py-3 px-4 text-left text-gray-600">操作</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="6" class="py-8 text-center text-gray-400">尚無公告</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- 新增公告彈窗 -->
    <div id="add-ann-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-bold mb-4">新增公告</h3>
        ${annFormFields('add')}
        <div class="flex gap-3 mt-4">
          <button onclick="saveAnn()" class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex-1">儲存</button>
          <button onclick="document.getElementById('add-ann-modal').classList.add('hidden')" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm flex-1">取消</button>
        </div>
      </div>
    </div>

    <!-- 編輯公告彈窗 -->
    <div id="edit-ann-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-bold mb-4">編輯公告</h3>
        <input type="hidden" id="edit-ann-id">
        ${annFormFields('edit-ann')}
        <div class="flex gap-3 mt-4">
          <button onclick="updateAnn()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex-1">更新</button>
          <button onclick="document.getElementById('edit-ann-modal').classList.add('hidden')" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm flex-1">取消</button>
        </div>
      </div>
    </div>

    <script>
      function editAnn(id, data) {
        document.getElementById('edit-ann-id').value = id;
        document.getElementById('edit-ann-title').value = data.title || '';
        document.getElementById('edit-ann-content').value = data.content || '';
        document.getElementById('edit-ann-link_url').value = data.link_url || '';
        document.getElementById('edit-ann-is_active').checked = data.is_active === 1;
        document.getElementById('edit-ann-modal').classList.remove('hidden');
      }
      async function saveAnn() {
        const data = {
          title: document.getElementById('add-ann-title').value,
          content: document.getElementById('add-ann-content').value,
          link_url: document.getElementById('add-ann-link_url').value,
          is_active: document.getElementById('add-ann-is_active').checked ? 1 : 0,
        };
        if (!data.title) { alert('標題為必填'); return; }
        const res = await fetch('/api/announcements', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        if (res.ok) location.reload(); else alert('儲存失敗');
      }
      async function updateAnn() {
        const id = document.getElementById('edit-ann-id').value;
        const data = {
          title: document.getElementById('edit-ann-title').value,
          content: document.getElementById('edit-ann-content').value,
          link_url: document.getElementById('edit-ann-link_url').value,
          is_active: document.getElementById('edit-ann-is_active').checked ? 1 : 0,
        };
        const res = await fetch('/api/announcements/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        if (res.ok) location.reload(); else alert('更新失敗');
      }
      async function deleteAnn(id) {
        if (!confirm('確定要刪除此公告嗎？')) return;
        const res = await fetch('/api/announcements/' + id, { method: 'DELETE' });
        if (res.ok) location.reload(); else alert('刪除失敗');
      }
    </script>
  `))
})

// ===================== 網站設定 =====================
adminRoutes.get('/settings', authMiddleware, async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  return c.html(adminLayout('網站設定', `
    <h2 class="text-xl font-bold text-gray-800 mb-6">網站設定</h2>
    <div class="bg-white rounded-xl shadow p-6">
      <form id="settings-form" class="space-y-5">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">網站標題（中文）</label>
          <input type="text" name="site_title" value="${settings.site_title || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">網站副標題（英文）</label>
          <input type="text" name="site_subtitle" value="${settings.site_subtitle || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">關於我們（中文）</label>
          <textarea name="about_text_zh" rows="4" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">${settings.about_text_zh || ''}</textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">About Us (English)</label>
          <textarea name="about_text_en" rows="4" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">${settings.about_text_en || ''}</textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Facebook 網址</label>
          <input type="url" name="facebook_url" value="${settings.facebook_url || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">聯絡信箱</label>
          <input type="email" name="contact_email" value="${settings.contact_email || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
        </div>
        <div id="save-msg" class="hidden bg-green-50 text-green-700 border border-green-200 rounded-lg px-4 py-3 text-sm">✅ 設定已儲存！</div>
        <button type="submit" class="bg-green-700 hover:bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium">儲存設定</button>
      </form>
    </div>
    <script>
      document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {};
        for (const [k, v] of formData.entries()) data[k] = v;
        const res = await fetch('/api/settings', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        if (res.ok) {
          document.getElementById('save-msg').classList.remove('hidden');
          setTimeout(() => document.getElementById('save-msg').classList.add('hidden'), 3000);
        } else alert('儲存失敗');
      });
    </script>
  `))
})

// ===================== 分組學期管理 =====================
adminRoutes.get('/groups/:id/semesters', authMiddleware, async (c) => {
  const db = c.env.DB
  const groupId = c.req.param('id')
  const group = await db.prepare(`SELECT * FROM scout_groups WHERE id=?`).bind(groupId).first() as any
  if (!group) return c.redirect('/admin/groups')

  const semesters = await db.prepare(`
    SELECT gs.*, COUNT(si.id) as image_count
    FROM group_semesters gs
    LEFT JOIN semester_images si ON si.semester_id = gs.id
    WHERE gs.group_id = ?
    GROUP BY gs.id
    ORDER BY gs.display_order ASC, gs.semester DESC
  `).bind(groupId).all()

  const rows = semesters.results.map((s: any) => `
    <tr class="border-b hover:bg-gray-50">
      <td class="py-3 px-4 font-medium font-mono">${s.semester}</td>
      <td class="py-3 px-4 text-sm text-gray-600">${s.title || '-'}</td>
      <td class="py-3 px-4 text-sm text-gray-500">${s.image_count} 張</td>
      <td class="py-3 px-4 text-sm">
        <span class="px-2 py-0.5 rounded-full text-xs ${s.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">${s.is_published ? '已發佈' : '草稿'}</span>
      </td>
      <td class="py-3 px-4">
        <div class="flex gap-2">
          <a href="/admin/semesters/${s.id}/images" class="text-purple-600 hover:text-purple-800 text-sm font-medium">相片管理</a>
          <button onclick="editSem(${s.id}, ${JSON.stringify(s).replace(/"/g, '&quot;')})" class="text-blue-600 hover:text-blue-800 text-sm font-medium">編輯</button>
          <button onclick="deleteSem(${s.id})" class="text-red-500 hover:text-red-700 text-sm font-medium">刪除</button>
        </div>
      </td>
    </tr>
  `).join('')

  return c.html(adminLayout(`${group.name} - 學期管理`, `
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-xl font-bold text-gray-800">${group.name} — 學期管理</h2>
        <p class="text-gray-500 text-sm mt-0.5">${group.name_en || ''} ${group.grade_range || ''}</p>
      </div>
      <div class="flex gap-2">
        <a href="/admin/groups" class="text-gray-500 hover:text-gray-700 text-sm py-2 px-3">← 返回分組</a>
        <button onclick="document.getElementById('add-sem-modal').classList.remove('hidden')" class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">➕ 新增學期</button>
      </div>
    </div>

    <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5 text-sm text-amber-800">
      💡 <strong>提示：</strong>「學期」對應原網站的頁面層級，如 <code class="bg-amber-100 px-1 rounded">113-1</code>、<code class="bg-amber-100 px-1 rounded">112-2</code>。建立後可在「相片管理」中新增圖片。
    </div>

    <div class="bg-white rounded-xl shadow overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="py-3 px-4 text-left text-gray-600">學期代碼</th>
            <th class="py-3 px-4 text-left text-gray-600">標題</th>
            <th class="py-3 px-4 text-left text-gray-600">相片數</th>
            <th class="py-3 px-4 text-left text-gray-600">狀態</th>
            <th class="py-3 px-4 text-left text-gray-600">操作</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="5" class="py-8 text-center text-gray-400">尚無學期資料</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- 新增學期彈窗 -->
    <div id="add-sem-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-bold mb-4">新增學期</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">學期代碼 * <span class="text-gray-400 font-normal">（如 113-1、112-2）</span></label>
            <input type="text" id="add-sem-semester" placeholder="113-1" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">學期標題 <span class="text-gray-400 font-normal">（選填，如 113學年度 第1學期）</span></label>
            <input type="text" id="add-sem-title" placeholder="113學年度 第1學期" class="w-full border rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">說明</label>
            <textarea id="add-sem-description" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="學期活動說明..."></textarea>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">封面圖片網址 <span class="text-gray-400">(選填)</span></label>
            <input type="url" id="add-sem-cover" placeholder="https://..." class="w-full border rounded-lg px-3 py-2 text-sm">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">排序</label>
              <input type="number" id="add-sem-order" value="0" class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
            <div class="flex items-end gap-2 pb-1">
              <input type="checkbox" id="add-sem-published" checked class="w-4 h-4 text-green-600">
              <label for="add-sem-published" class="text-sm text-gray-700">立即發佈</label>
            </div>
          </div>
        </div>
        <div class="flex gap-3 mt-4">
          <button onclick="saveSem(${groupId})" class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex-1">新增</button>
          <button onclick="document.getElementById('add-sem-modal').classList.add('hidden')" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm flex-1">取消</button>
        </div>
      </div>
    </div>

    <!-- 編輯學期彈窗 -->
    <div id="edit-sem-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-bold mb-4">編輯學期</h3>
        <input type="hidden" id="edit-sem-id">
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">學期代碼 *</label>
            <input type="text" id="edit-sem-semester" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">學期標題</label>
            <input type="text" id="edit-sem-title" class="w-full border rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">說明</label>
            <textarea id="edit-sem-description" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm"></textarea>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">封面圖片網址</label>
            <input type="url" id="edit-sem-cover" class="w-full border rounded-lg px-3 py-2 text-sm">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">排序</label>
              <input type="number" id="edit-sem-order" value="0" class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
            <div class="flex items-end gap-2 pb-1">
              <input type="checkbox" id="edit-sem-published" class="w-4 h-4 text-green-600">
              <label for="edit-sem-published" class="text-sm text-gray-700">已發佈</label>
            </div>
          </div>
        </div>
        <div class="flex gap-3 mt-4">
          <button onclick="updateSem()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex-1">更新</button>
          <button onclick="document.getElementById('edit-sem-modal').classList.add('hidden')" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm flex-1">取消</button>
        </div>
      </div>
    </div>

    <script>
      function editSem(id, data) {
        document.getElementById('edit-sem-id').value = id;
        document.getElementById('edit-sem-semester').value = data.semester || '';
        document.getElementById('edit-sem-title').value = data.title || '';
        document.getElementById('edit-sem-description').value = data.description || '';
        document.getElementById('edit-sem-cover').value = data.cover_image || '';
        document.getElementById('edit-sem-order').value = data.display_order || 0;
        document.getElementById('edit-sem-published').checked = data.is_published === 1;
        document.getElementById('edit-sem-modal').classList.remove('hidden');
      }
      async function saveSem(groupId) {
        const data = {
          semester: document.getElementById('add-sem-semester').value,
          title: document.getElementById('add-sem-title').value,
          description: document.getElementById('add-sem-description').value,
          cover_image: document.getElementById('add-sem-cover').value,
          display_order: parseInt(document.getElementById('add-sem-order').value) || 0,
          is_published: document.getElementById('add-sem-published').checked ? 1 : 0,
        };
        if (!data.semester) { alert('學期代碼為必填'); return; }
        const res = await fetch('/api/groups/' + groupId + '/semesters', {
          method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)
        });
        if (res.ok) location.reload(); else alert('儲存失敗');
      }
      async function updateSem() {
        const id = document.getElementById('edit-sem-id').value;
        const data = {
          semester: document.getElementById('edit-sem-semester').value,
          title: document.getElementById('edit-sem-title').value,
          description: document.getElementById('edit-sem-description').value,
          cover_image: document.getElementById('edit-sem-cover').value,
          display_order: parseInt(document.getElementById('edit-sem-order').value) || 0,
          is_published: document.getElementById('edit-sem-published').checked ? 1 : 0,
        };
        const res = await fetch('/api/semesters/' + id, {
          method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)
        });
        if (res.ok) location.reload(); else alert('更新失敗');
      }
      async function deleteSem(id) {
        if (!confirm('確定要刪除此學期嗎？（包含所有相片）')) return;
        const res = await fetch('/api/semesters/' + id, { method: 'DELETE' });
        if (res.ok) location.reload(); else alert('刪除失敗');
      }
    </script>
  `))
})

// ===================== 學期相片管理 =====================
adminRoutes.get('/semesters/:id/images', authMiddleware, async (c) => {
  const db = c.env.DB
  const semId = c.req.param('id')
  const semester = await db.prepare(`
    SELECT gs.*, sg.name as group_name, sg.slug as group_slug, sg.id as group_id
    FROM group_semesters gs
    JOIN scout_groups sg ON sg.id = gs.group_id
    WHERE gs.id=?
  `).bind(semId).first() as any
  if (!semester) return c.redirect('/admin/groups')

  const images = await db.prepare(`SELECT * FROM semester_images WHERE semester_id=? ORDER BY display_order ASC`).bind(semId).all()

  const imgCards = images.results.map((img: any) => `
    <div class="bg-white border rounded-xl overflow-hidden shadow-sm" id="si-${img.id}">
      <div class="aspect-video bg-gray-100 overflow-hidden">
        <img src="${img.image_url}" alt="${img.caption || ''}" class="w-full h-full object-cover"
          onerror="this.parentElement.innerHTML='<div class=\\'flex items-center justify-center h-full text-gray-400 text-sm\\'>圖片無法顯示</div>'">
      </div>
      <div class="p-3">
        <p class="text-xs text-gray-500 break-all mb-1">${img.image_url.length > 60 ? img.image_url.substring(0,60) + '...' : img.image_url}</p>
        <p class="text-xs text-gray-600">${img.caption || '（無說明）'}</p>
        <button onclick="deleteSemImg(${img.id})" class="mt-2 text-red-500 hover:text-red-700 text-xs font-medium">🗑 刪除</button>
      </div>
    </div>
  `).join('')

  return c.html(adminLayout(`相片管理：${semester.group_name} ${semester.semester}`, `
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-xl font-bold text-gray-800">相片管理</h2>
        <p class="text-gray-500 text-sm">${semester.group_name} › ${semester.title || semester.semester}</p>
      </div>
      <div class="flex gap-2">
        <a href="/admin/groups/${semester.group_id}/semesters" class="text-gray-500 hover:text-gray-700 text-sm py-2 px-3">← 返回學期列表</a>
        <a href="/group/${semester.group_slug}/${semester.semester}" target="_blank" class="text-green-600 hover:text-green-800 text-sm py-2 px-3 border border-green-200 rounded-lg">🌐 預覽前台</a>
      </div>
    </div>

    <!-- 批量新增 / 單一新增 -->
    <div class="bg-white rounded-xl shadow p-6 mb-6">
      <h3 class="font-bold text-gray-700 mb-1">➕ 新增相片</h3>
      <p class="text-sm text-gray-400 mb-4">輸入圖片網址（可一次填入多個，每行一個）。建議先上傳至 Google Drive、Imgur 等圖床再貼上連結。</p>
      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">圖片網址（每行一個）</label>
          <textarea id="bulk-urls" rows="5" class="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="https://example.com/photo1.jpg&#10;https://example.com/photo2.jpg&#10;..."></textarea>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">說明（批量時套用相同說明，可留空）</label>
            <input type="text" id="bulk-caption" placeholder="圖片說明（選填）" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">起始排序</label>
            <input type="number" id="bulk-order" value="${images.results.length}" class="w-full border rounded-lg px-3 py-2 text-sm">
          </div>
        </div>
        <div id="bulk-preview" class="hidden">
          <p class="text-sm text-gray-600 mb-2">預覽（第一張）：</p>
          <img id="bulk-preview-img" src="" class="max-h-40 rounded-lg border">
        </div>
        <div class="flex gap-2">
          <button onclick="previewBulk()" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">預覽第一張</button>
          <button onclick="addBulkImages(${semId})" class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">新增相片</button>
        </div>
      </div>
    </div>

    <!-- 現有相片 -->
    <div class="bg-white rounded-xl shadow p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-gray-700">現有相片（${images.results.length} 張）</h3>
      </div>
      <div id="images-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        ${imgCards || '<p class="text-gray-400 text-sm col-span-full text-center py-8">尚無相片</p>'}
      </div>
    </div>

    <script>
      function previewBulk() {
        const urls = document.getElementById('bulk-urls').value.trim().split('\\n').filter(u => u.trim());
        if (!urls.length) return;
        document.getElementById('bulk-preview-img').src = urls[0].trim();
        document.getElementById('bulk-preview').classList.remove('hidden');
      }
      async function addBulkImages(semId) {
        const urls = document.getElementById('bulk-urls').value.trim().split('\\n').map(u => u.trim()).filter(u => u);
        const caption = document.getElementById('bulk-caption').value;
        let startOrder = parseInt(document.getElementById('bulk-order').value) || 0;
        if (!urls.length) { alert('請輸入至少一個圖片網址'); return; }
        let success = 0;
        for (const url of urls) {
          const res = await fetch('/api/semesters/' + semId + '/images', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ image_url: url, caption: caption || null, display_order: startOrder++ })
          });
          if (res.ok) success++;
        }
        if (success > 0) {
          alert('成功新增 ' + success + ' 張相片');
          location.reload();
        } else alert('新增失敗，請檢查網址是否正確');
      }
      async function deleteSemImg(id) {
        if (!confirm('確定要刪除此相片嗎？')) return;
        const res = await fetch('/api/semester-images/' + id, { method: 'DELETE' });
        if (res.ok) document.getElementById('si-' + id).remove();
        else alert('刪除失敗');
      }
    </script>
  `))
})

// ===================== 輔助函式 =====================
function activityForm(activity: any) {
  const isEdit = !!activity
  const categories = [
    { value: 'general', label: '一般活動' },
    { value: 'camping', label: '大露營' },
    { value: 'tecc', label: 'TECC 急救訓練' },
    { value: 'training', label: '訓練課程' },
    { value: 'service', label: '服務活動' },
  ]
  const catOptions = categories.map(c =>
    `<option value="${c.value}" ${activity?.category === c.value ? 'selected' : ''}>${c.label}</option>`
  ).join('')

  return `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-bold text-gray-800">${isEdit ? '編輯活動' : '新增活動'}</h2>
      <a href="/admin/activities" class="text-gray-500 hover:text-gray-700 text-sm">← 返回</a>
    </div>
    <div class="bg-white rounded-xl shadow p-6">
      <form id="activity-form" class="space-y-5">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <!-- 基本資訊 -->
          <div class="md:col-span-2 border-b pb-2 mb-2">
            <h3 class="font-bold text-gray-700">基本資訊</h3>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">活動標題 *</label>
            <input type="text" id="f-title" value="${activity?.title || ''}" required class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="例：第12屆全國童軍大露營">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">英文標題</label>
            <input type="text" id="f-title_en" value="${activity?.title_en || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g. 12th National Scout Jamboree">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">活動類型</label>
            <select id="f-category" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">${catOptions}</select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">地點</label>
            <input type="text" id="f-location" value="${activity?.location || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="例：陽明山露營場">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
            <input type="date" id="f-activity_date" value="${activity?.activity_date || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">結束日期 (選填)</label>
            <input type="date" id="f-activity_end_date" value="${activity?.activity_end_date || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">日期顯示文字 (覆蓋自動格式)</label>
            <input type="text" id="f-date_display" value="${activity?.date_display || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="例：2025年6月30日 - 7月2日">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">費用說明</label>
            <input type="text" id="f-cost" value="${activity?.cost || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="例：200元 / 免費">
          </div>
          
          <!-- 詳細內容 -->
          <div class="md:col-span-2 border-b pb-2 mb-2 mt-4">
            <h3 class="font-bold text-gray-700">詳細內容</h3>
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">簡短說明 (列表顯示)</label>
            <textarea id="f-description" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="活動簡介...">${activity?.description || ''}</textarea>
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">詳細內容 (HTML 格式)</label>
            <textarea id="f-content" rows="6" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono" placeholder="<p>活動詳細介紹...</p>">${activity?.content || ''}</textarea>
            <p class="text-xs text-gray-400 mt-1">支援基本 HTML 標籤</p>
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">YouTube 影片 ID</label>
            <input type="text" id="f-youtube_url" value="${activity?.youtube_url || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="例：Odi8piH1PHE">
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">封面圖片 URL</label>
            <input type="text" id="f-cover_image" value="${activity?.cover_image || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="https://example.com/photo.jpg">
          </div>

          <!-- 報名設定 -->
          <div class="md:col-span-2 border-b pb-2 mb-2 mt-4">
            <h3 class="font-bold text-gray-700">報名設定</h3>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">報名開始時間</label>
            <input type="datetime-local" id="f-registration_start" value="${activity?.registration_start ? activity.registration_start.substring(0, 16) : ''}" class="w-full border rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">報名截止時間</label>
            <input type="datetime-local" id="f-registration_end" value="${activity?.registration_end ? activity.registration_end.substring(0, 16) : ''}" class="w-full border rounded-lg px-3 py-2 text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">名額限制 (留空不限)</label>
            <input type="number" id="f-max_participants" value="${activity?.max_participants || ''}" class="w-full border rounded-lg px-3 py-2 text-sm">
          </div>
          <div class="flex items-end pb-2">
             <div class="flex items-center gap-2">
              <input type="checkbox" id="f-is_registration_open" ${activity?.is_registration_open ? 'checked' : ''} class="w-4 h-4 text-blue-600">
              <label for="f-is_registration_open" class="text-sm font-bold text-blue-700">開放線上報名</label>
            </div>
          </div>

          <!-- 其他設定 -->
          <div class="md:col-span-2 border-b pb-2 mb-2 mt-4">
            <h3 class="font-bold text-gray-700">其他設定</h3>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">排序</label>
            <input type="number" id="f-display_order" value="${activity?.display_order || 0}" class="w-full border rounded-lg px-3 py-2 text-sm">
          </div>
          <div class="flex items-center gap-4 mt-6">
            <div class="flex items-center gap-2">
              <input type="checkbox" id="f-is_published" ${activity?.is_published !== 0 ? 'checked' : ''} class="w-4 h-4 text-green-600">
              <label for="f-is_published" class="text-sm text-gray-700">發佈活動</label>
            </div>
            <div class="flex items-center gap-2">
              <input type="checkbox" id="f-show_in_highlights" ${activity?.show_in_highlights ? 'checked' : ''} class="w-4 h-4 text-amber-500">
              <label for="f-show_in_highlights" class="text-sm text-gray-700">顯示在精彩回顧</label>
            </div>
          </div>
        </div>
        
        <div id="form-msg" class="hidden bg-green-50 text-green-700 border border-green-200 rounded-lg px-4 py-3 text-sm"></div>
        <div class="flex gap-3 pt-4 border-t">
          <button type="submit" class="bg-green-700 hover:bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium">${isEdit ? '更新活動' : '新增活動'}</button>
          <a href="/admin/activities" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2.5 rounded-lg text-sm">取消</a>
        </div>
      </form>
    </div>
    <script>
      document.getElementById('activity-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
          title: document.getElementById('f-title').value,
          title_en: document.getElementById('f-title_en').value,
          description: document.getElementById('f-description').value,
          // description_en: document.getElementById('f-description_en').value, // 暫時隱藏
          activity_date: document.getElementById('f-activity_date').value,
          activity_end_date: document.getElementById('f-activity_end_date').value,
          date_display: document.getElementById('f-date_display').value,
          category: document.getElementById('f-category').value,
          location: document.getElementById('f-location').value,
          cost: document.getElementById('f-cost').value,
          content: document.getElementById('f-content').value,
          youtube_url: document.getElementById('f-youtube_url').value,
          display_order: parseInt(document.getElementById('f-display_order').value) || 0,
          cover_image: document.getElementById('f-cover_image').value,
          registration_start: document.getElementById('f-registration_start').value || null,
          registration_end: document.getElementById('f-registration_end').value || null,
          max_participants: document.getElementById('f-max_participants').value ? parseInt(document.getElementById('f-max_participants').value) : null,
          is_registration_open: document.getElementById('f-is_registration_open').checked ? 1 : 0,
          is_published: document.getElementById('f-is_published').checked ? 1 : 0,
          show_in_highlights: document.getElementById('f-show_in_highlights').checked ? 1 : 0,
        };
        const url = '${isEdit ? `/api/activities/${activity?.id}` : '/api/activities'}';
        const method = '${isEdit ? 'PUT' : 'POST'}';
        const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        const msg = document.getElementById('form-msg');
        if (res.ok) {
          msg.textContent = '${isEdit ? '✅ 活動已更新！' : '✅ 活動已新增！'}';
          msg.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'border-red-200');
          msg.classList.add('bg-green-50', 'text-green-700', 'border-green-200');
          ${isEdit ? '' : "setTimeout(() => window.location.href = '/admin/activities', 1500);"}
        } else {
          msg.textContent = '❌ 操作失敗，請重試';
          msg.classList.remove('hidden', 'bg-green-50', 'text-green-700', 'border-green-200');
          msg.classList.add('bg-red-50', 'text-red-700', 'border-red-200');
        }
        msg.classList.remove('hidden');
      });
    </script>
  `
}

function groupFormFields(prefix: string) {
  return `
    <div class="space-y-3">
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">名稱 *</label>
        <input type="text" id="${prefix}-name" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="例：童軍團">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">英文名稱</label>
        <input type="text" id="${prefix}-name_en" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Scout Troop">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">URL Slug <span class="text-gray-400 font-normal">（用於網址，英文小寫+連字號，如 scout-troop）</span></label>
        <input type="text" id="${prefix}-slug" class="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="scout-troop">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">年級範圍</label>
        <input type="text" id="${prefix}-grade_range" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例：G7-G8">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">說明</label>
        <textarea id="${prefix}-description" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="分組說明..."></textarea>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">排序</label>
          <input type="number" id="${prefix}-display_order" value="0" class="w-full border rounded-lg px-3 py-2 text-sm">
        </div>
        <div class="flex items-end gap-2 pb-1">
          <input type="checkbox" id="${prefix}-is_active" checked class="w-4 h-4 text-green-600">
          <label for="${prefix}-is_active" class="text-sm text-gray-700">顯示中</label>
        </div>
      </div>
    </div>
  `
}

function annFormFields(prefix: string) {
  return `
    <div class="space-y-3">
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">標題 *</label>
        <input type="text" id="${prefix}-title" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="公告標題">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">內容</label>
        <textarea id="${prefix}-content" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="公告內容（選填）"></textarea>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">連結網址</label>
        <input type="url" id="${prefix}-link_url" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://...（選填）">
      </div>
      <div class="flex items-center gap-2">
        <input type="checkbox" id="${prefix}-is_active" checked class="w-4 h-4 text-green-600">
        <label for="${prefix}-is_active" class="text-sm text-gray-700">顯示中</label>
      </div>
    </div>
  `
}

function adminLayout(title: string, content: string) {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - 後台管理</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen">
  <!-- 側邊欄 -->
  <div class="flex min-h-screen">
    <aside class="w-56 bg-[#1a472a] text-white flex-shrink-0 flex flex-col">
      <div class="p-5 border-b border-green-700">
        <div class="flex items-center gap-2">
          <span class="text-2xl">⚜️</span>
          <div>
            <div class="font-bold text-sm">童軍團後台</div>
            <div class="text-xs text-green-300">管理系統</div>
          </div>
        </div>
      </div>
      <nav class="flex-1 p-3 space-y-1">
        <a href="/admin" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm ${title === '儀表板' ? 'bg-green-700' : ''}">
          <span>🏠</span> 儀表板
        </a>
        <div class="text-xs text-green-400 font-semibold uppercase tracking-wider px-3 py-1 mt-2">網站內容</div>
        <a href="/admin/activities" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm ${title.includes('活動') ? 'bg-green-700' : ''}">
          <span>📋</span> 活動管理
        </a>
        <a href="/admin/groups" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm ${title === '分組管理' ? 'bg-green-700' : ''}">
          <span>👥</span> 童軍分組
        </a>
        <!-- 分組子選單（組織/幹部/名單快速入口）-->
        <div class="ml-2 pl-3 border-l-2 border-green-600 space-y-0.5">
          <a href="/admin/groups/1/subpages" class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-xs ${title.includes('童軍團') ? 'bg-green-700' : 'text-green-200'}">
            🏕️ 童軍團
          </a>
          <a href="/admin/groups/2/subpages" class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-xs ${title.includes('深資') ? 'bg-green-700' : 'text-green-200'}">
            ⛺ 深資童軍團
          </a>
          <a href="/admin/groups/3/subpages" class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-xs ${title.includes('羅浮') ? 'bg-green-700' : 'text-green-200'}">
            🧭 羅浮童軍群
          </a>
        </div>
        <a href="/admin/announcements" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm ${title === '公告管理' ? 'bg-green-700' : ''}">
          <span>📢</span> 公告管理
        </a>
        <div class="text-xs text-green-400 font-semibold uppercase tracking-wider px-3 py-1 mt-2">人員管理</div>
        <a href="/admin/members" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm ${title.includes('成員') ? 'bg-green-700' : ''}">
          <span>🪖</span> 成員管理
        </a>
        <div class="ml-2 pl-3 border-l-2 border-green-600 space-y-0.5">
          <a href="/admin/members/import" class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-xs ${title.includes('匯入') ? 'bg-green-700' : 'text-green-200'}">
            📥 批次匯入
          </a>
        </div>
        <a href="/admin/attendance" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm ${title.includes('考勤') || title.includes('出席') || title.includes('請假') || title.includes('公假') ? 'bg-green-700' : ''}">
          <span>📅</span> 考勤管理
        </a>
        <div class="ml-2 pl-3 border-l-2 border-green-600 space-y-0.5">
          <a href="/admin/attendance" class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-xs ${title.includes('出席') ? 'bg-green-700' : 'text-green-200'}">
            📝 出席管理
          </a>
          <a href="/admin/leaves" class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-xs ${title.includes('請假') ? 'bg-green-700' : 'text-green-200'}">
            ✅ 請假審核
          </a>
          <a href="/admin/official-leave" class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-xs ${title.includes('公假') ? 'bg-green-700' : 'text-green-200'}">
            📋 公假管理
          </a>
        </div>
        <a href="/admin/advancement" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm ${title.includes('進程') || title.includes('專科章') ? 'bg-green-700' : ''}">
          <span>🏅</span> 進程/榮譽
        </a>
        <!-- 進程子選單 -->
        <div class="ml-2 pl-3 border-l-2 border-green-600 space-y-0.5">
          <a href="/admin/advancement" class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-xs ${title === '進程管理中心' ? 'bg-green-700' : 'text-green-200'}">
            📊 總覽與審核
          </a>
          <a href="/admin/advancement/badges" class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-xs ${title === '專科章設定' ? 'bg-green-700' : 'text-green-200'}">
            📛 專科章設定
          </a>
          <a href="/admin/progress" class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-xs ${title === '進程標準設定' ? 'bg-green-700' : 'text-green-200'}">
            📏 標準設定
          </a>
        </div>
        <a href="/admin/member-accounts" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm ${title.includes('帳號') ? 'bg-green-700' : ''}">
          <span>🔑</span> 會員帳號
        </a>
        <a href="/admin/coaches" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm ${title.includes('教練') ? 'bg-green-700' : ''}">
          <span>🧢</span> 教練團
        </a>
        <div class="text-xs text-green-400 font-semibold uppercase tracking-wider px-3 py-1 mt-2">系統</div>
        <a href="/admin/stats" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm ${title.includes('統計') ? 'bg-green-700' : ''}">
          <span>📊</span> 統計報表
        </a>
        <a href="/admin/settings" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm ${title === '網站設定' ? 'bg-green-700' : ''}">
          <span>⚙️</span> 網站設定
        </a>
      </nav>
      <div class="p-3 border-t border-green-700">
        <a href="/" target="_blank" class="flex items-center gap-2 px-3 py-2 text-xs text-green-300 hover:text-white transition-colors">
          <span>🌐</span> 查看前台
        </a>
        <a href="/admin/logout" class="flex items-center gap-2 px-3 py-2 text-xs text-green-300 hover:text-white transition-colors">
          <span>🚪</span> 登出
        </a>
      </div>
    </aside>

    <!-- 主內容 -->
    <main class="flex-1 p-6 overflow-auto">
      <div class="max-w-5xl mx-auto">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-gray-800">${title}</h1>
        </div>
        ${content}
      </div>
    </main>
  </div>
</body>
</html>`
}

// ===================== 專科章設定 =====================
adminRoutes.get('/advancement/badges', authMiddleware, async (c) => {
  const db = c.env.DB
  const badges = await db.prepare(`SELECT * FROM specialty_badges WHERE is_active = 1 ORDER BY category, display_order`).all()
  
  const categories = ['技能', '服務', '健身', '其他']
  const badgesByCat: Record<string, any[]> = {}
  categories.forEach(c => badgesByCat[c] = [])
  badges.results.forEach((b: any) => {
    const cat = b.category || '其他'
    if (!badgesByCat[cat]) badgesByCat[cat] = []
    badgesByCat[cat].push(b)
  })

  return c.html(adminLayout('專科章設定', `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-bold text-gray-800">專科章設定</h2>
      <button onclick="openBadgeModal()" class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">➕ 新增專科章</button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${Object.entries(badgesByCat).map(([cat, list]) => `
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="bg-gray-50 px-4 py-3 border-b font-bold text-gray-700 flex justify-between">
          <span>${cat}類</span>
          <span class="text-xs bg-gray-200 px-2 py-0.5 rounded-full text-gray-600">${list.length}</span>
        </div>
        <div class="divide-y divide-gray-50">
          ${list.length === 0 ? '<div class="p-4 text-center text-gray-400 text-sm">無專科章</div>' : 
            list.map(b => `
            <div class="p-3 flex items-center justify-between hover:bg-gray-50 group">
              <div class="flex items-center gap-3">
                ${b.image_url ? `<img src="${b.image_url}" class="w-8 h-8 object-contain">` : 
                  `<div class="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 text-xs font-bold">章</div>`}
                <span class="font-medium text-gray-800">${b.name}</span>
              </div>
              <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onclick="openBadgeModal(${JSON.stringify(b).replace(/"/g, '&quot;')})" class="text-blue-600 text-xs hover:underline">編輯</button>
                <button onclick="deleteBadge(${b.id})" class="text-red-500 text-xs hover:underline">刪除</button>
              </div>
            </div>`).join('')}
        </div>
      </div>
      `).join('')}
    </div>

    <!-- 專科章 Modal -->
    <div id="badgeModal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 class="text-lg font-bold mb-4" id="badgeModalTitle">新增專科章</h3>
        <input type="hidden" id="badgeId">
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">名稱</label>
            <input type="text" id="badgeName" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">類別</label>
            <select id="badgeCategory" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="技能">技能</option>
              <option value="服務">服務</option>
              <option value="健身">健身</option>
              <option value="其他">其他</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">圖片網址 (選填)</label>
            <input type="text" id="badgeImage" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://...">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">排序</label>
            <input type="number" id="badgeOrder" class="w-full border rounded-lg px-3 py-2 text-sm" value="0">
          </div>
        </div>
        <div class="flex gap-3 mt-6">
          <button onclick="saveBadge()" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium">儲存</button>
          <button onclick="document.getElementById('badgeModal').classList.add('hidden')" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm">取消</button>
        </div>
      </div>
    </div>

    <script>
      function openBadgeModal(badge = null) {
        document.getElementById('badgeId').value = badge ? badge.id : '';
        document.getElementById('badgeName').value = badge ? badge.name : '';
        document.getElementById('badgeCategory').value = badge ? badge.category : '技能';
        document.getElementById('badgeImage').value = badge ? badge.image_url || '' : '';
        document.getElementById('badgeOrder').value = badge ? badge.display_order : 0;
        document.getElementById('badgeModalTitle').innerText = badge ? '編輯專科章' : '新增專科章';
        document.getElementById('badgeModal').classList.remove('hidden');
      }

      async function saveBadge() {
        const id = document.getElementById('badgeId').value;
        const data = {
          name: document.getElementById('badgeName').value,
          category: document.getElementById('badgeCategory').value,
          image_url: document.getElementById('badgeImage').value,
          display_order: parseInt(document.getElementById('badgeOrder').value) || 0
        };
        
        const url = id ? '/api/specialty-badges/' + id : '/api/specialty-badges';
        const method = id ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
          method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
        });
        
        if (res.ok) location.reload();
        else alert('儲存失敗');
      }

      async function deleteBadge(id) {
        if (!confirm('確定要刪除此專科章嗎？')) return;
        const res = await fetch('/api/specialty-badges/' + id, { method: 'DELETE' });
        if (res.ok) location.reload();
      }
    </script>
  `))
})

// ===================== 成員管理 =====================
adminRoutes.get('/members', authMiddleware, async (c) => {
  const db = c.env.DB
  const yearLabel = c.req.query('year') || '114'
  const section = c.req.query('section') || ''
  const search = c.req.query('search') || ''

  // 取得目前年度設定
  const yearSetting = await db.prepare(`SELECT value FROM site_settings WHERE key='current_year_label'`).first() as any
  const currentYear = yearLabel || yearSetting?.value || '114'

  // 取得此年度在籍成員（含歷史參與年度統計）
  let enrollQuery = `
    SELECT me.id as enroll_id, me.*, m.chinese_name, m.english_name, m.gender, m.national_id, m.dob, m.phone, m.email, m.parent_name,
      (SELECT GROUP_CONCAT(year_label ORDER BY year_label) FROM member_enrollments WHERE member_id=m.id AND is_active=1 AND year_label != ?) as past_years
    FROM member_enrollments me
    JOIN members m ON m.id = me.member_id
    WHERE me.year_label = ? AND me.is_active = 1
  `
  const params: any[] = [currentYear, currentYear]
  if (section) { enrollQuery += ` AND me.section = ?`; params.push(section) }
  if (search) { enrollQuery += ` AND (m.chinese_name LIKE ? OR m.english_name LIKE ?)`; params.push(`%${search}%`, `%${search}%`) }
  enrollQuery += ` ORDER BY me.section, me.unit_name, m.chinese_name`
  const enrolled = await db.prepare(enrollQuery).bind(...params).all()

  // 統計
  const totalCount = enrolled.results.length
  const sectionCounts: Record<string, number> = {}
  enrolled.results.forEach((r: any) => {
    if (!sectionCounts[r.section]) sectionCounts[r.section] = 0
    sectionCounts[r.section]++
  })

  // 小隊清單
  const unitsRes = await db.prepare(`SELECT * FROM scout_units WHERE is_active=1 ORDER BY unit_order`).all()
  const unitOptions = (unitsRes.results as any[]).map((u: any) =>
    `<option value="${u.unit_name}">${u.unit_name}</option>`
  ).join('')

  const sectionList = ['童軍','行義童軍','羅浮童軍','服務員']
  // 行義童軍與童軍共用相同階級名稱（見習童軍、初級童軍...）
  const ranks = ['','見習童軍','初級童軍','中級童軍','高級童軍','獅級童軍','長城童軍','國花童軍','見習羅浮','授銜羅浮','服務羅浮']

  // 停團/未續成員（有歷史在籍記錄但本年度不在籍）
  const inactiveRes = await db.prepare(`
    SELECT m.id as member_id, m.chinese_name, m.english_name, m.gender, m.section as base_section,
      me_last.section as last_section, me_last.rank_level as last_rank, me_last.unit_name as last_unit,
      me_last.year_label as last_year
    FROM members m
    LEFT JOIN member_enrollments me_cur ON me_cur.member_id = m.id AND me_cur.year_label = ? AND me_cur.is_active = 1
    LEFT JOIN member_enrollments me_last ON me_last.id = (
      SELECT id FROM member_enrollments WHERE member_id = m.id AND is_active = 1 AND year_label < ?
      ORDER BY year_label DESC LIMIT 1
    )
    WHERE me_cur.id IS NULL
      AND me_last.id IS NOT NULL
    ORDER BY me_last.section, m.chinese_name
  `).bind(currentYear, currentYear).all()
  const inactiveCount = inactiveRes.results.length

  const showInactive = section === '__inactive__'

  const sectionTabs = [['', '全部'],...sectionList.map(s => [s, s])].map(([v, l]) => `
    <a href="/admin/members?year=${currentYear}${v ? '&section='+encodeURIComponent(v) : ''}${search ? '&search='+encodeURIComponent(search) : ''}"
      class="px-3 py-1.5 rounded-full text-sm font-medium transition ${!showInactive && section === v ? 'bg-green-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}">
      ${l} <span class="ml-1 text-xs opacity-70">${v ? (sectionCounts[v]||0) : totalCount}</span>
    </a>
  `).join('') + `
    <a href="/admin/members?year=${currentYear}&section=__inactive__${search ? '&search='+encodeURIComponent(search) : ''}"
      class="px-3 py-1.5 rounded-full text-sm font-medium transition ${showInactive ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'}">
      🛑 停團/未續 <span class="ml-1 text-xs opacity-80">${inactiveCount}</span>
    </a>
  `

  const rows = (enrolled.results as any[]).map((m: any, i: number) => `
    <tr class="hover:bg-gray-50 border-b text-sm">
      <td class="px-3 py-2.5 text-gray-400 text-xs">${i + 1}</td>
      <td class="px-3 py-2.5 text-xs text-gray-500">54團</td>
      <td class="px-3 py-2.5 font-medium">
        <a href="/admin/members/${m.member_id}" class="text-green-700 hover:underline">${m.chinese_name}</a>
        ${m.english_name ? '<div class="text-xs text-gray-400">' + m.english_name + '</div>' : ''}
      </td>
      <td class="px-3 py-2.5 text-gray-500">${m.gender || '-'}</td>
      <td class="px-3 py-2.5">
        ${m.past_years
          ? (() => {
              const years = m.past_years.split(',').filter((y: string) => y.trim());
              const badges = years.slice(-3).map((y: string) => `<span class="inline-block text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded mr-0.5">${y.trim()}</span>`).join('');
              return `<div title="曾參加：${m.past_years}">${badges}${years.length > 3 ? `<span class="text-xs text-gray-400">+${years.length-3}</span>` : ''}</div>`;
            })()
          : `<span class="text-xs text-gray-400">新生</span>`
        }
      </td>
      <td class="px-3 py-2.5 text-gray-500">${m.national_id || '-'}</td>
      <td class="px-3 py-2.5 text-gray-500">${m.dob ? m.dob.substring(0,10) : '-'}</td>
      <td class="px-3 py-2.5">
        <span class="px-2 py-0.5 rounded text-xs ${m.section === '童軍' ? 'bg-green-100 text-green-700' : m.section === '行義童軍' ? 'bg-blue-100 text-blue-700' : m.section === '羅浮童軍' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}">${m.section || '-'}</span>
      </td>
      <td class="px-3 py-2.5 text-gray-500">${m.rank_level || '-'}</td>
      <td class="px-3 py-2.5 text-gray-500">${m.unit_name || '-'}</td>
      <td class="px-3 py-2.5 text-gray-500">${m.role_name || '-'}</td>
      <td class="px-3 py-2.5">
        <button onclick="openEditEnroll(${JSON.stringify(m).replace(/"/g, '&quot;')})" class="text-blue-600 hover:text-blue-800 text-xs mr-2">✏️ 編輯</button>
        <button onclick="removeEnroll(${m.enroll_id},'${m.chinese_name}')" class="text-red-400 hover:text-red-600 text-xs">移除</button>
      </td>
    </tr>
  `).join('')

  // 產生從 108 到 currentYear 的年度選項（若 currentYear > 115 則包含更高年度）
  const maxYear = Math.max(parseInt(currentYear), 115)
  const yearRange = Array.from({length: maxYear - 108 + 1}, (_, i) => String(108 + i))

  return c.html(adminLayout('成員名冊', `
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <div class="flex items-center gap-1.5">
        <label class="text-xs text-gray-500 mr-1">學年度</label>
        <select id="year-select" onchange="changeYear(this.value)" class="border rounded-lg px-3 py-1.5 text-sm font-bold text-green-700">
          ${yearRange.map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y} 學年</option>`).join('')}
        </select>
        <button onclick="addNewYear()" title="新增下一個學年度"
          class="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-300 px-2.5 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1">
          ＋ 新增年度
        </button>
      </div>
      <span class="text-sm text-gray-500">共 <strong>${totalCount}</strong> 位在籍成員</span>
      <div class="ml-auto flex gap-2">
        <button onclick="document.getElementById('add-member-modal').classList.remove('hidden')"
          class="bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium">＋ 新增團員</button>
        <button onclick="openAddExisting()"
          class="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">📥 沿用舊資料</button>
        <button onclick="document.getElementById('csv-import-modal').classList.remove('hidden')"
          class="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium">📊 CSV 匯入</button>
      </div>
    </div>

    <div class="flex flex-wrap gap-2 mb-3 items-center">
      ${sectionTabs}
      <form class="ml-auto flex gap-2" method="get" action="/admin/members">
        <input type="hidden" name="year" value="${currentYear}">
        ${section ? `<input type="hidden" name="section" value="${section}">` : ''}
        <input type="search" name="search" value="${search}" placeholder="搜尋姓名..." class="border rounded-lg px-3 py-1.5 text-sm w-32">
        <button type="submit" class="bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded-lg text-sm">🔍</button>
      </form>
    </div>

    ${showInactive ? `
    <!-- 停團/未續成員 -->
    <div class="bg-red-50 border border-red-100 rounded-xl p-4 mb-4">
      <p class="text-sm text-red-700">
        <strong>🛑 停團 / 未續</strong>：以下成員曾經在籍，但本年度（${currentYear} 學年）並無在籍紀錄。
        點「↩ 復團」可立即將其加入本學年度。
      </p>
    </div>
    <div class="bg-white rounded-xl shadow-sm overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-red-50 border-b border-red-100">
          <tr>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">#</th>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">姓名</th>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">性別</th>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">最後組別</th>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">最後進程</th>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">最後小隊</th>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">最後在籍學年</th>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">操作</th>
          </tr>
        </thead>
        <tbody>
          ${(inactiveRes.results as any[]).length === 0
            ? '<tr><td colspan="8" class="py-10 text-center text-gray-400">本年度無停團成員（所有人均在籍）</td></tr>'
            : (inactiveRes.results as any[]).map((m: any, i: number) => `
            <tr class="hover:bg-red-50/50 border-b text-sm">
              <td class="px-3 py-2.5 text-gray-400 text-xs">${i + 1}</td>
              <td class="px-3 py-2.5 font-medium">
                <a href="/admin/members/${m.member_id}" class="text-gray-700 hover:text-green-700 hover:underline">${m.chinese_name}</a>
                ${m.english_name ? '<div class="text-xs text-gray-400">' + m.english_name + '</div>' : ''}
              </td>
              <td class="px-3 py-2.5 text-gray-500">${m.gender || '-'}</td>
              <td class="px-3 py-2.5">
                <span class="px-2 py-0.5 rounded text-xs ${m.last_section === '童軍' ? 'bg-green-100 text-green-700' : m.last_section === '行義童軍' ? 'bg-blue-100 text-blue-700' : m.last_section === '羅浮童軍' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}">${m.last_section || '-'}</span>
              </td>
              <td class="px-3 py-2.5 text-gray-500">${m.last_rank || '-'}</td>
              <td class="px-3 py-2.5 text-gray-500">${m.last_unit || '-'}</td>
              <td class="px-3 py-2.5">
                <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">${m.last_year || '-'} 學年</span>
              </td>
              <td class="px-3 py-2.5">
                <button onclick="rejoinMember('${m.member_id}','${m.chinese_name}')"
                  class="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg transition font-medium">
                  ↩ 復團
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : `
    <div class="bg-white rounded-xl shadow-sm overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">#</th>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">團次</th>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">姓名</th>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">性別</th>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">歷史</th>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">身分證號</th>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">生日</th>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">階段</th>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">進程</th>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">小隊</th>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">職務</th>
            <th class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">操作</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="12" class="py-10 text-center text-gray-400">本年度尚無成員，請點「新增團員」或「沿用舊資料」</td></tr>'}
        </tbody>
      </table>
    </div>
    `}

    <!-- 新增/沿用舊人 Modal -->
    <div id="add-existing-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        <div class="p-5 border-b">
          <h3 class="text-lg font-bold">📥 從舊資料選擇要參加 ${currentYear} 學年的成員</h3>
          <p class="text-sm text-gray-500 mt-1">勾選後點「確認加入」，這些成員將納入本學年度出席管理</p>
          <input type="text" id="existing-search" oninput="filterExisting()" placeholder="搜尋姓名..." class="mt-3 w-full border rounded-lg px-3 py-2 text-sm">
        </div>
        <div id="existing-list" class="flex-1 overflow-y-auto p-4">
          <div class="text-center text-gray-400 py-8">載入中...</div>
        </div>
        <div class="p-4 border-t flex justify-between items-center">
          <span id="existing-selected-count" class="text-sm text-gray-600">已選擇 0 人</span>
          <div class="flex gap-2">
            <button onclick="document.getElementById('add-existing-modal').classList.add('hidden')"
              class="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm">取消</button>
            <button onclick="confirmAddExisting()"
              class="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium">確認加入</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增成員 Modal -->
    <div id="add-member-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div class="p-5 border-b">
          <h3 class="text-lg font-bold">＋ 新增 ${currentYear} 學年團員</h3>
        </div>
        <div class="p-5 space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">中文姓名 *</label>
              <input type="text" id="add-chinese_name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="請輸入姓名">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">英文姓名</label>
              <input type="text" id="add-english_name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="English Name">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">性別</label>
              <select id="add-gender" class="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">未指定</option><option value="男">男</option><option value="女">女</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">身分證號</label>
              <input type="text" id="add-national_id" class="w-full border rounded-lg px-3 py-2 text-sm uppercase" placeholder="A123456789">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">生日</label>
              <input type="date" id="add-dob" class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">組別 *</label>
              <select id="add-section" class="w-full border rounded-lg px-3 py-2 text-sm">
                ${sectionList.map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">小隊</label>
              <select id="add-unit_name" class="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">未指定</option>
                ${unitOptions}
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">職位</label>
              <select id="add-role_name" class="w-full border rounded-lg px-3 py-2 text-sm">
                ${['隊員','小隊長','副小隊長','群長','副群長','器材長','行政長','輔導長'].map(r => `<option value="${r}">${r}</option>`).join('')}
              </select>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">進程</label>
            <select id="add-rank_level" class="w-full border rounded-lg px-3 py-2 text-sm">
              ${ranks.map(r => `<option value="${r}">${r || '未設定'}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="add-member-msg" class="hidden px-5 pb-3 text-sm"></div>
        <div class="p-4 border-t flex gap-2">
          <button onclick="saveNewMember()" class="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium">新增</button>
          <button onclick="document.getElementById('add-member-modal').classList.add('hidden')" class="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm">取消</button>
        </div>
      </div>
    </div>

    <!-- 編輯在籍資料 Modal -->
    <div id="edit-enroll-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div class="p-5 border-b">
          <h3 class="text-lg font-bold">✏️ 編輯在籍資料</h3>
          <p id="edit-enroll-name" class="text-sm text-gray-500 mt-1"></p>
        </div>
        <div class="p-5 space-y-3">
          <input type="hidden" id="edit-enroll-id">
          <input type="hidden" id="edit-enroll-member-id">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">組別</label>
              <select id="edit-section" class="w-full border rounded-lg px-3 py-2 text-sm">
                ${sectionList.map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">小隊</label>
              <select id="edit-unit_name" class="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">未指定</option>
                ${unitOptions}
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">職位</label>
              <select id="edit-role_name" class="w-full border rounded-lg px-3 py-2 text-sm">
                ${['隊員','小隊長','副小隊長','群長','副群長','器材長','行政長','輔導長'].map(r => `<option value="${r}">${r}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">進程</label>
              <select id="edit-rank_level" class="w-full border rounded-lg px-3 py-2 text-sm">
                ${ranks.map(r => `<option value="${r}">${r || '未設定'}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="p-4 border-t flex gap-2">
          <button onclick="saveEditEnroll()" class="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium">更新</button>
          <button onclick="document.getElementById('edit-enroll-modal').classList.add('hidden')" class="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm">取消</button>
        </div>
      </div>
    </div>

    <!-- CSV/Excel 匯入 Modal -->
    <div id="csv-import-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
        <div class="p-5 border-b">
          <h3 class="text-lg font-bold">📊 Excel / CSV 批次匯入</h3>
          <p class="text-sm text-gray-500 mt-1">支援 .xlsx、.xls、.csv 格式，自動對應欄位名稱</p>
          <div class="mt-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-800 space-y-1">
            <p class="font-semibold">📋 支援欄位（自動對應系統格式）：</p>
            <p>• <strong>必填：</strong>姓名（或「中文姓名」）</p>
            <p>• <strong>個人：</strong>英文名（英文姓名）、性別（男/女）、身分證號、生日（支援民國年：091/06/14、91.7.27、950705、西元：2002-01-15）</p>
            <p>• <strong>童軍：</strong>童軍階段（組別）→ 童軍/行義童軍/羅浮童軍、童軍進程（進程）、小隊、職務（職位/職務）</p>
            <p>• <strong>聯絡：</strong>電話、家長姓名、家長電話、團次</p>
          </div>
        </div>
        <div class="p-5 flex-1 overflow-y-auto">
          <!-- 匯入年份選擇 -->
          <div class="mb-4 flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <label class="text-sm font-medium text-amber-800 whitespace-nowrap">📅 匯入至學年度：</label>
            <select id="csv-import-year" class="border rounded-lg px-3 py-1.5 text-sm font-bold text-green-700 bg-white">
              ${['113','114','115','116'].map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y} 學年</option>`).join('')}
            </select>
            <span class="text-xs text-amber-600">請確認年份後再選擇檔案</span>
          </div>
          <div class="mb-4">
            <input type="file" id="csv-file" accept=".csv,.txt,.xlsx,.xls" onchange="parseImportFile()" class="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:border file:rounded-lg file:text-sm file:bg-green-50 file:text-green-700 hover:file:bg-green-100">
          </div>
          <div id="csv-preview" class="hidden">
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm font-medium text-gray-700">預覽（共 <span id="csv-count">0</span> 筆，顯示前 5 筆）</p>
              <div class="text-xs text-gray-500">辨識到欄位：<span id="csv-fields" class="text-green-700 font-medium"></span></div>
            </div>
            <div class="border rounded-lg overflow-x-auto">
              <table class="w-full text-xs">
                <thead class="bg-gray-50"><tr id="csv-header"></tr></thead>
                <tbody id="csv-body"></tbody>
              </table>
            </div>
          </div>
          <div id="csv-msg" class="hidden mt-3 text-sm p-3 rounded-lg"></div>
          <div id="csv-progress" class="hidden mt-3">
            <div class="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>匯入進度</span>
              <span id="csv-progress-text">0 / 0</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div id="csv-progress-bar" class="bg-green-600 h-2 rounded-full transition-all" style="width:0%"></div>
            </div>
          </div>
        </div>
        <div class="p-4 border-t flex justify-between items-center">
          <a href="/static/members_import_template.xlsx" download="成員匯入範例.xlsx" class="text-xs text-green-700 hover:underline font-medium">📊 下載 Excel 範例檔（含說明）</a>
          <div class="flex gap-2">
            <button onclick="document.getElementById('csv-import-modal').classList.add('hidden')" class="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm">取消</button>
            <button onclick="confirmCSVImport()" id="csv-import-btn" class="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50" disabled>📥 開始匯入</button>
          </div>
        </div>
      </div>
    </div>

    <script>
      const CURRENT_YEAR = '${currentYear}';
      let existingMembers = [];
      let existingSelected = new Set();
      let csvData = [];

      function changeYear(y) {
        window.location.href = '/admin/members?year=' + y;
      }

      function addNewYear() {
        // 取得目前選單顯示的年度，計算下一年
        const sel = document.getElementById('year-select');
        const viewingYear = sel ? parseInt(sel.value) : parseInt(CURRENT_YEAR);
        const nextYear = viewingYear + 1;
        if (confirm('確定要新增 ' + nextYear + ' 年度嗎？\\n系統將切換到 ' + nextYear + ' 學年，您可以開始匯入或加入成員。')) {
          fetch('/api/settings', {
            method: 'PUT', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ current_year_label: String(nextYear) })
          }).then(r => {
            if (r.ok) {
              window.location.href = '/admin/members?year=' + nextYear;
            } else {
              alert('新增年度失敗，請稍後再試');
            }
          }).catch(() => alert('網路錯誤，請稍後再試'));
        }
      }

      async function rejoinMember(memberId, name) {
        if (!confirm('確定要將「' + name + '」加入 ' + CURRENT_YEAR + ' 年度？')) return;
        const res = await fetch('/api/enrollments/batch', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ year_label: CURRENT_YEAR, member_ids: [memberId], copy_from_prev: true })
        });
        if (res.ok) {
          alert('已成功復團！');
          location.reload();
        } else {
          alert('復團失敗');
        }
      }

      // ===== 沿用舊資料 =====
      async function openAddExisting() {
        document.getElementById('add-existing-modal').classList.remove('hidden');
        existingSelected = new Set();
        updateExistingCount();
        const res = await fetch('/api/enrollments/available?year=' + CURRENT_YEAR);
        const json = await res.json();
        existingMembers = json.data || [];
        renderExistingList(existingMembers);
      }

      function filterExisting() {
        const q = document.getElementById('existing-search').value.toLowerCase();
        const filtered = existingMembers.filter(m =>
          m.chinese_name.includes(q) || (m.english_name||'').toLowerCase().includes(q)
        );
        renderExistingList(filtered);
      }

      function renderExistingList(list) {
        const container = document.getElementById('existing-list');
        if (!list.length) {
          container.innerHTML = '<div class="text-center text-gray-400 py-8">無可沿用的舊成員（所有人均已在本年度名冊中）</div>';
          return;
        }
        const sectionColor = {童軍:'bg-green-100 text-green-700',行義童軍:'bg-blue-100 text-blue-700',羅浮童軍:'bg-purple-100 text-purple-700',服務員:'bg-gray-100 text-gray-600'};
        container.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 gap-2">' +
          list.map(m => {
            const sel = existingSelected.has(m.id);
            return '<div onclick="toggleExisting(this.dataset.id)" data-id="' + m.id + '" class="p-3 border rounded-lg cursor-pointer flex items-center gap-3 hover:bg-blue-50 transition ' + (sel ? 'bg-blue-50 border-blue-400' : 'bg-white') + '">' +
              '<div class="w-5 h-5 border-2 rounded flex items-center justify-center flex-shrink-0 ' + (sel ? 'bg-blue-600 border-blue-600' : 'border-gray-300') + '">' +
              (sel ? '<span class="text-white text-xs font-bold">✓</span>' : '') + '</div>' +
              '<div class="flex-1 min-w-0">' +
              '<div class="font-medium text-sm">' + m.chinese_name + '</div>' +
              '<div class="text-xs text-gray-500 flex gap-2 flex-wrap mt-0.5">' +
              (m.last_section ? '<span class="' + (sectionColor[m.last_section]||'bg-gray-100 text-gray-600') + ' px-1.5 py-0.5 rounded">' + m.last_section + '</span>' : '') +
              (m.last_unit ? '<span class="text-gray-400">' + m.last_unit + '</span>' : '') +
              (m.last_year ? '<span class="text-gray-300">(' + m.last_year + '學年)</span>' : '') +
              '</div></div></div>';
          }).join('') + '</div>';
      }

      function toggleExisting(id) {
        if (existingSelected.has(id)) existingSelected.delete(id);
        else existingSelected.add(id);
        updateExistingCount();
        renderExistingList(existingMembers.filter(m => {
          const q = document.getElementById('existing-search').value.toLowerCase();
          return m.chinese_name.includes(q) || (m.english_name||'').toLowerCase().includes(q);
        }));
      }

      function updateExistingCount() {
        document.getElementById('existing-selected-count').textContent = '已選擇 ' + existingSelected.size + ' 人';
      }

      async function confirmAddExisting() {
        if (!existingSelected.size) return alert('請先勾選成員');
        const res = await fetch('/api/enrollments/batch', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ year_label: CURRENT_YEAR, member_ids: Array.from(existingSelected), copy_from_prev: true })
        });
        const json = await res.json();
        if (res.ok && json.success) {
          alert('已加入 ' + json.added + ' 位成員！');
          location.reload();
        } else { alert('加入失敗：' + (json.error||'未知錯誤')); }
      }

      // ===== 新增成員 =====
      async function saveNewMember() {
        const data = {
          year_label: CURRENT_YEAR,
          chinese_name: document.getElementById('add-chinese_name').value.trim(),
          english_name: document.getElementById('add-english_name').value.trim(),
          gender: document.getElementById('add-gender').value,
          national_id: document.getElementById('add-national_id').value.trim().toUpperCase(),
          dob: document.getElementById('add-dob').value || null,
          section: document.getElementById('add-section').value,
          unit_name: document.getElementById('add-unit_name').value,
          role_name: document.getElementById('add-role_name').value,
          rank_level: document.getElementById('add-rank_level').value,
        };
        if (!data.chinese_name) { alert('請填寫姓名'); return; }
        const res = await fetch('/api/enrollments', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        const json = await res.json();
        const msg = document.getElementById('add-member-msg');
        if (res.ok && json.success) {
          msg.textContent = '✅ 新增成功！'; msg.className = 'px-5 pb-3 text-sm text-green-600'; msg.classList.remove('hidden');
          setTimeout(() => location.reload(), 800);
        } else {
          msg.textContent = '❌ 失敗：' + (json.error||'未知錯誤'); msg.className = 'px-5 pb-3 text-sm text-red-600'; msg.classList.remove('hidden');
        }
      }

      // ===== 編輯在籍資料 =====
      function openEditEnroll(m) {
        document.getElementById('edit-enroll-id').value = m.enroll_id;
        document.getElementById('edit-enroll-member-id').value = m.member_id;
        document.getElementById('edit-enroll-name').textContent = m.chinese_name + (m.english_name ? ' / ' + m.english_name : '');
        document.getElementById('edit-section').value = m.section || '童軍';
        document.getElementById('edit-unit_name').value = m.unit_name || '';
        document.getElementById('edit-role_name').value = m.role_name || '隊員';
        document.getElementById('edit-rank_level').value = m.rank_level || '';
        document.getElementById('edit-enroll-modal').classList.remove('hidden');
      }

      async function saveEditEnroll() {
        const id = document.getElementById('edit-enroll-id').value;
        const data = {
          section: document.getElementById('edit-section').value,
          unit_name: document.getElementById('edit-unit_name').value,
          role_name: document.getElementById('edit-role_name').value,
          rank_level: document.getElementById('edit-rank_level').value,
        };
        const res = await fetch('/api/enrollments/' + id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        if (res.ok) location.reload(); else alert('更新失敗');
      }

      async function removeEnroll(id, name) {
        if (!confirm('確定要將「' + name + '」從本學年度名冊中移除？（成員資料仍保留）')) return;
        const res = await fetch('/api/enrollments/' + id, { method: 'DELETE' });
        if (res.ok) location.reload(); else alert('移除失敗');
      }

      // ===== CSV / Excel 匯入 =====
      let xlsxLoaded = false;
      async function loadXLSX() {
        if (xlsxLoaded || typeof XLSX !== 'undefined') { xlsxLoaded = true; return; }
        // 優先從本地靜態資源，避免 CDN 依賴
        const cdns = [
          '/static/xlsx.full.min.js',
          'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
          'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'
        ];
        for (const src of cdns) {
          try {
            await new Promise((resolve, reject) => {
              const s = document.createElement('script');
              s.src = src;
              s.onload = () => { xlsxLoaded = true; resolve(); };
              s.onerror = reject;
              document.head.appendChild(s);
            });
            if (typeof XLSX !== 'undefined') return; // 載入成功
          } catch(e) { /* 嘗試下一個來源 */ }
        }
        throw new Error('無法載入 Excel 解析套件，請確認網路連線後重試');
      }

      // 民國年日期轉換 → 西元 YYYY-MM-DD
      function convertROCDate(raw) {
        if (!raw) return null;
        const s = String(raw).trim();
        if (!s || s === 'None') return null;

        // 已是西元格式 2002-01-15 或 2002/01/15
        if (/^20\d{2}[-/]\d{1,2}[-/]\d{1,2}$/.test(s)) {
          return s.replace(/\//g, '-').replace(/(\d{4})-(\d{1,2})-(\d{1,2})/, (_, y, m, d) =>
            y + '-' + m.padStart(2,'0') + '-' + d.padStart(2,'0'));
        }

        // 民國年 091/06/14 或 91/06/14
        const slashMatch = s.match(/^(\d{2,3})[\/](\d{1,2})[\/](\d{1,2})$/);
        if (slashMatch) {
          const roc = parseInt(slashMatch[1]);
          const ad = roc + 1911;
          return ad + '-' + slashMatch[2].padStart(2,'0') + '-' + slashMatch[3].padStart(2,'0');
        }

        // 民國年 91.7.27 or 91.07.27
        const dotMatch = s.match(/^(\d{2,3})\.(\d{1,2})\.(\d{1,2})$/);
        if (dotMatch) {
          const roc = parseInt(dotMatch[1]);
          const ad = roc + 1911;
          return ad + '-' + dotMatch[2].padStart(2,'0') + '-' + dotMatch[3].padStart(2,'0');
        }

        // 民國年純數字 950705 (6位) 或 9570518 (7位)
        if (/^\d{6,7}$/.test(s)) {
          const num = parseInt(s);
          if (s.length === 6) {
            // YYMMDD - 民國兩位年
            const yy = parseInt(s.slice(0,2));
            const mm = s.slice(2,4);
            const dd = s.slice(4,6);
            const ad = yy + 1911;
            return ad + '-' + mm + '-' + dd;
          } else {
            // YYYMMDD - 民國三位年
            const yyy = parseInt(s.slice(0,3));
            const mm = s.slice(3,5);
            const dd = s.slice(5,7);
            const ad = yyy + 1911;
            return ad + '-' + mm + '-' + dd;
          }
        }

        // Excel serial date (數字)
        if (/^\d{5}$/.test(s)) {
          const d = new Date((parseInt(s) - 25569) * 86400 * 1000);
          return d.toISOString().split('T')[0];
        }

        // 嘗試直接解析
        const parsed = new Date(s);
        if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
          return parsed.toISOString().split('T')[0];
        }

        return null;
      }

      // 從欄位名稱取值（支援多種欄位名）
      function getField(row, keys, fallback = '') {
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
            return String(row[k]).trim();
          }
        }
        return fallback;
      }

      // 欄位說明顯示
      function renderImportPreview(headers, data) {
        document.getElementById('csv-count').textContent = data.length;
        // 偵測到的有效欄位
        const knownFieldMap = {
          '姓名': '姓名✓', '英文名': '英文名✓', '英文姓名': '英文姓名✓',
          '身分證號': '身分證✓', '生日': '生日✓', '性別': '性別✓',
          '童軍階段': '階段✓', '組別': '組別✓', '童軍進程': '進程✓', '進程': '進程✓',
          '小隊': '小隊✓', '職務': '職務✓', '職位': '職位✓',
          '電話': '電話✓', '家長姓名': '家長✓', '團次': '團次✓'
        };
        const detected = headers.filter(h => knownFieldMap[h]).map(h => knownFieldMap[h]);
        document.getElementById('csv-fields').textContent = detected.length ? detected.join('、') : '（請確認欄位名稱）';

        document.getElementById('csv-header').innerHTML = headers.map(h =>
          '<th class="px-2 py-1 text-left font-medium ' + (knownFieldMap[h] ? 'text-green-700' : 'text-gray-400') + '">' + h + '</th>'
        ).join('');
        document.getElementById('csv-body').innerHTML = data.slice(0, 5).map(row =>
          '<tr class="border-t">' + headers.map(h => '<td class="px-2 py-1 whitespace-nowrap">' + (row[h]||'-') + '</td>').join('') + '</tr>'
        ).join('');
        document.getElementById('csv-preview').classList.remove('hidden');
        document.getElementById('csv-import-btn').disabled = false;
      }

      async function parseImportFile() {
        const file = document.getElementById('csv-file').files[0];
        if (!file) return;
        csvData = [];
        document.getElementById('csv-preview').classList.add('hidden');
        document.getElementById('csv-import-btn').disabled = true;

        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'xlsx' || ext === 'xls') {
          try {
            await loadXLSX();
          } catch(e) {
            alert('\u274c 無法載入 Excel 解析套件：' + e.message + '，請改用 .csv 格式或確認網路連線。');
            return;
          }
          // 用 FileReader (base64) 讀取，相容性優於 arrayBuffer
          const raw = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              try {
                const data = e.target.result;
                const wb = XLSX.read(data, { type: 'binary', cellDates: false, raw: false });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
                resolve(rows);
              } catch(err) { reject(err); }
            };
            reader.onerror = reject;
            reader.readAsBinaryString(file);
          }).catch(err => {
            alert('❌ Excel 解析失敗：' + err.message);
            return null;
          });

          if (!raw || raw.length < 2) {
            if (raw) alert('⚠️ Excel 內容為空或格式不符');
            return;
          }
          // 找到標題行：某欄位【完全等於】已知欄位名稱（避免說明文字誤判）
          const KNOWN_HEADERS = new Set(['姓名','中文姓名','英文名','英文姓名','身分證號','生日','性別','童軍階段','童軍進程','電話','小隊','職務','團次','Name','Chinese Name']);
          let headerIdx = 0;
          for (let i = 0; i < Math.min(6, raw.length); i++) {
            if (raw[i].some(c => KNOWN_HEADERS.has(String(c).trim()))) {
              headerIdx = i; break;
            }
          }
          const headers = raw[headerIdx].map(h => String(h).trim());
          csvData = raw.slice(headerIdx + 1)
            .filter(row => row.some(c => c !== '' && c !== null && c !== undefined))
            .filter(row => {
              const nameIdx = headers.findIndex(h => h === '姓名' || h === '中文姓名');
              if (nameIdx < 0) return true;
              return row[nameIdx] && String(row[nameIdx]).trim();
            })
            .map(row => {
              const obj = {};
              headers.forEach((h, i) => { obj[h] = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : ''; });
              return obj;
            });
          if (csvData.length === 0) {
            alert('\u26a0\ufe0f 找不到有效資料列，請確認 Excel 格式：第2列必須是欄位標頭，第3列起為資料。');
            return;
          }
          renderImportPreview(headers, csvData);
        } else {
          const reader = new FileReader();
          reader.onload = (e) => {
            let text = e.target.result;
            // 移除 BOM
            if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
            const NL=String.fromCharCode(10); const CR=String.fromCharCode(13); const lines = text.trim().replace(new RegExp(CR+NL,'g'),NL).replace(new RegExp(CR,'g'),NL).split(NL).map(l => {
              // 簡單 CSV 解析（支援引號）
              const cells = [];
              let cur = '', inQ = false;
              for (let i = 0; i < l.length; i++) {
                if (l[i] === '"') { inQ = !inQ; }
                else if (l[i] === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
                else { cur += l[i]; }
              }
              cells.push(cur.trim());
              return cells;
            });
            if (lines.length < 2) { alert('CSV 內容為空'); return; }
            const headers = lines[0].map(h => h.replace(/^"|"$/g,'').trim());
            csvData = lines.slice(1).filter(l => l.some(c => c)).map(row => {
              const obj = {};
              headers.forEach((h, i) => { obj[h] = (row[i] || '').replace(/^"|"$/g,'').trim(); });
              return obj;
            });
            renderImportPreview(headers, csvData);
          };
          reader.readAsText(file, 'UTF-8');
        }
      }

      // 下載 Excel 範例（指向靜態檔案）
      function downloadTemplate() {
        const link = document.createElement('a');
        link.href = '/static/members_import_template.xlsx';
        link.download = '成員匯入範例.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      async function confirmCSVImport() {
        if (!csvData.length) return;
        // 取得使用者選擇的匯入年份
        const importYear = document.getElementById('csv-import-year').value || CURRENT_YEAR;
        const btn = document.getElementById('csv-import-btn');
        btn.disabled = true; btn.textContent = '匯入中 (' + importYear + '學年)...';
        const msg = document.getElementById('csv-msg');
        const progressEl = document.getElementById('csv-progress');
        const progressBar = document.getElementById('csv-progress-bar');
        const progressText = document.getElementById('csv-progress-text');
        progressEl.classList.remove('hidden');
        msg.classList.add('hidden');

        let success = 0, updated = 0, fail = 0, skip = 0;
        const errors = [];

        for (let i = 0; i < csvData.length; i++) {
          const row = csvData[i];
          // 更新進度條
          const pct = Math.round((i / csvData.length) * 100);
          progressBar.style.width = pct + '%';
          progressText.textContent = (i+1) + ' / ' + csvData.length;

          // 取得姓名（支援多種欄位名）
          const name = getField(row, ['姓名', '中文姓名', 'chinese_name', 'Name'], '');
          if (!name) { skip++; continue; }

          // 取得日期（支援民國年各種格式）
          const rawDob = getField(row, ['生日', 'dob', 'birthday', 'DOB'], '');
          const dob = convertROCDate(rawDob) || null;

          // 取得組別（童軍階段 → section）
          const sectionRaw = getField(row, ['童軍階段', '組別', 'section', '階段'], '童軍');
          // 標準化 section 名稱
          const sectionMap = {'童軍':'童軍','行義童軍':'行義童軍','羅浮童軍':'羅浮童軍','服務員':'服務員',
            'junior':'童軍','senior':'行義童軍','rover':'羅浮童軍',
            '行義':'行義童軍','羅浮':'羅浮童軍'};
          const section = sectionMap[sectionRaw] || sectionRaw || '童軍';

          // 職務欄位（職務/職位）
          const roleRaw = getField(row, ['職務', '職位', 'role_name', 'role'], '隊員');
          const roleName = roleRaw || '隊員';

          // 團次（若已含「團」字則不再重複加）
          const troopRaw = getField(row, ['團次', 'troop'], '54');
          let troop = '54團';
          if (troopRaw) {
            troop = /團$/.test(String(troopRaw)) ? String(troopRaw) : String(troopRaw) + '團';
          }

          const body = {
            year_label: importYear,
            chinese_name: name,
            english_name: getField(row, ['英文名', '英文姓名', 'english_name', 'English Name'], ''),
            gender: getField(row, ['性別', 'gender'], ''),
            national_id: getField(row, ['身分證號', '身份證號', 'national_id', 'ID'], '').toUpperCase(),
            dob: dob,
            section: section,
            unit_name: getField(row, ['小隊', 'unit_name', 'unit'], ''),
            role_name: roleName,
            rank_level: getField(row, ['童軍進程', '進程', 'rank_level', 'rank'], ''),
            phone: getField(row, ['電話', 'phone', '手機'], ''),
            parent_name: getField(row, ['家長姓名', '家長', 'parent_name'], ''),
            troop: troop,
          };

          try {
            const res = await fetch('/api/enrollments', {
              method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
            });
            const json = await res.json();
            if (res.ok && json.success) {
              success++;
            } else if (res.status === 409 || (json.error && json.error.includes('已有'))) {
              // 已有此成員，算作更新
              updated++;
            } else {
              fail++;
              errors.push(name + ': ' + (json.error || '未知錯誤'));
            }
          } catch(e) { fail++; errors.push(name + ': 網路錯誤'); }
        }

        progressBar.style.width = '100%';
        progressText.textContent = csvData.length + ' / ' + csvData.length;

        let msgText = '✅ 匯入完成！（' + importYear + ' 學年）';
        if (success) msgText += ' 新增 ' + success + ' 人';
        if (updated) msgText += '、沿用/更新 ' + updated + ' 人';
        if (skip) msgText += '、跳過 ' + skip + ' 筆（無姓名）';
        if (fail) {
          msgText += '、失敗 ' + fail + ' 筆';
          if (errors.length) msgText += ' 錯誤：' + errors.slice(0,3).join('；');
        }
        msg.textContent = msgText;
        msg.className = 'mt-3 text-sm p-3 rounded-lg whitespace-pre-line ' + (fail ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700');
        msg.classList.remove('hidden');
        btn.textContent = '✅ 匯入完成';

        if (success > 0 || updated > 0) {
          // 跳轉到匯入年度的成員頁面
          setTimeout(() => { window.location.href = '/admin/members?year=' + importYear; }, 2000);
        }
      }
    </script>
  `))
})

// ===================== 出席管理 =====================
adminRoutes.get('/attendance', authMiddleware, async (c) => {
  const db = c.env.DB
  const section = c.req.query('section') || ''

  // 取得目前年度
  const yearSetting = await db.prepare(`SELECT value FROM site_settings WHERE key='current_year_label'`).first() as any
  const currentYear = yearSetting?.value || '114'

  // 統計今年在籍人數
  const enrollCountRes = await db.prepare(`SELECT COUNT(*) as c FROM member_enrollments WHERE year_label=? AND is_active=1`).bind(currentYear).first() as any
  const enrollCount = enrollCountRes?.c || 0

  let query = `
    SELECT ats.*,
      COUNT(ar.id) as total_count,
      SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count
    FROM attendance_sessions ats
    LEFT JOIN attendance_records ar ON ar.session_id = ats.id
    WHERE 1=1
  `
  const params: any[] = []
  if (section) { query += ` AND ats.section = ?`; params.push(section) }
  query += ` GROUP BY ats.id ORDER BY ats.date DESC`
  const sessions = await db.prepare(query).bind(...params).all()

  const rows = sessions.results.map((s: any) => {
    const rate = s.total_count > 0 ? Math.round(s.present_count / s.total_count * 100) : 0
    const sectionLabel: Record<string,string> = {junior:'童軍',senior:'行義童軍',rover:'羅浮童軍',all:'全體'}
    return `
      <tr class="hover:bg-gray-50 border-b">
        <td class="px-4 py-3">
          <div class="font-medium text-gray-800">${s.title}</div>
          ${s.topic ? `<div class="text-xs text-gray-400">主題：${s.topic}</div>` : ''}
        </td>
        <td class="px-4 py-3 text-sm text-gray-600">${s.date}</td>
        <td class="px-4 py-3 text-sm text-gray-600">${sectionLabel[s.section] || s.section}</td>
        <td class="px-4 py-3 text-sm">
          <span class="font-medium text-green-700">${s.present_count}</span>
          <span class="text-gray-400">/${s.total_count}</span>
          <span class="ml-1 text-xs ${rate >= 80 ? 'text-green-600' : rate >= 60 ? 'text-yellow-600' : 'text-red-500'}">(${rate}%)</span>
        </td>
        <td class="px-4 py-3">
          <a href="/admin/attendance/${s.id}" class="text-blue-600 hover:text-blue-800 text-xs mr-3">📋 點名</a>
          <button onclick="deleteSession('${s.id}')" class="text-red-500 hover:text-red-700 text-xs">🗑</button>
        </td>
      </tr>
    `
  }).join('')

  const sectionTabs = [['','全部'],['junior','童軍'],['senior','行義童軍'],['rover','羅浮童軍'],['all','全體活動']].map(([v,l]) => `
    <a href="/admin/attendance${v ? '?section='+v : ''}" class="px-4 py-2 rounded-full text-sm font-medium transition ${section === v ? 'bg-green-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}">${l}</a>
  `).join('')

  return c.html(adminLayout('出席管理', `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-500">管理各組別社課與活動出席記錄</p>
      <button onclick="document.getElementById('add-session-modal').classList.remove('hidden')"
        class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">＋ 新增場次</button>
    </div>

    <!-- 年度在籍提示 -->
    <div class="mb-4 p-4 rounded-xl border ${enrollCount > 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}">
      <div class="flex items-center gap-3">
        <span class="text-lg">${enrollCount > 0 ? '✅' : '⚠️'}</span>
        <div>
          <p class="text-sm font-medium ${enrollCount > 0 ? 'text-green-800' : 'text-amber-800'}">
            ${currentYear} 學年在籍成員：<strong>${enrollCount}</strong> 人
          </p>
          <p class="text-xs ${enrollCount > 0 ? 'text-green-600' : 'text-amber-600'} mt-0.5">
            ${enrollCount > 0
              ? '新增場次時，系統將自動帶入這些成員。如需更改名單，請前往「成員名冊」管理。'
              : '⚠️ 本學年尚未設定在籍成員！新增場次將使用舊的 members 清單作為備用。請先前往「成員名冊」設定本年度參加人員。'
            }
          </p>
        </div>
        ${enrollCount === 0 ? '<a href="/admin/members" class="ml-auto text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 whitespace-nowrap">→ 設定成員名冊</a>' : ''}
      </div>
    </div>

    <div class="flex flex-wrap gap-2 mb-4">${sectionTabs}</div>

    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">場次名稱</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">日期</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">組別</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">出席率</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">操作</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="5" class="py-8 text-center text-gray-400">尚無出席記錄</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- 新增場次 Modal -->
    <div id="add-session-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-auto flex flex-col" style="max-height:90vh">
        <div class="p-6 pb-3 flex-shrink-0">
          <h3 class="text-lg font-bold mb-4">新增出席場次</h3>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">場次名稱 *</label>
              <input type="text" id="add-ses-title" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例：第一次社課">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">日期 *</label>
                <input type="date" id="add-ses-date" class="w-full border rounded-lg px-3 py-2 text-sm">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">學年度 *</label>
                <select id="add-ses-year" onchange="loadSessionMembers()" class="w-full border rounded-lg px-3 py-2 text-sm font-medium text-green-700 bg-green-50">
                  ${['113','114','115','116'].map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y} 學年</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">組別</label>
                <select id="add-ses-section" onchange="loadSessionMembers()" class="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="junior">童軍</option>
                  <option value="senior">行義童軍</option>
                  <option value="rover">羅浮童軍</option>
                  <option value="all">全體</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">場次編號</label>
                <input type="number" id="add-ses-number" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="1">
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">課程主題</label>
              <input type="text" id="add-ses-topic" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例：繩結技術">
            </div>
          </div>
        </div>

        <!-- 成員勾選區（可捲動） -->
        <div class="px-6 flex-1 overflow-y-auto min-h-0">
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-gray-700">📋 選擇參加成員</label>
            <div class="flex gap-2">
              <button type="button" onclick="toggleAllSessionMembers(true)" class="text-xs text-blue-600 hover:underline">全選</button>
              <span class="text-gray-300">|</span>
              <button type="button" onclick="toggleAllSessionMembers(false)" class="text-xs text-gray-500 hover:underline">全不選</button>
            </div>
          </div>
          <div id="session-member-list" class="border rounded-lg bg-gray-50 p-3 min-h-16">
            <p class="text-xs text-gray-400 text-center py-4">載入中...</p>
          </div>
          <p id="session-member-count" class="text-xs text-gray-500 mt-1.5 text-right"></p>
        </div>

        <div class="p-6 pt-4 flex-shrink-0 flex gap-3 border-t">
          <button onclick="saveSession()" class="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium">＋ 新增場次</button>
          <button onclick="document.getElementById('add-session-modal').classList.add('hidden')" class="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm">取消</button>
        </div>
      </div>
    </div>

    <script>
      let sessionMembersAll = []; // 全部成員（含 id, name, unit）

      async function loadSessionMembers() {
        const year = document.getElementById('add-ses-year').value;
        const section = document.getElementById('add-ses-section').value;
        const listEl = document.getElementById('session-member-list');
        const countEl = document.getElementById('session-member-count');
        listEl.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">載入中...</p>';
        countEl.textContent = '';

        const sectionMap = {junior:'\u7ae5\u8ecd',senior:'\u884c\u7fa9\u7ae5\u8ecd',rover:'\u7f85\u6d6e\u7ae5\u8ecd',all:''};
        const sectionCN = sectionMap[section] || '';
        const url = '/api/enrollments?year=' + year + (sectionCN ? '&section=' + encodeURIComponent(sectionCN) : '');

        try {
          const res = await fetch(url);
          const json = await res.json();
          sessionMembersAll = json.data || [];
        } catch(e) {
          listEl.innerHTML = '<p class="text-xs text-red-500 text-center py-4">\u8f09\u5165\u5931\u6557</p>';
          return;
        }

        if (!sessionMembersAll.length) {
          listEl.innerHTML = '<p class="text-xs text-amber-600 text-center py-4">\u26a0\ufe0f \u6b64\u5b78\u5e74\u5ea6\u6b64\u7d44\u5225\u5c1a\u7121\u5728\u7c4d\u6210\u54e1\uff0c\u8acb\u5148\u524d\u5f80\u300c\u6210\u54e1\u540d\u518a\u300d\u8a2d\u5b9a\u3002</p>';
          countEl.textContent = '\u5171 0 \u4eba';
          return;
        }

        // 依小隊分組
        const byUnit = {};
        sessionMembersAll.forEach(m => {
          const u = m.unit_name || '\u672a\u5206\u5c0f\u968a';
          if (!byUnit[u]) byUnit[u] = [];
          byUnit[u].push(m);
        });

        let html = '';
        Object.keys(byUnit).sort().forEach(unit => {
          html += '<div class="mb-2"><div class="text-xs font-semibold text-gray-500 mb-1">' + unit + '</div><div class="flex flex-wrap gap-1">';
          byUnit[unit].forEach(m => {
            html += '<label class="flex items-center gap-1 cursor-pointer bg-white border rounded-lg px-2 py-1 text-xs hover:bg-blue-50 has-[:checked]:bg-blue-100 has-[:checked]:border-blue-400">'
              + '<input type="checkbox" class="session-member-cb" value="' + m.member_id + '" checked>'
              + '<span>' + m.chinese_name + '</span>'
              + '</label>';
          });
          html += '</div></div>';
        });
        listEl.innerHTML = html;
        updateSessionMemberCount();

        // 更新計數
        listEl.querySelectorAll('.session-member-cb').forEach(cb => {
          cb.addEventListener('change', updateSessionMemberCount);
        });
      }

      function updateSessionMemberCount() {
        const total = document.querySelectorAll('.session-member-cb').length;
        const checked = document.querySelectorAll('.session-member-cb:checked').length;
        document.getElementById('session-member-count').textContent = '\u5df2\u9078 ' + checked + ' / ' + total + ' \u4eba';
      }

      function toggleAllSessionMembers(checked) {
        document.querySelectorAll('.session-member-cb').forEach(cb => { cb.checked = checked; });
        updateSessionMemberCount();
      }

      async function saveSession() {
        const title = document.getElementById('add-ses-title').value.trim();
        const date = document.getElementById('add-ses-date').value;
        if (!title || !date) { alert('\u5834\u6b21\u540d\u7a31\u548c\u65e5\u671f\u70ba\u5fc5\u586b'); return; }

        const checkedIds = Array.from(document.querySelectorAll('.session-member-cb:checked')).map(cb => cb.value);
        const year = document.getElementById('add-ses-year').value;

        const data = {
          title,
          date,
          section: document.getElementById('add-ses-section').value,
          topic: document.getElementById('add-ses-topic').value.trim(),
          session_number: parseInt(document.getElementById('add-ses-number').value) || null,
          year_label: year,
          member_ids: checkedIds,
        };

        if (checkedIds.length === 0) {
          if (!confirm('\u76ee\u524d\u672a\u52fe\u9078\u4efb\u4f55\u6210\u54e1\uff0c\u78ba\u5b9a\u8981\u5efa\u7acb\u7a7a\u767d\u5834\u6b21\uff1f')) return;
        }

        const btn = event.target;
        btn.disabled = true;
        btn.textContent = '\u5efa\u7acb\u4e2d...';

        try {
          const res = await fetch('/api/attendance/sessions', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
          const json = await res.json();
          if (res.ok) { window.location.href = '/admin/attendance/' + json.id; }
          else { alert('\u65b0\u589e\u5931\u6557\uff1a' + (json.error || '')); btn.disabled = false; btn.textContent = '\uff0b \u65b0\u589e\u5834\u6b21'; }
        } catch(e) {
          alert('\u7db2\u8def\u932f\u8aa4\uff0c\u8acb\u91cd\u8a66');
          btn.disabled = false; btn.textContent = '\uff0b \u65b0\u589e\u5834\u6b21';
        }
      }

      async function deleteSession(id) {
        if (!confirm('\u78ba\u5b9a\u8981\u522a\u9664\u6b64\u5834\u6b21\u53ca\u6240\u6709\u51fa\u5e2d\u8a18\u9304\u55ce\uff1f')) return;
        const res = await fetch('/api/attendance/sessions/' + id, { method:'DELETE' });
        if (res.ok) location.reload(); else alert('\u522a\u9664\u5931\u6557');
      }

      // 開啟 modal 時自動載入成員
      document.getElementById('add-session-modal').addEventListener('click', function(e) {
        if (e.target === this) this.classList.add('hidden');
      });

      // 初始化：頁面載入後不自動 fetch，等開啟 modal 時才載入
      (function patchOpenModal() {
        const origOpen = document.querySelector('[onclick*="add-session-modal"].classList.remove');
        // 用 MutationObserver 偵測 modal 顯示
        const modal = document.getElementById('add-session-modal');
        const obs = new MutationObserver(function(muts) {
          muts.forEach(function(m) {
            if (m.attributeName === 'class' && !modal.classList.contains('hidden')) {
              if (document.querySelectorAll('.session-member-cb').length === 0) loadSessionMembers();
            }
          });
        });
        obs.observe(modal, { attributes: true });
      })();
    </script>
  `))
})

// 出席點名頁面
adminRoutes.get('/attendance/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const sessionId = c.req.param('id')
  const session = await db.prepare(`SELECT * FROM attendance_sessions WHERE id=?`).bind(sessionId).first() as any
  if (!session) return c.redirect('/admin/attendance')

  // 取得目前年度（用於從 member_enrollments 讀取最新小隊/職位）
  const yearSetting = await db.prepare(`SELECT value FROM site_settings WHERE key='current_year_label'`).first() as any
  const currentYear = yearSetting?.value || '114'

  // 優先從 member_enrollments 取得小隊和角色（年度在籍資料）
  const records = await db.prepare(`
    SELECT ar.*, m.chinese_name, m.english_name,
      COALESCE(me.section, m.section) as section,
      COALESCE(me.unit_name, m.unit_name) as unit_name,
      COALESCE(me.role_name, m.role_name) as role_name,
      COALESCE(me.rank_level, m.rank_level) as rank_level
    FROM attendance_records ar
    JOIN members m ON m.id = ar.member_id
    LEFT JOIN member_enrollments me ON me.member_id = m.id AND me.year_label = ? AND me.is_active = 1
    WHERE ar.session_id = ?
    ORDER BY COALESCE(me.unit_name, m.unit_name), m.chinese_name
  `).bind(currentYear, sessionId).all()

  // 取得榮譽小隊記錄
  const honorPatrols = await db.prepare(`
    SELECT * FROM honor_patrol_records WHERE session_id=? ORDER BY created_at DESC
  `).bind(sessionId).all()

  // 取得固定小隊清單（from scout_units）
  const unitsRes = await db.prepare(`
    SELECT unit_name FROM scout_units WHERE is_active=1 ORDER BY unit_order, unit_name
  `).all()
  const scoutUnitList = (unitsRes.results as any[]).map((u: any) => u.unit_name)
  const unitOptions = scoutUnitList.map((n: string) => `<option value="${n}">${n}</option>`).join('')

  const sectionLabel: Record<string,string> = {junior:'童軍',senior:'行義童軍',rover:'羅浮童軍',all:'全體'}
  const statusLabel: Record<string,string> = {present:'出席',absent:'缺席',leave:'公假',late:'遲到'}
  const isSubmitted = session.submitted === 1

  // 按小隊分組
  const grouped: Record<string, any[]> = {}
  for (const r of records.results as any[]) {
    const group = r.unit_name || '（未指定小隊）'
    if (!grouped[group]) grouped[group] = []
    grouped[group].push(r)
  }

  const makeRow = (r: any) => `
    <tr class="hover:bg-gray-50 border-b" id="row-${r.member_id}">
      <td class="px-4 py-2.5">
        <div class="font-medium text-sm">${r.chinese_name}</div>
        ${r.english_name ? '<div class="text-xs text-gray-400">' + r.english_name + '</div>' : ''}
      </td>
      <td class="px-4 py-2.5 text-xs text-gray-500">${r.role_name || '-'}</td>
      <td class="px-4 py-2.5">
        ${isSubmitted
          ? '<span class="px-2 py-1 rounded text-xs font-medium ' + (r.status === 'present' ? 'bg-green-100 text-green-700' : r.status === 'absent' ? 'bg-red-100 text-red-700' : r.status === 'leave' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700') + '">' + (statusLabel[r.status] || r.status) + '</span>'
          : '<select data-session="' + sessionId + '" data-member="' + r.member_id + '" data-unit="' + (r.unit_name||'') + '" onchange="updateRecord(this)" class="border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"><option value="present" ' + (r.status === 'present' ? 'selected' : '') + '>出席</option><option value="absent" ' + (r.status === 'absent' ? 'selected' : '') + '>缺席</option><option value="leave" ' + (r.status === 'leave' ? 'selected' : '') + '>公假</option><option value="late" ' + (r.status === 'late' ? 'selected' : '') + '>遲到</option></select>'
        }
      </td>
    </tr>
  `

  // 組建按小隊分組的表格
  const groupedRows = Object.entries(grouped).map(([unitName, members]) => {
    const presentInUnit = members.filter(r => r.status === 'present').length
    return `
      <div class="mb-4">
        <div class="flex items-center justify-between bg-gray-50 px-4 py-2 border-b border-t">
          <span class="text-sm font-semibold text-gray-700">🏕️ ${unitName} <span class="text-xs font-normal text-gray-400 ml-1">${presentInUnit}/${members.length}</span></span>
          ${!isSubmitted ? `<button onclick="markUnit('${unitName.replace(/'/g,"\\'")}','present')" class="text-xs text-green-700 hover:text-green-900 bg-green-50 hover:bg-green-100 px-2 py-0.5 rounded border border-green-200">全員出席</button>` : ''}
        </div>
        <table class="w-full">
          <tbody>${members.map(makeRow).join('')}</tbody>
        </table>
      </div>
    `
  }).join('')

  const presentCount = records.results.filter((r: any) => r.status === 'present').length
  const total = records.results.length

  const honorRows = (honorPatrols.results as any[]).map((h: any) => `
    <div class="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
      <div>
        <span class="font-bold text-amber-800">🏆 ${h.patrol_name}</span>
        ${h.reason ? '<span class="ml-2 text-sm text-gray-500">' + h.reason + '</span>' : ''}
        ${h.year_label ? '<span class="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">' + h.year_label + '學年</span>' : ''}
      </div>
      <div class="flex items-center gap-2">
        ${h.announced ? '<span class="text-xs text-green-600 font-medium">✅ 已公告</span>' : '<button onclick="announceHonor(\'' + h.id + '\')" class="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">📢 公告到榮譽榜</button>'}
        <button onclick="deleteHonor('${h.id}')" class="text-xs text-red-400 hover:text-red-600 ml-1">🗑</button>
      </div>
    </div>
  `).join('')

  return c.html(adminLayout('出席點名', `
    <div class="mb-4">
      <a href="/admin/attendance" class="text-sm text-gray-500 hover:text-gray-700">← 返回出席管理</a>
    </div>
    <div class="bg-white rounded-xl shadow-sm p-5 mb-4">
      <div class="flex items-start justify-between">
        <div>
          <h2 class="text-xl font-bold text-gray-800">${session.title}</h2>
          <p class="text-sm text-gray-500 mt-1">
            ${session.date} ｜ ${sectionLabel[session.section] || session.section}
            ${session.topic ? ' ｜ 主題：' + session.topic : ''}
          </p>
          ${isSubmitted ? '<span class="inline-block mt-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">✅ 已送出（點名完成）</span>' : '<span class="inline-block mt-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">⏳ 點名中</span>'}
        </div>
        <div class="text-right">
          <div class="text-2xl font-bold text-green-700">${presentCount}</div>
          <div class="text-sm text-gray-500">/ ${total} 出席</div>
        </div>
      </div>
    </div>

    ${!isSubmitted ? `
    <div class="flex flex-wrap gap-2 mb-4">
      <button onclick="markAll('present')" class="bg-green-100 text-green-700 hover:bg-green-200 px-4 py-2 rounded-lg text-sm font-medium">✅ 全部出席</button>
      <button onclick="markAll('absent')" class="bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 rounded-lg text-sm font-medium">❌ 全部缺席</button>
      <button onclick="submitAttendance()" class="ml-auto bg-green-700 text-white hover:bg-green-600 px-5 py-2 rounded-lg text-sm font-bold shadow">📋 確認送出點名</button>
    </div>
    ` : `
    <div class="flex gap-2 mb-4">
      <span class="text-sm text-gray-400">點名已完成。如需修改請聯繫管理員。</span>
    </div>
    `}

    <div class="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
      <div class="bg-gray-50 px-4 py-2 border-b">
        <div class="grid grid-cols-3 text-xs font-semibold text-gray-500">
          <span>姓名</span>
          <span>職位</span>
          <span>狀態</span>
        </div>
      </div>
      ${groupedRows || '<div class="py-8 text-center text-gray-400">尚無成員記錄<br><small>請先在「成員名冊」設定本學年在籍成員</small></div>'}
    </div>

    <!-- 榮譽小隊區塊 -->
    <div class="bg-white rounded-xl shadow-sm p-5 mb-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-base font-bold text-gray-800">🏆 本次榮譽小隊</h3>
        <button onclick="document.getElementById('add-honor-modal').classList.remove('hidden')"
          class="bg-amber-500 hover:bg-amber-400 text-white px-4 py-1.5 rounded-lg text-sm font-medium">＋ 記錄榮譽小隊</button>
      </div>
      <div id="honor-list" class="space-y-2">
        ${honorRows || '<p class="text-sm text-gray-400 text-center py-4">本次尚未記錄榮譽小隊</p>'}
      </div>
    </div>

    <!-- 新增榮譽小隊 Modal -->
    <div id="add-honor-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 class="text-lg font-bold mb-4">🏆 記錄榮譽小隊</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">小隊名稱 *</label>
            <select id="honor-patrol-name" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">請選擇小隊</option>
              ${unitOptions}
            </select>
            <input type="text" id="honor-patrol-custom" class="w-full border rounded-lg px-3 py-2 text-sm mt-1 hidden" placeholder="或手動輸入小隊名稱">
            <button onclick="toggleCustomPatrol()" class="text-xs text-blue-600 mt-1">手動輸入小隊名稱</button>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">得獎理由</label>
            <input type="text" id="honor-reason" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例：全員出席、表現優異">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">學年度標籤</label>
            <input type="text" id="honor-year" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例：114" value="${currentYear}">
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" id="honor-announce" class="rounded">
            <label for="honor-announce" class="text-sm text-gray-700">同時公告到榮譽榜（為小隊成員新增成就記錄）</label>
          </div>
        </div>
        <div id="honor-msg" class="hidden mt-2 text-sm"></div>
        <div class="flex gap-3 mt-4">
          <button onclick="saveHonorPatrol()" class="bg-amber-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-amber-400">新增榮譽小隊</button>
          <button onclick="document.getElementById('add-honor-modal').classList.add('hidden')" class="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm">取消</button>
        </div>
      </div>
    </div>

    <script>
      const SESSION_ID = '${sessionId}';
      const IS_SUBMITTED = ${isSubmitted ? 'true' : 'false'};

      async function updateRecord(sel) {
        if (IS_SUBMITTED) return;
        const sId = sel.dataset.session;
        const mId = sel.dataset.member;
        const status = sel.value;
        await fetch('/api/attendance/records/' + sId + '/' + mId, {
          method: 'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({status})
        });
        updateCounter();
      }

      function updateCounter() {
        const selects = document.querySelectorAll('select[data-member]');
        let cnt = 0;
        selects.forEach(s => { if (s.value === 'present') cnt++; });
        const el = document.querySelector('.text-2xl.font-bold.text-green-700');
        if (el) el.textContent = cnt;
      }

      // 針對某小隊批次設定狀態
      async function markUnit(unitName, status) {
        if (IS_SUBMITTED) return;
        const selects = document.querySelectorAll('select[data-unit="' + unitName + '"]');
        const promises = [];
        selects.forEach(sel => {
          sel.value = status;
          promises.push(fetch('/api/attendance/records/' + sel.dataset.session + '/' + sel.dataset.member, {
            method: 'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({status})
          }));
        });
        await Promise.all(promises);
        updateCounter();
      }

      async function markAll(status) {
        if (IS_SUBMITTED) return;
        const selects = document.querySelectorAll('select[data-member]');
        const promises = [];
        selects.forEach(sel => {
          sel.value = status;
          promises.push(fetch('/api/attendance/records/' + sel.dataset.session + '/' + sel.dataset.member, {
            method: 'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({status})
          }));
        });
        await Promise.all(promises);
        updateCounter();
      }

      async function submitAttendance() {
        if (!confirm('確定要送出本次點名結果？送出後將無法修改。')) return;
        const btn = document.querySelector('button[onclick="submitAttendance()"]');
        if (btn) { btn.disabled = true; btn.textContent = '送出中...'; }
        const res = await fetch('/api/attendance/sessions/' + SESSION_ID + '/submit', { method: 'POST' });
        const json = await res.json();
        if (res.ok && json.success) {
          location.reload();
        } else {
          alert('送出失敗：' + (json.error || '未知錯誤'));
          if (btn) { btn.disabled = false; btn.textContent = '📋 確認送出點名'; }
        }
      }

      let useCustomPatrol = false;
      function toggleCustomPatrol() {
        useCustomPatrol = !useCustomPatrol;
        document.getElementById('honor-patrol-name').classList.toggle('hidden', useCustomPatrol);
        document.getElementById('honor-patrol-custom').classList.toggle('hidden', !useCustomPatrol);
      }

      async function saveHonorPatrol() {
        const patrolName = useCustomPatrol
          ? document.getElementById('honor-patrol-custom').value.trim()
          : document.getElementById('honor-patrol-name').value;
        const reason = document.getElementById('honor-reason').value.trim();
        const yearLabel = document.getElementById('honor-year').value.trim();
        const announce = document.getElementById('honor-announce').checked;
        const msg = document.getElementById('honor-msg');

        if (!patrolName) { msg.textContent = '請填寫小隊名稱'; msg.className = 'mt-2 text-sm text-red-600'; msg.classList.remove('hidden'); return; }

        const res = await fetch('/api/attendance/sessions/' + SESSION_ID + '/honor-patrol', {
          method: 'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ patrol_name: patrolName, reason, year_label: yearLabel || null, announce })
        });
        const json = await res.json();
        if (res.ok && json.success) {
          msg.textContent = '已新增榮譽小隊' + (announce ? '，並同步公告到榮譽榜' : '');
          msg.className = 'mt-2 text-sm text-green-600';
          msg.classList.remove('hidden');
          setTimeout(() => location.reload(), 1200);
        } else {
          msg.textContent = '新增失敗：' + (json.error || '未知錯誤');
          msg.className = 'mt-2 text-sm text-red-600';
          msg.classList.remove('hidden');
        }
      }

      async function announceHonor(id) {
        if (!confirm('確定要公告此榮譽小隊到榮譽榜？這將為小隊成員新增成就記錄。')) return;
        const yearLabel = prompt('請輸入學年度標籤（例：114），留空則不填：') || '';
        const res = await fetch('/api/honor-patrol/' + id + '/announce', {
          method: 'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ year_label: yearLabel || null })
        });
        const json = await res.json();
        if (res.ok && json.success) {
          alert('已公告到榮譽榜！');
          location.reload();
        } else {
          alert('公告失敗：' + (json.error || '未知錯誤'));
        }
      }

      async function deleteHonor(id) {
        if (!confirm('確定要刪除此榮譽小隊記錄？')) return;
        const res = await fetch('/api/honor-patrol/' + id, { method: 'DELETE' });
        if (res.ok) location.reload(); else alert('刪除失敗');
      }
    </script>
  `))
})

// ===================== 進程標準設定 (原 /admin/progress 改版) =====================
adminRoutes.get('/progress', authMiddleware, async (c) => {
  const db = c.env.DB
  const sectionFilter = c.req.query('section') || '童軍'
  const versionFilter = c.req.query('version') || '113' // 預設 113 學年

  // 取得該版本的所有條件
  const requirements = await db.prepare(`
    SELECT * FROM advancement_requirements
    WHERE section = ? AND is_active = 1 AND version_year = ?
    ORDER BY rank_from, display_order, id
  `).bind(sectionFilter, versionFilter).all()

  // 按 rank_to 分組
  const groupsByTarget: Record<string, any[]> = {}
  requirements.results.forEach((r: any) => {
    const key = r.rank_to
    if (!groupsByTarget[key]) groupsByTarget[key] = []
    groupsByTarget[key].push(r)
  })

  // 取得系統中所有版本
  const versions = await db.prepare(`SELECT DISTINCT version_year FROM advancement_requirements ORDER BY version_year DESC`).all()
  const versionOptions = versions.results.map((v:any) => v.version_year)
  if (!versionOptions.includes('113')) versionOptions.push('113')
  if (!versionOptions.includes('115')) versionOptions.push('115')
  // 去重並排序
  const uniqueVersions = [...new Set(versionOptions)].sort().reverse()

  const allTargets = Object.keys(groupsByTarget) // 簡化處理，直接用資料庫有的

  return c.html(adminLayout('進程標準設定', `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <i class="fas fa-ruler-combined text-green-600"></i>進程標準設定
        </h1>
        <p class="text-gray-500 text-sm mt-0.5">設定各階段升級所需達成的標準項目</p>
      </div>
      <button onclick="document.getElementById('newStdModal').classList.remove('hidden')"
        class="bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-sm">
        <i class="fas fa-plus"></i>新增標準
      </button>
      <button onclick="document.getElementById('copyStdModal').classList.remove('hidden')"
        class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-sm">
        <i class="fas fa-copy"></i>複製/沿用標準
      </button>
    </div>

    <!-- 篩選工具列 -->
    <div class="flex flex-wrap gap-4 mb-6 items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
      <div class="flex items-center gap-2">
        <span class="text-sm font-bold text-gray-600">版本：</span>
        <select onchange="location.href='?section=${encodeURIComponent(sectionFilter)}&version='+this.value" class="border rounded-lg px-2 py-1 text-sm bg-gray-50">
          ${uniqueVersions.map(v => `<option value="${v}" ${versionFilter==v?'selected':''}>${v} 學年版</option>`).join('')}
        </select>
      </div>
      <div class="h-6 w-px bg-gray-300"></div>
      <div class="flex gap-1">
        ${['童軍','行義童軍','羅浮童軍'].map(s => `
        <a href="?section=${encodeURIComponent(s)}&version=${versionFilter}"
          class="px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${sectionFilter === s
            ? 'bg-green-100 text-green-700 font-bold'
            : 'text-gray-500 hover:bg-gray-100'}">
          ${s}
        </a>`).join('')}
      </div>
    </div>

    ${allTargets.length === 0 ? `
    <div class="bg-white rounded-2xl p-12 text-center border border-gray-200 border-dashed">
      <div class="text-4xl mb-3">📭</div>
      <h3 class="text-lg font-semibold text-gray-700 mb-1">此版本尚未設定標準</h3>
      <p class="text-gray-400 text-sm">請點擊右上角新增標準，或切換其他版本查看</p>
    </div>` : allTargets.map(target => `
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
      <div class="bg-gray-50 px-5 py-3 border-b border-gray-100 flex justify-between items-center">
        <h3 class="font-bold text-gray-800 text-base">晉升至：${target}</h3>
        <span class="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">${groupsByTarget[target].length} 項</span>
      </div>
      <div class="divide-y divide-gray-50">
        ${groupsByTarget[target].map((r: any) => `
        <div class="p-4 hover:bg-gray-50 flex items-start justify-between group">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="font-bold text-gray-700 text-sm">${r.title}</span>
              ${!r.is_mandatory ? '<span class="text-xs bg-gray-100 text-gray-500 px-1.5 rounded">選填</span>' : ''}
              <span class="text-xs bg-blue-50 text-blue-600 px-1.5 rounded">${r.requirement_type}</span>
            </div>
            ${r.description ? `<p class="text-xs text-gray-500">${r.description}</p>` : ''}
            <div class="text-xs text-gray-400 mt-1">需 ${r.required_count} ${r.unit}</div>
          </div>
          <button onclick="deleteStandard('${r.id}')" class="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">刪除</button>
        </div>`).join('')}
      </div>
    </div>`).join('')}

    <!-- 複製標準 Modal -->
    <div id="copyStdModal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 class="text-lg font-bold mb-4">複製/沿用進程標準</h3>
        <p class="text-sm text-gray-500 mb-4">將其他版本的標準複製到目前版本 (${versionFilter}學年)。<br>適合新學年開始時，沿用舊標準再進行微調。</p>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">來源版本 (複製來源)</label>
            <select id="copy_from" class="w-full border rounded-lg px-3 py-2 text-sm bg-white">
              ${uniqueVersions.filter(v => v !== versionFilter).map(v => `<option value="${v}">${v} 學年版</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">目標版本 (複製到)</label>
            <input type="text" value="${versionFilter}" readonly class="w-full border rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-500">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">組別範圍</label>
            <select id="copy_section" class="w-full border rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">全部組別</option>
              <option value="童軍">童軍</option>
              <option value="行義童軍">行義童軍</option>
              <option value="羅浮童軍">羅浮童軍</option>
            </select>
          </div>
        </div>
        <div class="flex gap-3 mt-6">
          <button onclick="submitCopy()" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium">開始複製</button>
          <button onclick="document.getElementById('copyStdModal').classList.add('hidden')" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm">取消</button>
        </div>
      </div>
    </div>

    <!-- 新增標準 Modal -->
    <div id="newStdModal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 class="text-lg font-bold mb-4">新增標準 (${sectionFilter} - ${versionFilter}版)</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">目標階段</label>
            <input id="std_rank_to" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例：初級童軍">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">前置階段</label>
            <input id="std_rank_from" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例：見習童軍">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">標準標題</label>
            <input id="std_title" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例：參加露營">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">類型</label>
              <select id="std_type" class="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                <option value="other">其他</option>
                <option value="attendance">出席</option>
                <option value="badge">技能章</option>
                <option value="camp">露營</option>
                <option value="service">服務</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">數量單位</label>
              <div class="flex gap-1">
                <input id="std_count" type="number" value="1" class="w-12 border rounded-lg px-1 py-2 text-sm text-center">
                <input id="std_unit" type="text" value="次" class="flex-1 border rounded-lg px-2 py-2 text-sm">
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-2">
            <input type="checkbox" id="std_mandatory" checked>
            <label for="std_mandatory" class="text-sm text-gray-700">設為必填項目</label>
          </div>
        </div>
        <div class="flex gap-3 mt-6">
          <button onclick="saveStandard()" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium">儲存</button>
          <button onclick="document.getElementById('newStdModal').classList.add('hidden')" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm">取消</button>
        </div>
      </div>
    </div>

    <script>
      async function submitCopy() {
        const from = document.getElementById('copy_from').value;
        const to = '${versionFilter}';
        const section = document.getElementById('copy_section').value;
        if (!from) { alert('請選擇來源版本'); return; }
        
        if (!confirm('確定要將 ' + from + ' 學年版的標準複製到 ' + to + ' 學年版嗎？\\n如果目標版本已有資料，將會追加上去。')) return;

        const res = await fetch('/api/admin/advancement-requirements/clone', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ from_version: from, to_version: to, section: section || undefined })
        });
        const r = await res.json();
        if (r.success) {
          alert('成功複製 ' + r.copied_count + ' 筆標準！');
          location.reload();
        } else {
          alert('複製失敗：' + r.error);
        }
      }

      async function saveStandard() {
        const data = {
          section: '${sectionFilter}',
          version_year: '${versionFilter}',
          rank_to: document.getElementById('std_rank_to').value.trim(),
          rank_from: document.getElementById('std_rank_from').value.trim(),
          title: document.getElementById('std_title').value.trim(),
          requirement_type: document.getElementById('std_type').value,
          required_count: parseInt(document.getElementById('std_count').value)||1,
          unit: document.getElementById('std_unit').value.trim(),
          is_mandatory: document.getElementById('std_mandatory').checked
        }
        if(!data.title || !data.rank_to) { alert('請填寫完整'); return; }
        
        const res = await fetch('/api/admin/advancement-requirements', {
          method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)
        })
        if(res.ok) location.reload();
        else alert('儲存失敗');
      }
      async function deleteStandard(id) {
        if(!confirm('確定刪除？')) return;
        const res = await fetch('/api/admin/advancement-requirements/'+id, {method:'DELETE'});
        if(res.ok) location.reload();
      }
    </script>
  `))
})

// ===================== 公假管理 =====================
// 已重構為更完整的請假審核頁面（在檔案末尾）
// 此路由保留舊有的快速操作支援，轉向新頁面
adminRoutes.get('/leaves-legacy', authMiddleware, async (c) => {
  return c.redirect('/admin/leaves')
  const db = c.env.DB
  const status = c.req.query('status') || ''

  let query = `
    SELECT lr.*, m.chinese_name, m.section
    FROM leave_requests lr
    JOIN members m ON m.id = lr.member_id
    WHERE 1=1
  `
  const params: any[] = []
  if (status) { query += ` AND lr.status = ?`; params.push(status) }
  query += ` ORDER BY lr.created_at DESC`
  const leaves = await db.prepare(query).bind(...params).all()

  const members = await db.prepare(`SELECT id, chinese_name, section FROM members WHERE membership_status='ACTIVE' ORDER BY section, chinese_name`).all()
  const sessions = await db.prepare(`SELECT id, title, date FROM attendance_sessions ORDER BY date DESC LIMIT 20`).all()

  const rows = leaves.results.map((l: any) => {
    const statusLabel: Record<string,string> = {pending:'待審',approved:'已核准',rejected:'已拒絕'}
    const statusColor: Record<string,string> = {pending:'bg-yellow-100 text-yellow-700',approved:'bg-green-100 text-green-700',rejected:'bg-red-100 text-red-700'}
    const typeLabel: Record<string,string> = {official:'公假',personal:'事假',sick:'病假'}
    return `
      <tr class="hover:bg-gray-50 border-b">
        <td class="px-4 py-3 font-medium text-sm">${l.chinese_name}</td>
        <td class="px-4 py-3 text-sm text-gray-600">${l.section}</td>
        <td class="px-4 py-3 text-sm text-gray-600">${typeLabel[l.leave_type] || l.leave_type}</td>
        <td class="px-4 py-3 text-sm text-gray-600">${l.date}</td>
        <td class="px-4 py-3 text-sm text-gray-600 max-w-xs">${l.reason || '-'}</td>
        <td class="px-4 py-3">
          <span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[l.status] || 'bg-gray-100 text-gray-700'}">
            ${statusLabel[l.status] || l.status}
          </span>
        </td>
        <td class="px-4 py-3">
          ${l.status === 'pending' ? `
            <button onclick="updateLeave('${l.id}','approved')" class="text-green-600 hover:text-green-800 text-xs mr-2">✅ 核准</button>
            <button onclick="updateLeave('${l.id}','rejected')" class="text-red-500 hover:text-red-700 text-xs mr-2">❌ 拒絕</button>
          ` : ''}
          <button onclick="deleteLeave('${l.id}')" class="text-gray-400 hover:text-red-500 text-xs">🗑</button>
        </td>
      </tr>
    `
  }).join('')

  const statusTabs = [['','全部'],['pending','待審'],['approved','已核准'],['rejected','已拒絕']].map(([v,l]) => `
    <a href="/admin/leaves${v ? '?status='+v : ''}" class="px-4 py-2 rounded-full text-sm font-medium transition ${status === v ? 'bg-green-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}">${l}</a>
  `).join('')

  const memberOptions = members.results.map((m: any) => `<option value="${m.id}">[${m.section}] ${m.chinese_name}</option>`).join('')
  const sessionOptions = sessions.results.map((s: any) => `<option value="${s.id}">${s.date} ${s.title}</option>`).join('')

  return c.html(adminLayout('公假管理', `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-500">管理成員的公假、事假與病假申請</p>
      <button onclick="document.getElementById('add-leave-modal').classList.remove('hidden')"
        class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">＋ 新增假單</button>
    </div>
    <div class="flex flex-wrap gap-2 mb-4">${statusTabs}</div>

    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">成員</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">組別</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">假別</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">日期</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">原因</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">狀態</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">操作</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="7" class="py-8 text-center text-gray-400">尚無假單記錄</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- 新增假單 Modal -->
    <div id="add-leave-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 class="text-lg font-bold mb-4">新增假單</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">成員 *</label>
            <select id="add-leave-member" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">請選擇成員</option>
              ${memberOptions}
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">假別</label>
              <select id="add-leave-type" class="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="official">公假</option>
                <option value="personal">事假</option>
                <option value="sick">病假</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">日期 *</label>
              <input type="date" id="add-leave-date" class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">關聯場次（選填）</label>
            <select id="add-leave-session" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">不關聯特定場次</option>
              ${sessionOptions}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">請假原因</label>
            <textarea id="add-leave-reason" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="請說明請假原因..."></textarea>
          </div>
        </div>
        <div class="flex gap-3 mt-4">
          <button onclick="saveLeave()" class="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium">新增</button>
          <button onclick="document.getElementById('add-leave-modal').classList.add('hidden')" class="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm">取消</button>
        </div>
      </div>
    </div>

    <script>
      async function saveLeave() {
        const data = {
          member_id: document.getElementById('add-leave-member').value,
          leave_type: document.getElementById('add-leave-type').value,
          date: document.getElementById('add-leave-date').value,
          session_id: document.getElementById('add-leave-session').value || null,
          reason: document.getElementById('add-leave-reason').value,
        };
        if (!data.member_id || !data.date) { alert('成員和日期為必填'); return; }
        const res = await fetch('/api/leaves', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
        if (res.ok) location.reload(); else alert('儲存失敗');
      }
      async function updateLeave(id, status) {
        const res = await fetch('/api/leaves/' + id, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status}) });
        if (res.ok) location.reload(); else alert('更新失敗');
      }
      async function deleteLeave(id) {
        if (!confirm('確定要刪除此假單嗎？')) return;
        const res = await fetch('/api/leaves/' + id, { method:'DELETE' });
        if (res.ok) location.reload(); else alert('刪除失敗');
      }
    </script>
  `))
})

// 保留 /admin/leaves-legacy 路由結束})

// ===================== 教練團管理 =====================
adminRoutes.get('/coaches', authMiddleware, async (c) => {
  const db = c.env.DB
  const year = c.req.query('year') || ''

  let query = `SELECT * FROM coach_members WHERE 1=1`
  const params: any[] = []
  if (year) { query += ` AND year_label = ?`; params.push(year) }
  query += ` ORDER BY CASE coach_level WHEN '指導教練' THEN 1 WHEN '助理教練' THEN 2 WHEN '見習教練' THEN 3 WHEN '預備教練' THEN 4 ELSE 5 END, chinese_name`
  const coaches = await db.prepare(query).bind(...params).all()

  const levelCounts: Record<string,number> = {}
  coaches.results.forEach((c: any) => { levelCounts[c.coach_level] = (levelCounts[c.coach_level] || 0) + 1 })

  const levelBadge: Record<string,string> = {
    '指導教練':'bg-red-100 text-red-700',
    '助理教練':'bg-orange-100 text-orange-700',
    '見習教練':'bg-blue-100 text-blue-700',
    '預備教練':'bg-gray-100 text-gray-600'
  }

  const rows = coaches.results.map((c: any) => `
    <tr class="hover:bg-gray-50 border-b">
      <td class="px-4 py-3">
        <div class="font-medium text-sm">${c.chinese_name}</div>
        ${c.english_name ? `<div class="text-xs text-gray-400">${c.english_name}</div>` : ''}
      </td>
      <td class="px-4 py-3">
        <span class="px-2 py-0.5 rounded-full text-xs font-medium ${levelBadge[c.coach_level] || 'bg-gray-100 text-gray-600'}">${c.coach_level}</span>
      </td>
      <td class="px-4 py-3 text-sm text-gray-600">${c.section_assigned || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${c.year_label ? c.year_label + '學年' : '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${c.specialties || '-'}</td>
      <td class="px-4 py-3">
        <button onclick="editCoach('${c.id}')" class="text-blue-600 hover:text-blue-800 text-xs mr-3">✏️ 編輯</button>
        <button onclick="deleteCoach('${c.id}','${c.chinese_name}')" class="text-red-500 hover:text-red-700 text-xs">🗑 刪除</button>
      </td>
    </tr>
  `).join('')

  const levelSummary = ['指導教練','助理教練','見習教練','預備教練'].map(l => `
    <div class="bg-white rounded-xl p-4 shadow-sm text-center">
      <div class="text-2xl font-bold text-green-700">${levelCounts[l] || 0}</div>
      <div class="text-xs text-gray-500 mt-1">${l}</div>
    </div>
  `).join('')

  return c.html(adminLayout('教練團管理', `
    <div class="grid grid-cols-4 gap-4 mb-6">${levelSummary}</div>

    <div class="flex items-center justify-between mb-4">
      <form class="flex items-center gap-3" method="get" action="/admin/coaches">
        <label class="text-sm text-gray-600">學年度：</label>
        <select name="year" onchange="this.form.submit()" class="border rounded-lg px-3 py-1.5 text-sm">
          <option value="">全部</option>
          <option value="115" ${year==='115'?'selected':''}>115學年</option>
          <option value="114" ${year==='114'?'selected':''}>114學年</option>
          <option value="113" ${year==='113'?'selected':''}>113學年</option>
        </select>
      </form>
      <button onclick="document.getElementById('add-coach-modal').classList.remove('hidden')"
        class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">＋ 新增教練</button>
    </div>

    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">姓名</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">等級</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">負責組別</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">學年度</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">專長</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">操作</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="6" class="py-8 text-center text-gray-400">尚無教練資料</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- 新增教練 Modal -->
    <div id="add-coach-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 class="text-lg font-bold mb-4">新增教練</h3>
        ${coachFormFields('add')}
        <div class="flex gap-3 mt-4">
          <button onclick="saveCoach()" class="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium">新增</button>
          <button onclick="document.getElementById('add-coach-modal').classList.add('hidden')" class="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm">取消</button>
        </div>
      </div>
    </div>

    <!-- 編輯教練 Modal -->
    <div id="edit-coach-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 class="text-lg font-bold mb-4">編輯教練</h3>
        <input type="hidden" id="edit-coach-id">
        ${coachFormFields('edit')}
        <div class="flex gap-3 mt-4">
          <button onclick="updateCoach()" class="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium">更新</button>
          <button onclick="document.getElementById('edit-coach-modal').classList.add('hidden')" class="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm">取消</button>
        </div>
      </div>
    </div>

    <script>
      async function editCoach(id) {
        const res = await fetch('/api/coaches');
        const json = await res.json();
        const coach = json.data.find(c => c.id === id);
        if (!coach) return;
        document.getElementById('edit-coach-id').value = coach.id;
        document.getElementById('edit-coach-chinese_name').value = coach.chinese_name || '';
        document.getElementById('edit-coach-english_name').value = coach.english_name || '';
        document.getElementById('edit-coach-coach_level').value = coach.coach_level || '';
        document.getElementById('edit-coach-section_assigned').value = coach.section_assigned || '';
        document.getElementById('edit-coach-year_label').value = coach.year_label || '';
        document.getElementById('edit-coach-specialties').value = coach.specialties || '';
        document.getElementById('edit-coach-notes').value = coach.notes || '';
        document.getElementById('edit-coach-modal').classList.remove('hidden');
      }
      function getCoachData(prefix) {
        return {
          chinese_name: document.getElementById(prefix+'-chinese_name').value,
          english_name: document.getElementById(prefix+'-english_name').value,
          coach_level: document.getElementById(prefix+'-coach_level').value,
          section_assigned: document.getElementById(prefix+'-section_assigned').value,
          year_label: document.getElementById(prefix+'-year_label').value,
          specialties: document.getElementById(prefix+'-specialties').value,
          notes: document.getElementById(prefix+'-notes').value,
        };
      }
      async function saveCoach() {
        const data = getCoachData('add-coach');
        if (!data.chinese_name) { alert('姓名為必填'); return; }
        const res = await fetch('/api/coaches', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
        if (res.ok) location.reload(); else alert('儲存失敗');
      }
      async function updateCoach() {
        const id = document.getElementById('edit-coach-id').value;
        const data = getCoachData('edit-coach');
        const res = await fetch('/api/coaches/' + id, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
        if (res.ok) location.reload(); else alert('更新失敗');
      }
      async function deleteCoach(id, name) {
        if (!confirm('確定要刪除教練「' + name + '」嗎？')) return;
        const res = await fetch('/api/coaches/' + id, { method:'DELETE' });
        if (res.ok) location.reload(); else alert('刪除失敗');
      }
    </script>
  `))
})

// ===================== 輔助函式：成員表單 =====================
function memberFormFields(prefix: string) {
  const sections = ['童軍','行義童軍','羅浮童軍','服務員','幼童軍','稚齡童軍']
  const roles = ['隊員','小隊長','副小隊長','團長','副團長','群長','副群長','隊輔','服務員','群顧問','']
  const ranks = ['',
    '見習童軍','初級童軍','中級童軍','高級童軍','獅級童軍','長城童軍','國花童軍',
    // 行義童軍與童軍共用相同階級名稱，不再使用「初級行義、中級行義...」
    '見習羅浮','授銜羅浮','服務羅浮','未入團'
  ]
  return `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">中文姓名 *</label>
          <input type="text" id="${prefix}-chinese_name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="請輸入姓名">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">英文姓名</label>
          <input type="text" id="${prefix}-english_name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="English Name">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">性別</label>
          <select id="${prefix}-gender" class="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">未指定</option>
            <option value="男">男</option>
            <option value="女">女</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">所屬組別</label>
          <select id="${prefix}-section" class="w-full border rounded-lg px-3 py-2 text-sm">
            ${sections.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">小隊</label>
          <input type="text" id="${prefix}-unit_name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例：台灣小隊">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">職位</label>
          <select id="${prefix}-role_name" class="w-full border rounded-lg px-3 py-2 text-sm">
            ${roles.map(r => `<option value="${r}">${r}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">進程級別</label>
          <select id="${prefix}-rank_level" class="w-full border rounded-lg px-3 py-2 text-sm">
            ${ranks.map(r => `<option value="${r}">${r || '未設定'}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">所屬團</label>
          <select id="${prefix}-troop" class="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="54團">54團</option>
            <option value="404團">404團</option>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">電話</label>
          <input type="tel" id="${prefix}-phone" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0912-345-678">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">Email</label>
          <input type="email" id="${prefix}-email" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="email@example.com">
        </div>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">家長/緊急聯絡人</label>
        <input type="text" id="${prefix}-parent_name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="家長姓名">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">備注</label>
        <textarea id="${prefix}-notes" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="其他備注..."></textarea>
      </div>
    </div>
  `
}

// ===================== 輔助函式：教練表單 =====================
function coachFormFields(prefix: string) {
  return `
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">中文姓名 *</label>
          <input type="text" id="${prefix}-chinese_name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="老師/教練姓名">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">英文姓名</label>
          <input type="text" id="${prefix}-english_name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="English Name">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">等級</label>
          <select id="${prefix}-coach_level" class="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="指導教練">指導教練</option>
            <option value="助理教練">助理教練</option>
            <option value="見習教練">見習教練</option>
            <option value="預備教練">預備教練</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-700 mb-1">負責組別</label>
          <select id="${prefix}-section_assigned" class="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">未指定</option>
            <option value="童軍">童軍</option>
            <option value="行義童軍">行義童軍</option>
            <option value="羅浮童軍">羅浮童軍</option>
          </select>
        </div>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">學年度</label>
        <input type="text" id="${prefix}-year_label" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="115">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">專長</label>
        <input type="text" id="${prefix}-specialties" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例：繩結、急救、露營">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">備注</label>
        <textarea id="${prefix}-notes" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="其他備注..."></textarea>
      </div>
    </div>
  `
}

// ============================================================
// 分組子頁面管理：組織架構 / 幹部 / 歷屆名單
// ============================================================

// 子頁面管理總覽
adminRoutes.get('/groups/:id/subpages', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const group = await db.prepare(`SELECT * FROM scout_groups WHERE id=?`).bind(id).first() as any
  if (!group) return c.redirect('/admin/groups')

  const cadresCount = await db.prepare(`SELECT COUNT(*) as cnt FROM group_cadres WHERE group_id=?`).bind(id).first() as any
  const alumniCount = await db.prepare(`SELECT COUNT(*) as cnt FROM group_alumni WHERE group_id=?`).bind(id).first() as any
  const org = await db.prepare(`SELECT id FROM group_org_chart WHERE group_id=?`).bind(id).first() as any

  return c.html(adminLayout(`${group.name} - 子頁面管理`, `
    <div class="mb-6">
      <div class="flex items-center gap-3 mb-2">
        <a href="/admin/groups" class="text-gray-500 hover:text-gray-700 text-sm">← 返回分組管理</a>
      </div>
      <h2 class="text-xl font-bold text-gray-800">${group.name} · 子頁面管理</h2>
      <p class="text-gray-500 text-sm mt-1">管理組織架構、幹部名單、歷屆成員資料</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
      <!-- 組織架構 -->
      <div class="bg-white rounded-xl shadow p-6 border-t-4 border-blue-500">
        <div class="text-3xl mb-3">🏛️</div>
        <h3 class="text-lg font-bold text-gray-800 mb-1">組織架構</h3>
        <p class="text-gray-500 text-sm mb-4">${org ? '✅ 已設定' : '⚠️ 尚未設定'}</p>
        <a href="/admin/groups/${id}/org" class="block text-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors">
          ${org ? '編輯組織架構' : '新增組織架構'}
        </a>
      </div>

      <!-- 幹部管理 -->
      <div class="bg-white rounded-xl shadow p-6 border-t-4 border-green-500">
        <div class="text-3xl mb-3">⭐</div>
        <h3 class="text-lg font-bold text-gray-800 mb-1">幹部名單</h3>
        <p class="text-gray-500 text-sm mb-4">共 ${cadresCount?.cnt || 0} 筆記錄</p>
        <a href="/admin/groups/${id}/cadres" class="block text-center bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors">
          管理幹部名單
        </a>
      </div>

      <!-- 歷屆名單 -->
      <div class="bg-white rounded-xl shadow p-6 border-t-4 border-amber-500">
        <div class="text-3xl mb-3">👥</div>
        <h3 class="text-lg font-bold text-gray-800 mb-1">歷屆名單</h3>
        <p class="text-gray-500 text-sm mb-4">共 ${alumniCount?.cnt || 0} 筆記錄</p>
        <a href="/admin/groups/${id}/alumni" class="block text-center bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors">
          管理歷屆名單
        </a>
      </div>
    </div>

    <div class="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
      💡 <strong>提示：</strong>設定完成後，可在前台 
      <a href="/group/${group.slug}" target="_blank" class="underline">/group/${group.slug}</a> 
      查看結果
    </div>
  `))
})

// ---- 組織架構管理 ----
adminRoutes.get('/groups/:id/org', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const group = await db.prepare(`SELECT * FROM scout_groups WHERE id=?`).bind(id).first() as any
  if (!group) return c.redirect('/admin/groups')
  const org = await db.prepare(`SELECT * FROM group_org_chart WHERE group_id=?`).bind(id).first() as any

  return c.html(adminLayout(`組織架構 - ${group.name}`, `
    <div class="mb-6">
      <a href="/admin/groups/${id}/subpages" class="text-gray-500 hover:text-gray-700 text-sm">← 返回子頁面管理</a>
      <h2 class="text-xl font-bold text-gray-800 mt-2">${group.name} · 組織架構</h2>
    </div>

    <div class="bg-white rounded-xl shadow p-6 max-w-2xl">
      <form id="org-form">
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">組織架構圖片網址</label>
          <input type="url" id="org-image_url" value="${org?.image_url || ''}"
            class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://... (圖片連結)">
          ${org?.image_url ? `<div class="mt-2"><img src="${org.image_url}" class="max-h-40 rounded border" onerror="this.style.display='none'"></div>` : ''}
        </div>
        <div class="mb-5">
          <label class="block text-sm font-medium text-gray-700 mb-1">組織說明內容（支援 HTML）</label>
          <textarea id="org-content" rows="8"
            class="w-full border rounded-lg px-3 py-2 text-sm font-mono"
            placeholder="可輸入 HTML 或純文字說明...">${org?.content || ''}</textarea>
        </div>
        <div id="org-msg" class="hidden mb-4 p-3 rounded-lg text-sm"></div>
        <button type="button" onclick="saveOrg(${id})"
          class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium">
          💾 儲存組織架構
        </button>
      </form>
    </div>

    <script>
    async function saveOrg(groupId) {
      const btn = event.target
      const msg = document.getElementById('org-msg')
      btn.disabled = true
      btn.textContent = '儲存中...'
      try {
        const res = await fetch('/api/admin/group-org/' + groupId, {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            image_url: document.getElementById('org-image_url').value.trim(),
            content: document.getElementById('org-content').value.trim()
          })
        })
        const data = await res.json()
        msg.className = 'mb-4 p-3 rounded-lg text-sm ' + (data.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200')
        msg.textContent = data.success ? '✅ 儲存成功！' : '❌ 儲存失敗：' + data.error
        msg.classList.remove('hidden')
        if (data.success) setTimeout(() => location.reload(), 1000)
      } catch(e) {
        msg.className = 'mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200'
        msg.textContent = '❌ 網路錯誤'
        msg.classList.remove('hidden')
      }
      btn.disabled = false
      btn.textContent = '💾 儲存組織架構'
    }
    </script>
  `))
})

// API: 儲存組織架構
adminRoutes.post('/api/admin/group-org/:groupId', authMiddleware, async (c) => {
  const db = c.env.DB
  const groupId = c.req.param('groupId')
  const { image_url, content } = await c.req.json() as any
  try {
    const existing = await db.prepare(`SELECT id FROM group_org_chart WHERE group_id=?`).bind(groupId).first()
    if (existing) {
      await db.prepare(`UPDATE group_org_chart SET image_url=?, content=?, updated_at=CURRENT_TIMESTAMP WHERE group_id=?`)
        .bind(image_url || null, content || null, groupId).run()
    } else {
      await db.prepare(`INSERT INTO group_org_chart (group_id, image_url, content) VALUES (?,?,?)`)
        .bind(groupId, image_url || null, content || null).run()
    }
    return c.json({ success: true })
  } catch(e: any) {
    return c.json({ success: false, error: e.message })
  }
})

// ---- 幹部管理 ----
adminRoutes.get('/groups/:id/cadres', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const group = await db.prepare(`SELECT * FROM scout_groups WHERE id=?`).bind(id).first() as any
  if (!group) return c.redirect('/admin/groups')
  const cadres = await db.prepare(`SELECT * FROM group_cadres WHERE group_id=? ORDER BY is_current DESC, year_label DESC, display_order ASC`).bind(id).all()

  const rows = cadres.results.map((c: any) => `
    <tr class="border-b hover:bg-gray-50 text-sm">
      <td class="py-2 px-3">
        <span class="px-2 py-0.5 rounded-full text-xs ${c.is_current ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
          ${c.is_current ? '現任' : c.year_label}
        </span>
      </td>
      <td class="py-2 px-3 font-medium">${c.chinese_name}</td>
      <td class="py-2 px-3 text-gray-500">${c.english_name || '-'}</td>
      <td class="py-2 px-3"><span class="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs">${c.role}</span></td>
      <td class="py-2 px-3 text-gray-400">${c.notes || '-'}</td>
      <td class="py-2 px-3">
        <button onclick='editCadre(${JSON.stringify(c).replace(/'/g, "&#39;")})' class="text-blue-600 hover:text-blue-800 mr-2">編輯</button>
        <button onclick="deleteCadre(${c.id})" class="text-red-500 hover:text-red-700">刪除</button>
      </td>
    </tr>
  `).join('')

  return c.html(adminLayout(`幹部管理 - ${group.name}`, `
    <div class="mb-6 flex items-center justify-between">
      <div>
        <a href="/admin/groups/${id}/subpages" class="text-gray-500 hover:text-gray-700 text-sm">← 返回子頁面管理</a>
        <h2 class="text-xl font-bold text-gray-800 mt-2">${group.name} · 幹部名單管理</h2>
      </div>
      <button onclick="openAddCadre()" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium">➕ 新增幹部</button>
    </div>

    <div class="bg-white rounded-xl shadow overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b text-xs text-gray-500">
          <tr>
            <th class="py-2 px-3 text-left">狀態/年度</th>
            <th class="py-2 px-3 text-left">姓名</th>
            <th class="py-2 px-3 text-left">英文名</th>
            <th class="py-2 px-3 text-left">職位</th>
            <th class="py-2 px-3 text-left">備注</th>
            <th class="py-2 px-3 text-left">操作</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="6" class="py-8 text-center text-gray-400">尚無幹部資料</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- 新增/編輯 Modal -->
    <div id="cadre-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <h3 id="cadre-modal-title" class="text-lg font-bold text-gray-800 mb-4">新增幹部</h3>
          <input type="hidden" id="cadre-id">
          <div class="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">中文姓名 *</label>
              <input type="text" id="cadre-chinese_name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="王小明">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">英文姓名</label>
              <input type="text" id="cadre-english_name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ming Wang">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">職位 *</label>
              <input type="text" id="cadre-role" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="團長、副團長、行政長...">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">學年度</label>
              <input type="text" id="cadre-year_label" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="115">
            </div>
          </div>
          <div class="mb-3">
            <label class="block text-xs font-medium text-gray-700 mb-1">照片網址</label>
            <input type="url" id="cadre-photo_url" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://...">
          </div>
          <div class="mb-3">
            <label class="block text-xs font-medium text-gray-700 mb-1">備注</label>
            <input type="text" id="cadre-notes" class="w-full border rounded-lg px-3 py-2 text-sm">
          </div>
          <div class="mb-4 flex items-center gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">排序</label>
              <input type="number" id="cadre-display_order" value="0" class="w-24 border rounded-lg px-3 py-2 text-sm">
            </div>
            <div class="flex items-center gap-2 mt-4">
              <input type="checkbox" id="cadre-is_current" class="rounded">
              <label for="cadre-is_current" class="text-sm text-gray-700">現任幹部</label>
            </div>
          </div>
          <div id="cadre-msg" class="hidden mb-3 p-3 rounded-lg text-sm"></div>
          <div class="flex gap-3">
            <button type="button" onclick="saveCadre(${id})" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium">💾 儲存</button>
            <button type="button" onclick="document.getElementById('cadre-modal').classList.add('hidden')" class="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
          </div>
        </div>
      </div>
    </div>

    <script>
    function openAddCadre() {
      document.getElementById('cadre-modal-title').textContent = '新增幹部'
      document.getElementById('cadre-id').value = ''
      document.getElementById('cadre-chinese_name').value = ''
      document.getElementById('cadre-english_name').value = ''
      document.getElementById('cadre-role').value = ''
      document.getElementById('cadre-year_label').value = ''
      document.getElementById('cadre-photo_url').value = ''
      document.getElementById('cadre-notes').value = ''
      document.getElementById('cadre-display_order').value = '0'
      document.getElementById('cadre-is_current').checked = true
      document.getElementById('cadre-msg').classList.add('hidden')
      document.getElementById('cadre-modal').classList.remove('hidden')
    }
    function editCadre(data) {
      document.getElementById('cadre-modal-title').textContent = '編輯幹部'
      document.getElementById('cadre-id').value = data.id
      document.getElementById('cadre-chinese_name').value = data.chinese_name || ''
      document.getElementById('cadre-english_name').value = data.english_name || ''
      document.getElementById('cadre-role').value = data.role || ''
      document.getElementById('cadre-year_label').value = data.year_label || ''
      document.getElementById('cadre-photo_url').value = data.photo_url || ''
      document.getElementById('cadre-notes').value = data.notes || ''
      document.getElementById('cadre-display_order').value = data.display_order || 0
      document.getElementById('cadre-is_current').checked = !!data.is_current
      document.getElementById('cadre-msg').classList.add('hidden')
      document.getElementById('cadre-modal').classList.remove('hidden')
    }
    async function saveCadre(groupId) {
      const cadreId = document.getElementById('cadre-id').value
      const msg = document.getElementById('cadre-msg')
      const payload = {
        group_id: groupId,
        chinese_name: document.getElementById('cadre-chinese_name').value.trim(),
        english_name: document.getElementById('cadre-english_name').value.trim(),
        role: document.getElementById('cadre-role').value.trim(),
        year_label: document.getElementById('cadre-year_label').value.trim(),
        photo_url: document.getElementById('cadre-photo_url').value.trim(),
        notes: document.getElementById('cadre-notes').value.trim(),
        display_order: parseInt(document.getElementById('cadre-display_order').value) || 0,
        is_current: document.getElementById('cadre-is_current').checked ? 1 : 0
      }
      if (!payload.chinese_name || !payload.role) {
        msg.className = 'mb-3 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200'
        msg.textContent = '❌ 請填寫姓名和職位'
        msg.classList.remove('hidden')
        return
      }
      const url = cadreId ? '/api/admin/group-cadres/' + cadreId : '/api/admin/group-cadres'
      const method = cadreId ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      const data = await res.json()
      if (data.success) {
        location.reload()
      } else {
        msg.className = 'mb-3 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200'
        msg.textContent = '❌ ' + (data.error || '儲存失敗')
        msg.classList.remove('hidden')
      }
    }
    async function deleteCadre(id) {
      if (!confirm('確定刪除這筆幹部記錄？')) return
      await fetch('/api/admin/group-cadres/' + id, { method: 'DELETE' })
      location.reload()
    }
    </script>
  `))
})

// API: 新增幹部
adminRoutes.post('/api/admin/group-cadres', authMiddleware, async (c) => {
  const db = c.env.DB
  const body = await c.req.json() as any
  try {
    await db.prepare(`
      INSERT INTO group_cadres (group_id, chinese_name, english_name, role, year_label, photo_url, notes, display_order, is_current)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).bind(body.group_id, body.chinese_name, body.english_name||null, body.role, body.year_label||null,
             body.photo_url||null, body.notes||null, body.display_order||0, body.is_current||0).run()
    return c.json({ success: true })
  } catch(e: any) { return c.json({ success: false, error: e.message }) }
})

// API: 更新幹部
adminRoutes.put('/api/admin/group-cadres/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json() as any
  try {
    await db.prepare(`
      UPDATE group_cadres SET chinese_name=?, english_name=?, role=?, year_label=?, photo_url=?, notes=?, display_order=?, is_current=?
      WHERE id=?
    `).bind(body.chinese_name, body.english_name||null, body.role, body.year_label||null,
             body.photo_url||null, body.notes||null, body.display_order||0, body.is_current||0, id).run()
    return c.json({ success: true })
  } catch(e: any) { return c.json({ success: false, error: e.message }) }
})

// API: 刪除幹部
adminRoutes.delete('/api/admin/group-cadres/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  await db.prepare(`DELETE FROM group_cadres WHERE id=?`).bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// ---- 歷屆名單管理 ----
adminRoutes.get('/groups/:id/alumni', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const group = await db.prepare(`SELECT * FROM scout_groups WHERE id=?`).bind(id).first() as any
  if (!group) return c.redirect('/admin/groups')
  const alumni = await db.prepare(`SELECT * FROM group_alumni WHERE group_id=? ORDER BY year_label DESC, display_order ASC`).bind(id).all()

  const rows = alumni.results.map((a: any) => `
    <tr class="border-b hover:bg-gray-50 text-sm">
      <td class="py-2 px-3 text-gray-500">${a.year_label}</td>
      <td class="py-2 px-3 font-medium">${a.member_name}</td>
      <td class="py-2 px-3 text-gray-500">${a.english_name || '-'}</td>
      <td class="py-2 px-3"><span class="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-xs">${a.unit_name || '-'}</span></td>
      <td class="py-2 px-3 text-gray-500">${a.role_name || '-'}</td>
      <td class="py-2 px-3 text-gray-500">${a.rank_level || '-'}</td>
      <td class="py-2 px-3">
        <button onclick='editAlumni(${JSON.stringify(a).replace(/'/g, "&#39;")})' class="text-blue-600 hover:text-blue-800 mr-2">編輯</button>
        <button onclick="deleteAlumni(${a.id})" class="text-red-500 hover:text-red-700">刪除</button>
      </td>
    </tr>
  `).join('')

  return c.html(adminLayout(`歷屆名單 - ${group.name}`, `
    <div class="mb-6 flex items-center justify-between">
      <div>
        <a href="/admin/groups/${id}/subpages" class="text-gray-500 hover:text-gray-700 text-sm">← 返回子頁面管理</a>
        <h2 class="text-xl font-bold text-gray-800 mt-2">${group.name} · 歷屆名單管理</h2>
      </div>
      <button onclick="openAddAlumni()" class="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium">➕ 新增成員</button>
    </div>

    <div class="bg-white rounded-xl shadow overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b text-xs text-gray-500">
          <tr>
            <th class="py-2 px-3 text-left">學年度</th>
            <th class="py-2 px-3 text-left">姓名</th>
            <th class="py-2 px-3 text-left">英文名</th>
            <th class="py-2 px-3 text-left">小隊</th>
            <th class="py-2 px-3 text-left">職位</th>
            <th class="py-2 px-3 text-left">級別</th>
            <th class="py-2 px-3 text-left">操作</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="7" class="py-8 text-center text-gray-400">尚無歷屆名單資料</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- 新增/編輯 Modal -->
    <div id="alumni-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <h3 id="alumni-modal-title" class="text-lg font-bold text-gray-800 mb-4">新增成員</h3>
          <input type="hidden" id="alumni-id">
          <div class="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">姓名 *</label>
              <input type="text" id="alumni-member_name" class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">英文名</label>
              <input type="text" id="alumni-english_name" class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">學年度 *</label>
              <input type="text" id="alumni-year_label" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="115">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">小隊</label>
              <input type="text" id="alumni-unit_name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="美西小隊">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">職位</label>
              <input type="text" id="alumni-role_name" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="團員、隊長...">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">級別</label>
              <input type="text" id="alumni-rank_level" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="初級、中級、高級...">
            </div>
          </div>
          <div class="mb-3">
            <label class="block text-xs font-medium text-gray-700 mb-1">備注</label>
            <input type="text" id="alumni-notes" class="w-full border rounded-lg px-3 py-2 text-sm">
          </div>
          <div id="alumni-msg" class="hidden mb-3 p-3 rounded-lg text-sm"></div>
          <div class="flex gap-3">
            <button type="button" onclick="saveAlumni(${id})" class="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg text-sm font-medium">💾 儲存</button>
            <button type="button" onclick="document.getElementById('alumni-modal').classList.add('hidden')" class="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
          </div>
        </div>
      </div>
    </div>

    <script>
    function openAddAlumni() {
      document.getElementById('alumni-modal-title').textContent = '新增成員'
      document.getElementById('alumni-id').value = ''
      document.getElementById('alumni-member_name').value = ''
      document.getElementById('alumni-english_name').value = ''
      document.getElementById('alumni-year_label').value = ''
      document.getElementById('alumni-unit_name').value = ''
      document.getElementById('alumni-role_name').value = ''
      document.getElementById('alumni-rank_level').value = ''
      document.getElementById('alumni-notes').value = ''
      document.getElementById('alumni-msg').classList.add('hidden')
      document.getElementById('alumni-modal').classList.remove('hidden')
    }
    function editAlumni(data) {
      document.getElementById('alumni-modal-title').textContent = '編輯成員'
      document.getElementById('alumni-id').value = data.id
      document.getElementById('alumni-member_name').value = data.member_name || ''
      document.getElementById('alumni-english_name').value = data.english_name || ''
      document.getElementById('alumni-year_label').value = data.year_label || ''
      document.getElementById('alumni-unit_name').value = data.unit_name || ''
      document.getElementById('alumni-role_name').value = data.role_name || ''
      document.getElementById('alumni-rank_level').value = data.rank_level || ''
      document.getElementById('alumni-notes').value = data.notes || ''
      document.getElementById('alumni-msg').classList.add('hidden')
      document.getElementById('alumni-modal').classList.remove('hidden')
    }
    async function saveAlumni(groupId) {
      const alumniId = document.getElementById('alumni-id').value
      const msg = document.getElementById('alumni-msg')
      const payload = {
        group_id: groupId,
        member_name: document.getElementById('alumni-member_name').value.trim(),
        english_name: document.getElementById('alumni-english_name').value.trim(),
        year_label: document.getElementById('alumni-year_label').value.trim(),
        unit_name: document.getElementById('alumni-unit_name').value.trim(),
        role_name: document.getElementById('alumni-role_name').value.trim(),
        rank_level: document.getElementById('alumni-rank_level').value.trim(),
        notes: document.getElementById('alumni-notes').value.trim()
      }
      if (!payload.member_name || !payload.year_label) {
        msg.className = 'mb-3 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200'
        msg.textContent = '❌ 請填寫姓名和學年度'
        msg.classList.remove('hidden')
        return
      }
      const url = alumniId ? '/api/admin/group-alumni/' + alumniId : '/api/admin/group-alumni'
      const method = alumniId ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      const data = await res.json()
      if (data.success) {
        location.reload()
      } else {
        msg.className = 'mb-3 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200'
        msg.textContent = '❌ ' + (data.error || '儲存失敗')
        msg.classList.remove('hidden')
      }
    }
    async function deleteAlumni(id) {
      if (!confirm('確定刪除這筆記錄？')) return
      await fetch('/api/admin/group-alumni/' + id, { method: 'DELETE' })
      location.reload()
    }
    </script>
  `))
})

// API: 新增歷屆名單
adminRoutes.post('/api/admin/group-alumni', authMiddleware, async (c) => {
  const db = c.env.DB
  const body = await c.req.json() as any
  try {
    await db.prepare(`
      INSERT INTO group_alumni (group_id, year_label, member_name, english_name, unit_name, role_name, rank_level, notes)
      VALUES (?,?,?,?,?,?,?,?)
    `).bind(body.group_id, body.year_label, body.member_name, body.english_name||null,
             body.unit_name||null, body.role_name||null, body.rank_level||null, body.notes||null).run()
    return c.json({ success: true })
  } catch(e: any) { return c.json({ success: false, error: e.message }) }
})

// API: 更新歷屆名單
adminRoutes.put('/api/admin/group-alumni/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const body = await c.req.json() as any
  try {
    await db.prepare(`
      UPDATE group_alumni SET year_label=?, member_name=?, english_name=?, unit_name=?, role_name=?, rank_level=?, notes=?
      WHERE id=?
    `).bind(body.year_label, body.member_name, body.english_name||null,
             body.unit_name||null, body.role_name||null, body.rank_level||null, body.notes||null, id).run()
    return c.json({ success: true })
  } catch(e: any) { return c.json({ success: false, error: e.message }) }
})

// API: 刪除歷屆名單
adminRoutes.delete('/api/admin/group-alumni/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  await db.prepare(`DELETE FROM group_alumni WHERE id=?`).bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// ===================== 成員 CSV 批次匯入 =====================
adminRoutes.get('/members/import', authMiddleware, async (c) => {
  return c.html(adminLayout('成員批次匯入', `
    <div class="max-w-3xl">
      <p class="text-sm text-gray-500 mb-6">
        上傳 CSV 檔案批次匯入成員資料。CSV 格式：<code class="bg-gray-100 px-1 rounded text-xs">中文姓名,英文姓名,性別,組別,小隊,職位,級別,所屬團,電話,Email,家長姓名,備注</code>
      </p>

      <!-- CSV 範本下載 -->
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div class="flex items-center justify-between">
          <div>
            <div class="font-medium text-blue-800 text-sm">📋 CSV 範本</div>
            <div class="text-xs text-blue-600 mt-1">第一列為欄位名稱，從第二列開始填入資料</div>
          </div>
          <button onclick="downloadTemplate()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">下載範本</button>
        </div>
      </div>

      <!-- 上傳區域 -->
      <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 class="font-semibold text-gray-800 mb-4">📤 上傳 CSV 檔案</h3>
        <div id="drop-zone" class="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-green-400 transition-colors cursor-pointer" onclick="document.getElementById('csv-file').click()">
          <div class="text-4xl mb-3">📁</div>
          <div class="text-gray-600 font-medium">點擊選擇 CSV 檔案</div>
          <div class="text-sm text-gray-400 mt-1">或將檔案拖曳至此</div>
          <input type="file" id="csv-file" accept=".csv" class="hidden" onchange="previewCSV(event)">
        </div>
      </div>

      <!-- 預覽區域 -->
      <div id="preview-section" class="hidden bg-white rounded-xl shadow-sm p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-gray-800">👁️ 資料預覽</h3>
          <span id="preview-count" class="text-sm text-gray-500"></span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead id="preview-head" class="bg-gray-50"></thead>
            <tbody id="preview-body"></tbody>
          </table>
        </div>
        <div id="preview-msg" class="hidden mt-3 p-3 rounded-lg text-sm"></div>
        <div class="flex gap-3 mt-4">
          <button onclick="importCSV()" class="bg-green-700 hover:bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium">✅ 確認匯入</button>
          <button onclick="resetImport()" class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm">重新選擇</button>
        </div>
      </div>

      <!-- 匯入結果 -->
      <div id="result-section" class="hidden bg-white rounded-xl shadow-sm p-6">
        <h3 class="font-semibold text-gray-800 mb-4">📊 匯入結果</h3>
        <div id="result-content"></div>
        <a href="/admin/members" class="inline-block mt-4 bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm">← 返回成員列表</a>
      </div>
    </div>

    <script>
    const COLUMNS = ['中文姓名','英文姓名','性別','組別','小隊','職位','級別','所屬團','電話','Email','家長姓名','備注']
    const COLUMN_KEYS = ['chinese_name','english_name','gender','section','unit_name','role_name','rank_level','troop','phone','email','parent_name','notes']
    let parsedRows = []

    function downloadTemplate() {
      const link = document.createElement('a');
      link.href = '/static/members_import_template.xlsx';
      link.download = '成員匯入範例.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    function previewCSV(event) {
      const file = event.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target.result.replace(/^\uFEFF/, '') // remove BOM
        const lines = text.split('\\n').filter(l => l.trim())
        if (lines.length < 2) {
          alert('CSV 內容不足，請確認格式'); return
        }
        const headers = lines[0].split(',').map(h => h.trim())
        parsedRows = []
        const errors = []
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(',').map(v => v.trim())
          if (vals.every(v => !v)) continue // 跳過空行
          const row = {}
          COLUMN_KEYS.forEach((key, idx) => { row[key] = vals[idx] || '' })
          if (!row.chinese_name) { errors.push('第' + (i+1) + '列：姓名為空'); continue }
          // 設預設值
          if (!row.section) row.section = '童軍'
          if (!row.role_name) row.role_name = '隊員'
          if (!row.troop) row.troop = '54團'
          parsedRows.push(row)
        }

        // 顯示預覽
        const head = document.getElementById('preview-head')
        const body = document.getElementById('preview-body')
        head.innerHTML = '<tr>' + ['姓名','組別','小隊','職位','級別'].map(h => '<th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 border-b">'+h+'</th>').join('') + '</tr>'
        body.innerHTML = parsedRows.slice(0,10).map(r => '<tr class="border-b hover:bg-gray-50"><td class="px-3 py-2">'+r.chinese_name+'</td><td class="px-3 py-2">'+r.section+'</td><td class="px-3 py-2">'+r.unit_name+'</td><td class="px-3 py-2">'+r.role_name+'</td><td class="px-3 py-2">'+r.rank_level+'</td></tr>').join('')
        if (parsedRows.length > 10) body.innerHTML += '<tr><td colspan="5" class="px-3 py-2 text-center text-gray-400 text-xs">...（共 '+parsedRows.length+' 筆，僅顯示前10筆）</td></tr>'

        document.getElementById('preview-count').textContent = '共 ' + parsedRows.length + ' 筆資料'
        document.getElementById('preview-section').classList.remove('hidden')
        const msg = document.getElementById('preview-msg')
        if (errors.length > 0) {
          msg.className = 'mt-3 p-3 rounded-lg text-sm bg-yellow-50 text-yellow-700 border border-yellow-200'
          msg.textContent = '⚠️ 已跳過 ' + errors.length + ' 列錯誤資料：' + errors.slice(0,3).join('、')
          msg.classList.remove('hidden')
        }
      }
      reader.readAsText(file, 'UTF-8')
    }

    async function importCSV() {
      if (parsedRows.length === 0) { alert('無資料可匯入'); return }
      const btn = event.target
      btn.disabled = true; btn.textContent = '匯入中...'
      const results = { success: 0, skip: 0, error: [] }
      for (const row of parsedRows) {
        try {
          const res = await fetch('/api/members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chinese_name: row.chinese_name,
              english_name: row.english_name || null,
              gender: row.gender || null,
              section: row.section || '童軍',
              unit_name: row.unit_name || null,
              role_name: row.role_name || '隊員',
              rank_level: row.rank_level || null,
              troop: row.troop || '54團',
              phone: row.phone || null,
              email: row.email || null,
              parent_name: row.parent_name || null,
              notes: row.notes || null,
              membership_status: 'ACTIVE'
            })
          })
          const data = await res.json()
          if (data.success) results.success++
          else results.error.push(row.chinese_name + ': ' + data.error)
        } catch(e) {
          results.error.push(row.chinese_name + ': 網路錯誤')
        }
      }
      document.getElementById('preview-section').classList.add('hidden')
      const resultEl = document.getElementById('result-content')
      resultEl.innerHTML = \`
        <div class="grid grid-cols-3 gap-4 mb-4">
          <div class="bg-green-50 rounded-xl p-4 text-center">
            <div class="text-3xl font-bold text-green-700">\${results.success}</div>
            <div class="text-xs text-gray-500 mt-1">成功匯入</div>
          </div>
          <div class="bg-red-50 rounded-xl p-4 text-center">
            <div class="text-3xl font-bold text-red-600">\${results.error.length}</div>
            <div class="text-xs text-gray-500 mt-1">失敗</div>
          </div>
          <div class="bg-blue-50 rounded-xl p-4 text-center">
            <div class="text-3xl font-bold text-blue-600">\${parsedRows.length}</div>
            <div class="text-xs text-gray-500 mt-1">總計</div>
          </div>
        </div>
        \${results.error.length > 0 ? '<div class="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700"><strong>失敗記錄：</strong><br>' + results.error.slice(0,10).join('<br>') + '</div>' : ''}
      \`
      document.getElementById('result-section').classList.remove('hidden')
      btn.disabled = false; btn.textContent = '✅ 確認匯入'
    }

    function resetImport() {
      parsedRows = []
      document.getElementById('csv-file').value = ''
      document.getElementById('preview-section').classList.add('hidden')
      document.getElementById('result-section').classList.add('hidden')
    }

    // Drag & Drop
    const dz = document.getElementById('drop-zone')
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('border-green-400','bg-green-50') })
    dz.addEventListener('dragleave', () => dz.classList.remove('border-green-400','bg-green-50'))
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('border-green-400','bg-green-50')
      const file = e.dataTransfer.files[0]
      if (file) previewCSV({ target: { files: [file] } })
    })
    </script>
  `))
})

// ===================== 成員詳細頁面 (整合進程管理) =====================
adminRoutes.get('/members/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const tab = c.req.query('tab') || 'info' // info, advancement
  const member = await db.prepare(`SELECT * FROM members WHERE id=?`).bind(id).first() as any
  if (!member) return c.redirect('/admin/members')

  // 1. 基本資料 & 歷史在籍
  const enrollments = await db.prepare(`SELECT * FROM member_enrollments WHERE member_id=? AND is_active=1 ORDER BY year_label DESC`).bind(id).all()
  const yearSetting = await db.prepare(`SELECT value FROM site_settings WHERE key='current_year_label'`).first() as any
  const currentYear = yearSetting?.value || '114'
  const currentEnrollment = (enrollments.results as any[]).find(e => e.year_label === currentYear) || null

  // 2. 進程標準與細項完成度
  // 取得該組別所有啟用條件
  const requirements = await db.prepare(`
    SELECT * FROM advancement_requirements WHERE section=? AND is_active=1 ORDER BY rank_from, display_order
  `).bind(member.section).all()
  
  // 取得學員的細項完成進度
  const advProgress = await db.prepare(`
    SELECT * FROM advancement_progress WHERE member_id=?
  `).bind(id).all()
  const progressMap: Record<string, boolean> = {}
  advProgress.results.forEach((p:any) => {
    // 簡單判斷：有紀錄且 (achieved >= required 或 status=approved) 視為完成
    if (p.status === 'approved' || p.achieved_count > 0) progressMap[p.requirement_id] = true
  })

  // 3. 晉升紀錄 (大階段)
  const rankRecords = await db.prepare(`
    SELECT * FROM progress_records WHERE member_id=? AND record_type='rank' ORDER BY awarded_at ASC
  `).bind(id).all()
  const rankRecordMap: Record<string, string> = {} // rankName -> date
  rankRecords.results.forEach((r:any) => rankRecordMap[r.award_name] = r.awarded_at)

  // 4. 專科章紀錄（含名稱）
  const myBadges = await db.prepare(`
    SELECT msb.badge_id, sb.name, sb.category, msb.obtained_date
    FROM member_specialty_badges msb
    JOIN specialty_badges sb ON sb.id = msb.badge_id
    WHERE msb.member_id=?
  `).bind(id).all()
  const myBadgeSet = new Set(myBadges.results.map((b:any) => b.badge_id))
  const myBadgeNameSet = new Set(myBadges.results.map((b:any) => b.name))
  const myBadgeCount = myBadges.results.length

  // 5. 所有專科章
  const allBadges = await db.prepare(`SELECT * FROM specialty_badges WHERE is_active=1 ORDER BY category, display_order`).all()
  const badgesByCat: Record<string,any[]> = {}
  const categories = ['技能', '服務', '健身', '其他']
  categories.forEach(c => badgesByCat[c] = [])
  allBadges.results.forEach((b:any) => {
    const c = b.category||'其他'
    if(!badgesByCat[c]) badgesByCat[c] = []
    badgesByCat[c].push(b)
  })

  // 6. 定義晉級必備專科章（獅級/長城/國花）
  const rankBadgeRequirements = (member.section !== '羅浮童軍') ? [
    {
      rank: '獅級童軍', totalRequired: 5, color: 'amber',
      colorClass: 'amber', bgColor: 'bg-amber-50', textColor: 'text-amber-700', borderColor: 'border-amber-300',
      requiredBadges: [
        { name: '露營', isOptional: false, choices: [] as string[] },
        { name: '旅行', isOptional: false, choices: [] as string[] },
        { name: '社區公民', isOptional: false, choices: [] as string[] }
      ],
      electiveBadges: 2, description: '含 3 枚必備章 + 自選 2 枚任意技能章'
    },
    {
      rank: '長城童軍', totalRequired: 11, color: 'red',
      colorClass: 'red', bgColor: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-300',
      requiredBadges: [
        { name: '國家公民', isOptional: false, choices: [] as string[] },
        { name: '急救', isOptional: false, choices: [] as string[] },
        { name: '運動技能', isOptional: true, choices: ['游泳', '自行車', '越野'] }
      ],
      electiveBadges: 8, description: '含 3 枚必備章（運動擇一）+ 自選 8 枚'
    },
    {
      rank: '國花童軍', totalRequired: 18, color: 'purple',
      colorClass: 'purple', bgColor: 'bg-purple-50', textColor: 'text-purple-700', borderColor: 'border-purple-300',
      requiredBadges: [
        { name: '世界公民', isOptional: false, choices: [] as string[] },
        { name: '生態保育', isOptional: false, choices: [] as string[] },
        { name: '測量', isOptional: false, choices: [] as string[] },
        { name: '生物類', isOptional: true, choices: ['植物', '昆蟲', '賞鳥'] },
        { name: '藝術類', isOptional: true, choices: ['音樂', '舞蹈', '攝影'] }
      ],
      electiveBadges: 13, description: '含 5 枚必備章（生物、藝術各擇一）+ 自選 13 枚'
    }
  ] : [] as any[]

  // 判斷必備章是否達成
  function checkReqBadge(req: {name:string, isOptional:boolean, choices:string[]}, has: Set<string>): boolean {
    if (req.isOptional && req.choices.length > 0) return req.choices.some(c => has.has(c))
    return has.has(req.name)
  }

  // 取得所有必備章名稱集合（不含選項）
  const allRequiredBadgeNames = new Set<string>()
  rankBadgeRequirements.forEach((r:any) => {
    r.requiredBadges.forEach((b:any) => {
      if (!b.isOptional) allRequiredBadgeNames.add(b.name)
      else b.choices.forEach((c:string) => allRequiredBadgeNames.add(c))
    })
  })

  // 判斷某個晉級的專科章條件是否全部達成
  const rankBadgeDone: Record<string, boolean> = {}
  rankBadgeRequirements.forEach((r:any) => {
    const allReqDone = r.requiredBadges.every((b:any) => checkReqBadge(b, myBadgeNameSet))
    const hasEnough = myBadgeCount >= r.totalRequired
    rankBadgeDone[r.rank] = allReqDone && hasEnough
  })

  // 定義階級順序（行義童軍與童軍共用相同階級名稱）
  const ranksMap: Record<string, string[]> = {
    '童軍': ['見習童軍','初級童軍','中級童軍','高級童軍','獅級童軍','長城童軍','國花童軍'],
    '行義童軍': ['見習童軍','初級童軍','中級童軍','高級童軍','獅級童軍','長城童軍','國花童軍'],
    '羅浮童軍': ['見習羅浮','授銜羅浮','服務羅浮']
  }
  const targetRanks = ranksMap[member.section] || []

  // 按 rank_to 分組標準
  const reqsByTarget: Record<string, any[]> = {}
  requirements.results.forEach((r:any) => {
    if(!reqsByTarget[r.rank_to]) reqsByTarget[r.rank_to] = []
    reqsByTarget[r.rank_to].push(r)
  })

  // === 渲染函式 ===

  const renderRankSection = (rank: string) => {
    const isRankAchieved = !!rankRecordMap[rank]
    const achieveDate = rankRecordMap[rank] || ''
    const reqs = reqsByTarget[rank] || []
    
    // 計算完成度（進程條件）
    const totalReq = reqs.length
    const doneReq = reqs.filter(r => progressMap[r.id]).length
    const isReqDone = totalReq > 0 && totalReq === doneReq

    // 檢查專科章要求（獅級/長城/國花）
    const badgeReq = rankBadgeRequirements.find((r:any) => r.rank === rank)
    const isBadgeDone = badgeReq ? rankBadgeDone[rank] : true // 沒有專科章要求的階段視為通過
    const isAllDone = isReqDone && isBadgeDone

    // 狀態顏色
    let headerClass = 'bg-gray-50 border-gray-200'
    let textClass = 'text-gray-500'
    if (isRankAchieved) { headerClass = 'bg-green-50 border-green-200'; textClass = 'text-green-700' }
    else if (isAllDone) { headerClass = 'bg-blue-50 border-blue-200'; textClass = 'text-blue-700' }

    // 建立晉升阻礙說明
    const blockReasons: string[] = []
    if (!isReqDone) blockReasons.push(`進程條件 ${doneReq}/${totalReq}`)
    if (badgeReq && !isBadgeDone) {
      const allReqDone = badgeReq.requiredBadges.every((b:any) => checkReqBadge(b, myBadgeNameSet))
      const hasEnough = myBadgeCount >= badgeReq.totalRequired
      if (!allReqDone) blockReasons.push('必備專科章未完成')
      if (!hasEnough) blockReasons.push(`專科章數量 ${myBadgeCount}/${badgeReq.totalRequired}`)
    }

    return `
    <div class="mb-4 rounded-xl border-2 ${headerClass} overflow-hidden transition-all">
      <div class="px-5 py-3 flex items-center justify-between bg-white/50">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isRankAchieved ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'}">
            ${isRankAchieved ? '✓' : targetRanks.indexOf(rank) + 1}
          </div>
          <div>
            <h3 class="font-bold text-base ${textClass}">${rank}</h3>
            ${isRankAchieved 
              ? `<p class="text-xs text-green-600">已於 ${achieveDate?.substring(0,10) || achieveDate} 晉升</p>` 
              : `<div class="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span class="text-xs ${isReqDone ? 'text-green-600' : 'text-gray-400'}">
                    ${isReqDone ? '✓' : '○'} 進程 ${doneReq}/${totalReq}
                  </span>
                  ${badgeReq ? `<span class="text-xs ${isBadgeDone ? 'text-green-600' : 'text-amber-500'}">
                    ${isBadgeDone ? '✓' : '○'} 專科章 ${myBadgeCount}/${badgeReq.totalRequired}
                  </span>` : ''}
                </div>`
            }
          </div>
        </div>
        <div class="flex flex-col items-end gap-1">
          ${!isRankAchieved ? `
            <button onclick="promote('${rank}', ${isAllDone})" 
              class="${isAllDone ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md' : 'bg-gray-200 text-gray-400 cursor-not-allowed'} px-4 py-2 rounded-lg text-sm font-bold transition-colors">
              晉升
            </button>
            ${blockReasons.length > 0 ? `<span class="text-[10px] text-amber-500">${blockReasons[0]}</span>` : ''}
          ` : `
            <button onclick="editRankDate('${rank}', '${achieveDate}')" class="text-xs text-gray-400 hover:text-blue-500 underline">修改日期</button>
          `}
        </div>
      </div>
      
      <!-- 細項清單 -->
      <div class="bg-white border-t border-gray-100 p-2">
        ${reqs.length === 0 ? '<p class="text-xs text-gray-400 text-center py-2">無設定標準</p>' : 
          `<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            ${reqs.map(r => {
              const checked = progressMap[r.id] ? 'checked' : ''
              return `
              <label class="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <div class="relative flex items-center mt-0.5">
                  <input type="checkbox" onchange="toggleReq('${r.id}', this.checked)" ${checked} class="peer w-5 h-5 border-2 border-gray-300 rounded text-green-600 focus:ring-green-500 cursor-pointer">
                </div>
                <div>
                  <div class="text-sm font-medium text-gray-700 ${checked ? 'line-through opacity-50' : ''}">${r.title}</div>
                  ${r.description ? `<div class="text-xs text-gray-400">${r.description}</div>` : ''}
                  <div class="text-[10px] text-gray-400 mt-0.5">需 ${r.required_count} ${r.unit}</div>
                </div>
              </label>`
            }).join('')}
          </div>`
        }
        ${badgeReq && !isRankAchieved ? `
        <div class="mt-2 mx-2 mb-1 p-2 rounded-lg ${isBadgeDone ? 'bg-green-50 border border-green-100' : 'bg-amber-50 border border-amber-200'}">
          <div class="flex items-center gap-2 text-xs ${isBadgeDone ? 'text-green-700' : 'text-amber-700'} font-medium">
            <i class="fas fa-medal"></i>
            <span>專科章要求：共需 ${badgeReq.totalRequired} 枚（含必備章）</span>
            <span class="ml-auto">${myBadgeCount}/${badgeReq.totalRequired} ${isBadgeDone ? '✓' : ''}</span>
          </div>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            ${badgeReq.requiredBadges.map((b:any) => {
              const obtained = checkReqBadge(b, myBadgeNameSet)
              const label = b.isOptional ? b.choices.join('/') : b.name
              return `<span class="text-[10px] px-1.5 py-0.5 rounded ${obtained ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-500'}">
                ${obtained ? '✓' : '○'} ${label}${b.isOptional ? '（擇一）' : ''}
              </span>`
            }).join('')}
          </div>
        </div>` : ''}
      </div>
    </div>`
  }

  // 生成視覺化專科章儀表板（同學員頁面樣式）
  const renderBadgeDashboard = () => {
    if (rankBadgeRequirements.length === 0) {
      // 羅浮童軍：顯示原始專科章牆
      return `<div class="space-y-4">${categories.map(cat => {
        const list = badgesByCat[cat] || []
        if (list.length === 0) return ''
        return `<div>
          <h4 class="font-bold text-gray-500 text-sm mb-2 border-l-4 border-gray-300 pl-2">${cat}類專科章</h4>
          <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            ${list.map(b => {
              const has = myBadgeSet.has(b.id)
              return `<div onclick="toggleBadge('${b.id}', ${!has})" class="cursor-pointer border-2 ${has ? 'border-amber-400 bg-amber-50' : 'border-gray-100 bg-gray-50 opacity-50 hover:opacity-90'} rounded-xl p-2 flex flex-col items-center gap-1 transition-all">
                <div class="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-base">
                  ${b.image_url ? `<img src="${b.image_url}" class="w-full h-full object-cover rounded-full">` : '🏅'}
                </div>
                <span class="text-[10px] font-medium text-gray-700 text-center leading-tight">${b.name}</span>
              </div>`
            }).join('')}
          </div>
        </div>`
      }).join('')}</div>`
    }

    // 童軍/行義童軍：完整視覺化儀表板
    return `
    <!-- 整體概覽列 -->
    <div class="flex items-center justify-around bg-gray-50 rounded-xl p-3 mb-5">
      ${rankBadgeRequirements.map((req:any, idx:number) => {
        const allReqDone = req.requiredBadges.every((b:any) => checkReqBadge(b, myBadgeNameSet))
        const hasEnough = myBadgeCount >= req.totalRequired
        const isFullyDone = allReqDone && hasEnough
        return `
        ${idx > 0 ? '<i class="fas fa-chevron-right text-gray-300 text-xs"></i>' : ''}
        <div class="flex flex-col items-center gap-1">
          <div class="w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold shadow-sm
            ${isFullyDone ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}">
            ${isFullyDone ? '<i class="fas fa-check text-lg"></i>' : `<span>${myBadgeCount}/${req.totalRequired}</span>`}
          </div>
          <div class="text-xs font-medium ${isFullyDone ? 'text-green-700' : 'text-gray-500'} text-center">
            ${req.rank.replace('童軍', '')}
          </div>
          <div class="text-[10px] text-gray-400">${req.totalRequired}枚</div>
        </div>`
      }).join('')}
    </div>

    <!-- 各階段必備章卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      ${rankBadgeRequirements.map((req:any) => {
        const allReqDone = req.requiredBadges.every((b:any) => checkReqBadge(b, myBadgeNameSet))
        const hasEnough = myBadgeCount >= req.totalRequired
        const isFullyDone = allReqDone && hasEnough
        const doneReqCount = req.requiredBadges.filter((b:any) => checkReqBadge(b, myBadgeNameSet)).length
        const pct = Math.min(100, Math.round(myBadgeCount / req.totalRequired * 100))
        return `
        <div class="rounded-xl border-2 p-4 ${isFullyDone ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'}">
          <div class="flex items-center justify-between mb-3">
            <div>
              <div class="font-bold text-sm ${isFullyDone ? 'text-green-800' : req.textColor}">${req.rank}</div>
              <div class="text-xs text-gray-400">共需 ${req.totalRequired} 枚</div>
            </div>
            ${isFullyDone
              ? '<div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center"><i class="fas fa-check text-white text-xs"></i></div>'
              : `<span class="text-sm font-bold ${req.textColor}">${doneReqCount}/${req.requiredBadges.length} 必備</span>`
            }
          </div>

          <!-- 必備章清單 -->
          <div class="space-y-1.5 mb-3">
            ${req.requiredBadges.map((badge:any) => {
              const obtained = checkReqBadge(badge, myBadgeNameSet)
              const obtainedName = badge.isOptional ? (badge.choices.find((c:string) => myBadgeNameSet.has(c)) || '') : ''
              // 找到對應的 badge id（如果有獲得）
              const badgeObj = allBadges.results.find((b:any) => b.name === (obtainedName || badge.name)) as any
              const badgeId = badgeObj?.id || ''
              return `
              <div class="flex items-center gap-2 ${obtained ? '' : 'opacity-60'}">
                <div class="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center ${obtained ? 'bg-green-500' : 'bg-white border-2 border-gray-300'}">
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
              <span class="${hasEnough ? 'text-green-700 font-bold' : 'text-gray-400'}">${myBadgeCount}/${req.totalRequired}</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-1.5">
              <div class="h-1.5 rounded-full ${hasEnough ? 'bg-green-500' : 'bg-' + req.colorClass + '-400'}" style="width:${pct}%"></div>
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-2 leading-tight">${req.description}</p>
        </div>`
      }).join('')}
    </div>

    <!-- 分隔線 -->
    <div class="border-t border-gray-200 pt-5 mb-3">
      <h3 class="font-bold text-gray-700 flex items-center gap-2 mb-1">
        <i class="fas fa-th text-gray-400"></i>所有專科章管理
        <span class="text-xs font-normal text-gray-400">(點擊可獲得/取消)</span>
      </h3>
      <p class="text-xs text-gray-400 mb-4">已取得 <strong class="text-amber-600">${myBadgeCount}</strong> 枚</p>
    </div>

    <!-- 依類別顯示所有專科章：必備章與自選章分開 -->
    ${categories.map(cat => {
      const list = badgesByCat[cat] || []
      if (list.length === 0) return ''
      const requiredInCat = list.filter((b:any) => allRequiredBadgeNames.has(b.name))
      const electiveInCat = list.filter((b:any) => !allRequiredBadgeNames.has(b.name))
      return `
      <div class="mb-5">
        <h4 class="font-semibold text-gray-600 text-sm mb-3 flex items-center gap-2">
          <span class="w-1 h-4 bg-gray-400 rounded"></span>${cat}類專科章
        </h4>
        ${requiredInCat.length > 0 ? `
        <p class="text-xs text-amber-600 font-medium mb-2">📌 必備章</p>
        <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mb-3">
          ${requiredInCat.map(b => {
            const has = myBadgeSet.has(b.id)
            return `
            <div onclick="toggleBadge('${b.id}', ${!has})"
              class="cursor-pointer border-2 rounded-xl p-2 flex flex-col items-center gap-1 transition-all relative
              ${has ? 'border-amber-400 bg-amber-50 shadow-sm' : 'border-amber-200 bg-amber-50/30 opacity-60 hover:opacity-100'}">
              ${has ? '<div class="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full"></div>' : ''}
              <div class="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                ${b.image_url ? `<img src="${b.image_url}" class="w-full h-full object-cover rounded-full">` : '🏅'}
              </div>
              <span class="text-[10px] font-bold text-gray-700 text-center leading-tight">${b.name}</span>
            </div>`
          }).join('')}
        </div>` : ''}
        ${electiveInCat.length > 0 ? `
        <p class="text-xs text-gray-400 font-medium mb-2">✨ 自選章</p>
        <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          ${electiveInCat.map(b => {
            const has = myBadgeSet.has(b.id)
            return `
            <div onclick="toggleBadge('${b.id}', ${!has})"
              class="cursor-pointer border-2 rounded-xl p-2 flex flex-col items-center gap-1 transition-all relative
              ${has ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-gray-100 bg-gray-50 opacity-50 hover:opacity-100'}">
              ${has ? '<div class="absolute top-1 right-1 w-2.5 h-2.5 bg-blue-500 rounded-full"></div>' : ''}
              <div class="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                ${b.image_url ? `<img src="${b.image_url}" class="w-full h-full object-cover rounded-full">` : '🏅'}
              </div>
              <span class="text-[10px] font-medium text-gray-700 text-center leading-tight">${b.name}</span>
            </div>`
          }).join('')}
        </div>` : ''}
      </div>`
    }).join('')}`
  }

  const contentInfo = `
    <!-- 原本的「基本資料」部分保留 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl shadow-sm p-5">
        <h3 class="font-bold text-gray-700 mb-4">基本資料</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-gray-500">姓名</span><span class="font-medium">${member.chinese_name}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">組別</span><span class="font-medium">${currentEnrollment?.section || member.section}</span></div>
          <div class="flex justify-between items-center">
            <span class="text-gray-500">目前階級</span>
            <div class="flex items-center gap-2">
              <span class="text-green-700 font-bold" id="curr-rank-display">${member.rank_level || '未設定'}</span>
              <button onclick="document.getElementById('rank-edit-panel').classList.toggle('hidden')" class="text-xs text-blue-600 hover:underline">✏️ 修改</button>
            </div>
          </div>
        </div>
        <!-- 快速修改階級 -->
        <div id="rank-edit-panel" class="hidden mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <label class="block text-xs font-medium text-gray-600 mb-1">選擇新階級（儲存後將自動同步進程勾選）</label>
          <div class="flex gap-2">
            <select id="quick-rank-select" class="flex-1 border rounded-lg px-2 py-1.5 text-sm">
              ${['','見習童軍','初級童軍','中級童軍','高級童軍','獅級童軍','長城童軍','國花童軍','見習羅浮','授銜羅浮','服務羅浮'].map(r => `<option value="${r}" ${r === (member.rank_level||'') ? 'selected' : ''}>${r || '未設定'}</option>`).join('')}
            </select>
            <button onclick="quickUpdateRank()" class="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700">更新</button>
          </div>
          <p class="text-xs text-blue-600 mt-1">💡 更新後請切到「進程與專科章」頁查看自動勾選效果</p>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-5">
        <h3 class="font-bold text-gray-700 mb-4">系統操作</h3>
        <a href="/admin/members/${id}?tab=advancement" class="block w-full text-center bg-green-600 text-white py-2 rounded-lg hover:bg-green-500 mb-2">管理進程與專科章</a>
        <a href="/admin/members-legacy/${id}" class="block w-full text-center bg-gray-100 text-gray-600 py-2 rounded-lg hover:bg-gray-200 text-sm">完整資料與出席記錄</a>
      </div>
    </div>
    <script>
    async function quickUpdateRank() {
      const rank = document.getElementById('quick-rank-select').value;
      const res = await fetch('/api/members/${id}', {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          chinese_name: '${member.chinese_name.replace(/'/g, "\\'")}',
          english_name: ${JSON.stringify(member.english_name)},
          gender: ${JSON.stringify(member.gender)},
          national_id: ${JSON.stringify(member.national_id)},
          dob: ${JSON.stringify(member.dob)},
          phone: ${JSON.stringify(member.phone)},
          email: ${JSON.stringify(member.email)},
          parent_name: ${JSON.stringify(member.parent_name)},
          section: ${JSON.stringify(member.section)},
          rank_level: rank || null,
          unit_name: ${JSON.stringify(member.unit_name)},
          role_name: ${JSON.stringify(member.role_name)},
          troop: ${JSON.stringify(member.troop)},
          membership_status: ${JSON.stringify(member.membership_status)},
          notes: ${JSON.stringify(member.notes)}
        })
      });
      if (res.ok) {
        document.getElementById('curr-rank-display').textContent = rank || '未設定';
        document.getElementById('rank-edit-panel').classList.add('hidden');
        alert('✅ 階級已更新！進程細項已自動同步。\\n\\n點「管理進程與專科章」查看效果。');
      } else {
        alert('❌ 更新失敗，請稍後再試');
      }
    }
    </script>
  `

  const contentAdv = `
    <div class="grid grid-cols-1 lg:grid-cols-1 gap-8">
      <!-- 上半部：進程追蹤 (清單式) -->
      <div>
        <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i class="fas fa-tasks text-blue-600"></i> 進程追蹤
        </h2>
        <div class="space-y-2">
          ${targetRanks.map(renderRankSection).join('')}
        </div>
      </div>

      <!-- 下半部：專科章儀表板 -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i class="fas fa-medal text-amber-500"></i> 專科章管理
          </h2>
          <div class="text-right">
            <span class="text-2xl font-bold text-amber-600">${myBadgeCount}</span>
            <span class="text-xs text-gray-400 ml-1">枚已取得</span>
          </div>
        </div>
        ${renderBadgeDashboard()}
      </div>
    </div>

    <!-- 晉升確認 Modal -->
    <div id="promoteModal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 class="text-lg font-bold mb-4">確認晉升</h3>
        <p class="text-sm text-gray-600 mb-3">將 <strong>${member.chinese_name}</strong> 晉升為 <strong id="promo_rank" class="text-green-600"></strong></p>
        <div class="mb-4">
          <label class="block text-xs font-bold text-gray-500 mb-1">生效日期 (證書日期)</label>
          <input type="date" id="promo_date" class="w-full border rounded-lg px-3 py-2 text-sm" value="${new Date().toISOString().slice(0,10)}">
        </div>
        <div class="flex gap-3">
          <button onclick="confirmPromote()" class="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm">確認晉升</button>
          <button onclick="document.getElementById('promoteModal').classList.add('hidden')" class="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm">取消</button>
        </div>
      </div>
    </div>

    <script>
      const MEMBER_ID = '${id}';
      let targetRank = '';

      // 切換細項完成狀態
      async function toggleReq(reqId, checked) {
        try {
          await fetch('/api/members/' + MEMBER_ID + '/toggle-requirement', {
            method: 'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ requirement_id: reqId, completed: checked })
          });
          // 重新整理以更新狀態顏色
          location.reload();
        } catch(e) { alert('更新失敗'); }
      }

      // 切換專科章狀態
      async function toggleBadge(badgeId, obtained) {
        try {
          await fetch('/api/members/' + MEMBER_ID + '/toggle-badge', {
            method: 'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ badge_id: badgeId, obtained: obtained })
          });
          location.reload();
        } catch(e) { alert('更新失敗'); }
      }

      function promote(rank, isAllDone) {
        if (!isAllDone && !confirm('此階段尚有未完成的項目，確定要強制晉升嗎？')) return;
        targetRank = rank;
        document.getElementById('promo_rank').innerText = rank;
        document.getElementById('promoteModal').classList.remove('hidden');
      }

      async function confirmPromote() {
        const date = document.getElementById('promo_date').value;
        if(!date) return alert('請選擇日期');
        
        const res = await fetch('/api/admin/members/' + MEMBER_ID + '/promote', {
          method: 'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ rank_to: targetRank, approved_date: date })
        });
        if(res.ok) location.reload();
        else alert('晉升失敗');
      }

      async function editRankDate(rankName, oldDate) {
        const newDate = prompt('修改生效日期 (YYYY-MM-DD)', oldDate);
        // 這裡需要找到對應的 record ID (這裡為了簡化直接用 API 查或重新整理，因為前端沒存 record ID)
        // 實際應該把 record ID 傳給前端。
        // 為了快速實作，這裡用提示。
        alert('請前往「進程/榮譽」列表頁面進行詳細修改。');
      }
    </script>
  `

  return c.html(adminLayout(`成員：${member.chinese_name}`, `
    <div class="mb-4 flex justify-between items-center">
      <a href="/admin/members" class="text-sm text-gray-500 hover:text-gray-700">← 返回列表</a>
      <div class="flex gap-2 bg-white rounded-lg p-1 shadow-sm border">
        <a href="?tab=info" class="px-4 py-1.5 rounded-md text-sm font-medium ${tab==='info'?'bg-green-100 text-green-700':'text-gray-500 hover:bg-gray-50'}">基本資料</a>
        <a href="?tab=advancement" class="px-4 py-1.5 rounded-md text-sm font-medium ${tab==='advancement'?'bg-green-100 text-green-700':'text-gray-500 hover:bg-gray-50'}">進程與專科章</a>
      </div>
    </div>
    ${tab === 'advancement' ? contentAdv : contentInfo}
  `))
})

// ===================== 舊成員詳細頁面 (已重構，此為佔位) =====================
adminRoutes.get('/members-legacy/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const member = await db.prepare(`SELECT * FROM members WHERE id=?`).bind(id).first() as any
  if (!member) return c.redirect('/admin/members')

  // 取得年度在籍記錄（歷史）
  const enrollments = await db.prepare(`
    SELECT * FROM member_enrollments WHERE member_id=? AND is_active=1 ORDER BY year_label DESC
  `).bind(id).all()

  // 取得目前年度
  const yearSetting = await db.prepare(`SELECT value FROM site_settings WHERE key='current_year_label'`).first() as any
  const currentYear = yearSetting?.value || '114'
  const currentEnrollment = (enrollments.results as any[]).find(e => e.year_label === currentYear) || null

  const progress = await db.prepare(`
    SELECT * FROM progress_records WHERE member_id=? ORDER BY awarded_at DESC
  `).bind(id).all()

  const attendance = await db.prepare(`
    SELECT ar.*, ats.title, ats.date, ats.section, ats.topic
    FROM attendance_records ar
    JOIN attendance_sessions ats ON ats.id = ar.session_id
    WHERE ar.member_id=?
    ORDER BY ats.date DESC LIMIT 20
  `).bind(id).all()

  const leaves = await db.prepare(`
    SELECT * FROM leave_requests WHERE member_id=? ORDER BY created_at DESC
  `).bind(id).all()

  const leaderAwards = await db.prepare(`
    SELECT mla.*, la.name as award_name, la.category, la.level
    FROM member_leader_awards mla
    JOIN leader_awards la ON la.id = mla.award_id
    WHERE mla.member_id=?
    ORDER BY la.level ASC
  `).bind(id).all()

  // 出席統計
  const totalSessions = attendance.results.length
  const presentCount = attendance.results.filter((r: any) => r.status === 'present').length
  const attendRate = totalSessions > 0 ? Math.round(presentCount / totalSessions * 100) : 0

  const statusBadge = (s: string) => {
    const map: Record<string,string> = {present:'bg-green-100 text-green-700',absent:'bg-red-100 text-red-700',leave:'bg-yellow-100 text-yellow-700',late:'bg-orange-100 text-orange-700'}
    const label: Record<string,string> = {present:'出席',absent:'缺席',leave:'請假',late:'遲到'}
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[s]||'bg-gray-100 text-gray-600'}">${label[s]||s}</span>`
  }

  const progressRows = progress.results.map((r: any) => `
    <div class="flex items-center gap-3 py-2 border-b last:border-0">
      <span class="px-2 py-0.5 rounded-full text-xs ${r.record_type==='rank'?'bg-purple-100 text-purple-700':r.record_type==='badge'?'bg-blue-100 text-blue-700':'bg-orange-100 text-orange-700'}">
        ${r.record_type==='rank'?'晉級':r.record_type==='badge'?'徽章':'成就'}
      </span>
      <span class="text-sm font-medium">${r.award_name}</span>
      <span class="text-xs text-gray-400 ml-auto">${r.year_label ? r.year_label+'學年' : ''} ${r.awarded_at ? r.awarded_at.substring(0,10) : ''}</span>
    </div>
  `).join('')

  const attendanceRows = attendance.results.map((r: any) => `
    <tr class="hover:bg-gray-50 border-b">
      <td class="px-3 py-2 text-sm">${r.date}</td>
      <td class="px-3 py-2 text-sm">${r.title}</td>
      <td class="px-3 py-2">${statusBadge(r.status)}</td>
      <td class="px-3 py-2 text-xs text-gray-400">${r.note || ''}</td>
    </tr>
  `).join('')

  const leaderAwardRows = leaderAwards.results.map((r: any) => `
    <div class="flex items-center gap-3 py-2 border-b last:border-0">
      <span class="w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-bold">${r.level}</span>
      <span class="text-sm font-medium">${r.award_name}</span>
      <span class="text-xs text-gray-400 ml-auto">${r.year_label ? r.year_label+'學年' : ''}</span>
      <button onclick="deleteLeaderAward('${r.id}')" class="text-red-400 hover:text-red-600 text-xs ml-2">🗑</button>
    </div>
  `).join('')

  const sections = ['童軍','行義童軍','羅浮童軍','服務員','幼童軍','稚齡童軍']
  const ranks = ['',
    '見習童軍','初級童軍','中級童軍','高級童軍','獅級童軍','長城童軍','國花童軍',
    // 行義童軍與童軍共用相同階級名稱
    '見習羅浮','授銜羅浮','服務羅浮'
  ]

  return c.html(adminLayout(`成員：${member.chinese_name}`, `
    <div class="mb-4">
      <a href="/admin/members" class="text-sm text-green-700 hover:underline">← 返回成員列表</a>
    </div>

    <div class="grid grid-cols-3 gap-6">
      <!-- 左：基本資料 -->
      <div class="col-span-1 space-y-4">
        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-start justify-between mb-4">
            <div>
              <div class="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-2xl font-bold text-green-700">${member.chinese_name.charAt(0)}</div>
            </div>
            <button onclick="document.getElementById('edit-modal').classList.remove('hidden')" class="text-blue-600 hover:text-blue-800 text-xs">✏️ 編輯</button>
          </div>
          <div class="text-xl font-bold text-gray-800">${member.chinese_name}</div>
          ${member.english_name ? `<div class="text-sm text-gray-400">${member.english_name}</div>` : ''}
          <div class="mt-3 space-y-2">
            <div class="flex justify-between text-sm"><span class="text-gray-500">組別</span><span class="font-medium">${currentEnrollment?.section || member.section}</span></div>
            <div class="flex justify-between text-sm"><span class="text-gray-500">小隊</span><span>${currentEnrollment?.unit_name || member.unit_name||'-'}</span></div>
            <div class="flex justify-between text-sm"><span class="text-gray-500">職位</span><span>${currentEnrollment?.role_name || member.role_name||'-'}</span></div>
            <div class="flex justify-between text-sm"><span class="text-gray-500">進程</span><span>${currentEnrollment?.rank_level || member.rank_level||'-'}</span></div>
            <div class="flex justify-between text-sm"><span class="text-gray-500">所屬團</span><span>${member.troop||'-'}</span></div>
            <div class="flex justify-between text-sm"><span class="text-gray-500">性別</span><span>${member.gender||'-'}</span></div>
            ${member.phone ? `<div class="flex justify-between text-sm"><span class="text-gray-500">電話</span><span>${member.phone}</span></div>` : ''}
            ${member.email ? `<div class="flex justify-between text-sm"><span class="text-gray-500">Email</span><a href="mailto:${member.email}" class="text-blue-600 text-xs">${member.email}</a></div>` : ''}
            ${member.parent_name ? `<div class="flex justify-between text-sm"><span class="text-gray-500">家長</span><span>${member.parent_name}</span></div>` : ''}
          </div>
        </div>

        <!-- 年度在籍 -->
        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="text-sm font-semibold text-gray-700 mb-3">📅 歷年在籍記錄</div>
          ${(enrollments.results as any[]).length === 0
            ? '<p class="text-xs text-gray-400 text-center py-3">尚無年度在籍記錄</p>'
            : `<div class="space-y-2">${(enrollments.results as any[]).map(e => `
              <div class="flex items-center justify-between text-xs border-b pb-1">
                <span class="font-medium text-gray-700">${e.year_label}學年</span>
                <span class="text-gray-500">${e.section||'-'} ｜ ${e.unit_name||'-'} ｜ ${e.role_name||'-'}</span>
                ${e.rank_level ? `<span class="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">${e.rank_level}</span>` : ''}
              </div>`).join('')}</div>`
          }
          <a href="/admin/members?year=${currentYear}" class="block mt-3 text-xs text-center text-green-700 hover:underline">→ 管理 ${currentYear} 學年名冊</a>
        </div>

        <!-- 出席統計 -->
        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="text-sm font-semibold text-gray-700 mb-3">📊 出席統計</div>
          <div class="grid grid-cols-3 gap-3 text-center">
            <div><div class="text-2xl font-bold text-green-700">${presentCount}</div><div class="text-xs text-gray-400">出席</div></div>
            <div><div class="text-2xl font-bold text-red-500">${totalSessions - presentCount}</div><div class="text-xs text-gray-400">缺席</div></div>
            <div><div class="text-2xl font-bold ${attendRate>=80?'text-green-600':attendRate>=60?'text-yellow-600':'text-red-500'}">${attendRate}%</div><div class="text-xs text-gray-400">出席率</div></div>
          </div>
        </div>
      </div>

      <!-- 右：詳細資訊 -->
      <div class="col-span-2 space-y-4">
        <!-- 進程/榮譽 -->
        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="text-sm font-semibold text-gray-700">🏅 進程/榮譽記錄</div>
            <button onclick="document.getElementById('add-prog-modal').classList.remove('hidden')" class="text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded-lg">+ 新增</button>
          </div>
          <div>${progressRows || '<div class="text-sm text-gray-400 py-4 text-center">尚無進程記錄</div>'}</div>
        </div>

        <!-- 領袖獎項 -->
        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="text-sm font-semibold text-gray-700">🌟 領袖/晉級進程</div>
            <button onclick="document.getElementById('add-la-modal').classList.remove('hidden')" class="text-xs bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1 rounded-lg">+ 新增</button>
          </div>
          <div>${leaderAwardRows || '<div class="text-sm text-gray-400 py-4 text-center">尚無領袖獎項記錄</div>'}</div>
        </div>

        <!-- 出席記錄 -->
        <div class="bg-white rounded-xl shadow-sm p-5">
          <div class="text-sm font-semibold text-gray-700 mb-3">📅 近期出席記錄（最近20筆）</div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="px-3 py-2 text-left text-xs text-gray-500">日期</th>
                  <th class="px-3 py-2 text-left text-xs text-gray-500">場次</th>
                  <th class="px-3 py-2 text-left text-xs text-gray-500">狀態</th>
                  <th class="px-3 py-2 text-left text-xs text-gray-500">備注</th>
                </tr>
              </thead>
              <tbody>
                ${attendanceRows || '<tr><td colspan="4" class="py-4 text-center text-gray-400">尚無出席記錄</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- 編輯成員 Modal -->
    <div id="edit-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto p-6">
        <h3 class="text-lg font-bold mb-4">編輯成員資料</h3>
        ${memberFormFields('edit')}
        <div class="flex gap-3 mt-4">
          <button onclick="saveMemberEdit()" class="flex-1 bg-green-700 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-medium">儲存</button>
          <button onclick="document.getElementById('edit-modal').classList.add('hidden')" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg text-sm">取消</button>
        </div>
      </div>
    </div>

    <!-- 新增進程 Modal -->
    <div id="add-prog-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 class="text-lg font-bold mb-4">新增進程/榮譽記錄</h3>
        <div class="space-y-3">
          <div><label class="block text-xs font-medium text-gray-700 mb-1">類型</label>
            <select id="prog-type" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="rank">晉級</option><option value="badge">徽章</option><option value="achievement">成就</option>
            </select>
          </div>
          <div><label class="block text-xs font-medium text-gray-700 mb-1">獎項名稱 *</label>
            <input id="prog-award" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例：高級童軍">
          </div>
          <div><label class="block text-xs font-medium text-gray-700 mb-1">學年度</label>
            <input id="prog-year" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="115">
          </div>
          <div><label class="block text-xs font-medium text-gray-700 mb-1">日期</label>
            <input id="prog-date" type="date" class="w-full border rounded-lg px-3 py-2 text-sm">
          </div>
          <div><label class="block text-xs font-medium text-gray-700 mb-1">備注</label>
            <textarea id="prog-notes" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm"></textarea>
          </div>
        </div>
        <div class="flex gap-3 mt-4">
          <button onclick="addProgress()" class="flex-1 bg-green-700 text-white py-2 rounded-lg text-sm">儲存</button>
          <button onclick="document.getElementById('add-prog-modal').classList.add('hidden')" class="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm">取消</button>
        </div>
      </div>
    </div>

    <!-- 新增領袖獎項 Modal -->
    <div id="add-la-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 class="text-lg font-bold mb-4">新增領袖進程獎項</h3>
        <div class="space-y-3">
          <div><label class="block text-xs font-medium text-gray-700 mb-1">獎項</label>
            <select id="la-award" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="la_rank1">初級童軍（Lv.1）</option>
              <option value="la_rank2">中級童軍（Lv.2）</option>
              <option value="la_rank3">高級童軍（Lv.3）</option>
              <option value="la_rank4">獅級童軍（Lv.4）</option>
              <option value="la_rank5">長城童軍（Lv.5）</option>
              <option value="la_rank6">國花童軍（Lv.6）</option>
              <option value="la_rank7">見習羅浮（Lv.7）</option>
              <option value="la_rank8">授銜羅浮（Lv.8）</option>
              <option value="la_rank9">服務羅浮（Lv.9）</option>
              <option value="la_senior1">行義初級（Lv.1）</option>
              <option value="la_senior2">行義中級（Lv.2）</option>
              <option value="la_senior3">行義高級（Lv.3）</option>
            </select>
          </div>
          <div><label class="block text-xs font-medium text-gray-700 mb-1">學年度</label>
            <input id="la-year" type="text" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="115">
          </div>
          <div><label class="block text-xs font-medium text-gray-700 mb-1">備注</label>
            <textarea id="la-notes" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm"></textarea>
          </div>
        </div>
        <div class="flex gap-3 mt-4">
          <button onclick="addLeaderAward()" class="flex-1 bg-yellow-600 text-white py-2 rounded-lg text-sm">儲存</button>
          <button onclick="document.getElementById('add-la-modal').classList.add('hidden')" class="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm">取消</button>
        </div>
      </div>
    </div>

    <script>
    const MEMBER_ID = '${member.id}'
    const MEMBER_DATA = ${JSON.stringify({
      chinese_name: member.chinese_name,
      english_name: member.english_name,
      gender: member.gender,
      section: member.section,
      unit_name: member.unit_name,
      role_name: member.role_name,
      rank_level: member.rank_level,
      troop: member.troop,
      phone: member.phone,
      email: member.email,
      parent_name: member.parent_name,
      notes: member.notes
    })}

    // 填入編輯表單
    document.addEventListener('DOMContentLoaded', () => {
      Object.keys(MEMBER_DATA).forEach(k => {
        const el = document.getElementById('edit-' + k)
        if (el) el.value = MEMBER_DATA[k] || ''
      })
    })

    async function saveMemberEdit() {
      const data = {}
      ['chinese_name','english_name','gender','section','unit_name','role_name','rank_level','troop','phone','email','parent_name','notes'].forEach(k => {
        data[k] = document.getElementById('edit-' + k).value
      })
      const res = await fetch('/api/members/' + MEMBER_ID, { method: 'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) })
      if (res.ok) location.reload(); else alert('儲存失敗')
    }

    async function addProgress() {
      const award = document.getElementById('prog-award').value.trim()
      if (!award) { alert('請填寫獎項名稱'); return }
      const res = await fetch('/api/progress', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          member_id: MEMBER_ID,
          record_type: document.getElementById('prog-type').value,
          award_name: award,
          year_label: document.getElementById('prog-year').value || null,
          awarded_at: document.getElementById('prog-date').value || null,
          notes: document.getElementById('prog-notes').value || null
        })
      })
      if (res.ok) location.reload(); else alert('新增失敗')
    }

    async function addLeaderAward() {
      const awardId = document.getElementById('la-award').value
      const res = await fetch('/api/leader-awards/member', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          member_id: MEMBER_ID,
          award_id: awardId,
          year_label: document.getElementById('la-year').value || null,
          notes: document.getElementById('la-notes').value || null
        })
      })
      const data = await res.json()
      if (data.success) location.reload(); else alert(data.error || '新增失敗')
    }

    async function deleteLeaderAward(id) {
      if (!confirm('確定刪除？')) return
      await fetch('/api/leader-awards/member/' + id, { method: 'DELETE' })
      location.reload()
    }
    </script>
  `))
})

// ===================== 統計報表頁面 =====================
adminRoutes.get('/stats', authMiddleware, async (c) => {
  const db = c.env.DB

  // 各組別人數
  const sectionStats = await db.prepare(`
    SELECT section, COUNT(*) as count FROM members WHERE membership_status='ACTIVE' GROUP BY section ORDER BY count DESC
  `).all()

  // 總人數
  const total = await db.prepare(`SELECT COUNT(*) as c FROM members WHERE membership_status='ACTIVE'`).first() as any

  // 近期活動出席率（最近10場）
  const recentSessions = await db.prepare(`
    SELECT ats.title, ats.date, ats.section,
      COUNT(ar.id) as total_count,
      SUM(CASE WHEN ar.status='present' THEN 1 ELSE 0 END) as present_count
    FROM attendance_sessions ats
    LEFT JOIN attendance_records ar ON ar.session_id = ats.id
    GROUP BY ats.id ORDER BY ats.date DESC LIMIT 10
  `).all()

  // 進程統計
  const progressStats = await db.prepare(`
    SELECT record_type, COUNT(*) as count FROM progress_records GROUP BY record_type
  `).all()

  // 最近10筆進程
  const recentProgress = await db.prepare(`
    SELECT pr.*, m.chinese_name, m.section FROM progress_records pr
    JOIN members m ON m.id = pr.member_id
    ORDER BY pr.awarded_at DESC LIMIT 10
  `).all()

  // 教練人數
  const coachTotal = await db.prepare(`SELECT COUNT(*) as c FROM coach_members`).first() as any

  // 各組別出席率
  const sectionColors: Record<string,string> = {'童軍':'bg-blue-500','行義童軍':'bg-green-500','羅浮童軍':'bg-purple-500','全體':'bg-gray-400'}

  const sectionCards = sectionStats.results.map((s: any) => `
    <div class="bg-white rounded-xl shadow-sm p-5 text-center">
      <div class="text-3xl font-bold text-green-700">${s.count}</div>
      <div class="text-sm text-gray-600 mt-1">${s.section}</div>
    </div>
  `).join('')

  const sessionRows = recentSessions.results.map((s: any) => {
    const rate = s.total_count > 0 ? Math.round(s.present_count / s.total_count * 100) : 0
    return `
      <tr class="border-b hover:bg-gray-50">
        <td class="px-4 py-2 text-sm">${s.date}</td>
        <td class="px-4 py-2 text-sm">${s.title}</td>
        <td class="px-4 py-2 text-sm">${s.section}</td>
        <td class="px-4 py-2 text-sm">${s.present_count}/${s.total_count}</td>
        <td class="px-4 py-2">
          <div class="flex items-center gap-2">
            <div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div class="h-full rounded-full ${rate>=80?'bg-green-500':rate>=60?'bg-yellow-400':'bg-red-400'}" style="width:${rate}%"></div>
            </div>
            <span class="text-xs font-medium ${rate>=80?'text-green-600':rate>=60?'text-yellow-600':'text-red-500'}">${rate}%</span>
          </div>
        </td>
      </tr>
    `
  }).join('')

  const progressTypeMap: Record<string,string> = {rank:'晉級',badge:'徽章',achievement:'成就'}
  const progressTypeColor: Record<string,string> = {rank:'text-purple-700 bg-purple-50',badge:'text-blue-700 bg-blue-50',achievement:'text-orange-700 bg-orange-50'}
  const progressCards = progressStats.results.map((p: any) => `
    <div class="rounded-xl p-4 text-center ${progressTypeColor[p.record_type]||'bg-gray-50 text-gray-700'}">
      <div class="text-2xl font-bold">${p.count}</div>
      <div class="text-xs mt-1">${progressTypeMap[p.record_type]||p.record_type}</div>
    </div>
  `).join('')

  const recentProgressRows = recentProgress.results.map((r: any) => `
    <div class="flex items-center gap-3 py-2 border-b last:border-0">
      <span class="px-2 py-0.5 rounded-full text-xs ${r.record_type==='rank'?'bg-purple-100 text-purple-700':r.record_type==='badge'?'bg-blue-100 text-blue-700':'bg-orange-100 text-orange-700'}">
        ${progressTypeMap[r.record_type]||r.record_type}
      </span>
      <span class="text-sm font-medium">${r.chinese_name}</span>
      <span class="text-sm text-gray-600">${r.award_name}</span>
      <span class="text-xs text-gray-400 ml-auto">${r.awarded_at ? r.awarded_at.substring(0,10) : '-'}</span>
    </div>
  `).join('')

  return c.html(adminLayout('統計報表', `
    <!-- 總覽卡片 -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-xl shadow-sm p-5 text-center">
        <div class="text-3xl font-bold text-green-700">${total?.c || 0}</div>
        <div class="text-sm text-gray-500 mt-1">在籍成員</div>
      </div>
      ${sectionCards}
      <div class="bg-white rounded-xl shadow-sm p-5 text-center">
        <div class="text-3xl font-bold text-blue-600">${coachTotal?.c || 0}</div>
        <div class="text-sm text-gray-500 mt-1">教練人數</div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-6">
      <!-- 近期出席率 -->
      <div class="bg-white rounded-xl shadow-sm p-5">
        <h3 class="font-semibold text-gray-800 mb-4">📅 近期場次出席率</h3>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50 border-b">
              <tr>
                <th class="px-4 py-2 text-left text-xs text-gray-500">日期</th>
                <th class="px-4 py-2 text-left text-xs text-gray-500">場次</th>
                <th class="px-4 py-2 text-left text-xs text-gray-500">組別</th>
                <th class="px-4 py-2 text-left text-xs text-gray-500">人數</th>
                <th class="px-4 py-2 text-left text-xs text-gray-500">出席率</th>
              </tr>
            </thead>
            <tbody>
              ${sessionRows || '<tr><td colspan="5" class="py-4 text-center text-gray-400">尚無出席記錄</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 右側：進程統計 + 最近進程 -->
      <div class="space-y-4">
        <div class="bg-white rounded-xl shadow-sm p-5">
          <h3 class="font-semibold text-gray-800 mb-4">🏅 進程統計</h3>
          <div class="grid grid-cols-3 gap-3">${progressCards || '<div class="col-span-3 text-center text-sm text-gray-400">尚無進程記錄</div>'}</div>
        </div>
        <div class="bg-white rounded-xl shadow-sm p-5">
          <h3 class="font-semibold text-gray-800 mb-4">🌟 最近進程記錄</h3>
          <div>${recentProgressRows || '<div class="text-sm text-gray-400 text-center py-2">尚無記錄</div>'}</div>
        </div>
      </div>
    </div>
  `))
})

// ===================== 請假審核管理 =====================
adminRoutes.get('/leaves', authMiddleware, async (c) => {
  const db = c.env.DB
  const statusFilter = c.req.query('status') || 'pending'

  const leaves = await db.prepare(`
    SELECT lr.*, m.chinese_name, m.section,
      COALESCE(as2.title, '自訂日期') as session_title, as2.date as session_date
    FROM leave_requests lr
    JOIN members m ON m.id = lr.member_id
    LEFT JOIN attendance_sessions as2 ON as2.id = lr.session_id
    ${statusFilter !== 'all' ? 'WHERE lr.status = ?' : ''}
    ORDER BY lr.created_at DESC LIMIT 100
  `).bind(...(statusFilter !== 'all' ? [statusFilter] : [])).all()

  const counts = await db.prepare(`
    SELECT status, COUNT(*) as cnt FROM leave_requests GROUP BY status
  `).all()
  const countMap: Record<string, number> = {}
  counts.results.forEach((r: any) => { countMap[r.status] = r.cnt })

  const statusLabel: Record<string, string> = { pending: '待審核', approved: '已核准', rejected: '未核准' }
  const leaveTypeLabel: Record<string, string> = { official: '⚡公假', sick: '🏥病假', personal: '📝事假', other: '📌其他' }
  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800'
  }

  return c.html(adminLayout('請假審核', `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-800">請假申請審核</h1>
      <div class="flex gap-2 text-sm">
        <span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full">待審：${countMap.pending || 0}</span>
        <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full">核准：${countMap.approved || 0}</span>
        <span class="bg-red-100 text-red-800 px-3 py-1 rounded-full">拒絕：${countMap.rejected || 0}</span>
      </div>
    </div>

    <!-- 篩選 tabs -->
    <div class="flex gap-2 mb-4 border-b">
      ${['all','pending','approved','rejected'].map(s => `
      <a href="/admin/leaves?status=${s}" class="px-4 py-2 text-sm font-medium ${statusFilter === s ? 'border-b-2 border-green-600 text-green-700' : 'text-gray-500 hover:text-gray-700'}">
        ${s === 'all' ? '全部' : statusLabel[s]} ${s !== 'all' && countMap[s] ? `(${countMap[s]})` : ''}
      </a>`).join('')}
    </div>

    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">成員</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">例會/日期</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">假別</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">原因</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">狀態</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          ${leaves.results.length === 0 ? `<tr><td colspan="6" class="py-8 text-center text-gray-400">尚無請假申請</td></tr>` :
            leaves.results.map((l: any) => `
            <tr class="hover:bg-gray-50" id="leave-${l.id}">
              <td class="px-4 py-3">
                <div class="font-medium text-gray-800 text-sm">${l.chinese_name}</div>
                <div class="text-xs text-gray-400">${l.section}</div>
              </td>
              <td class="px-4 py-3">
                <div class="text-sm text-gray-700">${l.session_title}</div>
                <div class="text-xs text-gray-400">${l.date}</div>
              </td>
              <td class="px-4 py-3 text-sm">${leaveTypeLabel[l.leave_type] || l.leave_type}</td>
              <td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">${l.reason || '-'}</td>
              <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[l.status] || 'bg-gray-100 text-gray-700'}">
                  ${statusLabel[l.status] || l.status}
                </span>
                ${l.admin_note ? `<div class="text-xs text-blue-600 mt-1">${l.admin_note}</div>` : ''}
              </td>
              <td class="px-4 py-3">
                ${l.status === 'pending' ? `
                <div class="flex gap-1">
                  <button onclick="reviewLeave('${l.id}','approved')"
                    class="bg-green-600 hover:bg-green-500 text-white text-xs px-2 py-1 rounded transition-colors">
                    ✓ 核准
                  </button>
                  <button onclick="reviewLeave('${l.id}','rejected')"
                    class="bg-red-500 hover:bg-red-400 text-white text-xs px-2 py-1 rounded transition-colors">
                    ✗ 拒絕
                  </button>
                </div>` : `
                <button onclick="reviewLeave('${l.id}','pending')"
                  class="text-gray-400 hover:text-gray-600 text-xs px-2 py-1 border rounded transition-colors">
                  重設
                </button>`}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <script>
    async function reviewLeave(id, status) {
      let admin_note = ''
      if (status === 'rejected') {
        admin_note = prompt('拒絕原因（選填）') || ''
      }
      const res = await fetch('/api/admin/leaves/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_note })
      })
      const r = await res.json()
      if (r.success) {
        const row = document.getElementById('leave-' + id)
        if (row) {
          const statusTd = row.querySelector('td:nth-child(5)')
          const colors = { approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800', pending: 'bg-yellow-100 text-yellow-800' }
          const labels = { approved: '已核准', rejected: '未核准', pending: '待審核' }
          statusTd.innerHTML = '<span class="px-2 py-0.5 rounded-full text-xs font-medium ' + (colors[status]||'') + '">' + (labels[status]||status) + '</span>' + (admin_note ? '<div class="text-xs text-blue-600 mt-1">' + admin_note + '</div>' : '')
          row.querySelector('td:nth-child(6)').innerHTML = '<span class="text-xs text-gray-400">已更新</span>'
        }
      } else { alert('操作失敗：' + r.error) }
    }
    </script>
  `))
})

// ===================== 晉升申請審核 =====================
adminRoutes.get('/advancement', authMiddleware, async (c) => {
  const db = c.env.DB
  const statusFilter = c.req.query('status') || 'pending'

  const applications = await db.prepare(`
    SELECT aa.*, m.chinese_name, m.section, m.rank_level
    FROM advancement_applications aa
    JOIN members m ON m.id = aa.member_id
    ${statusFilter !== 'all' ? 'WHERE aa.status = ?' : ''}
    ORDER BY aa.created_at DESC LIMIT 100
  `).bind(...(statusFilter !== 'all' ? [statusFilter] : [])).all()

  const counts = await db.prepare(`
    SELECT status, COUNT(*) as cnt FROM advancement_applications GROUP BY status
  `).all()
  const countMap: Record<string, number> = {}
  counts.results.forEach((r: any) => { countMap[r.status] = r.cnt })

  const statusLabel: Record<string, string> = {
    pending: '待審核', reviewing: '審核中', approved: '已通過', rejected: '未通過'
  }
  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    reviewing: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800'
  }

  return c.html(adminLayout('晉升審核', `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-800">晉升申請審核</h1>
      <a href="/admin/advancement/requirements" class="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
        <i class="fas fa-cog"></i>晉升條件管理
      </a>
    </div>

    <!-- 篩選 tabs -->
    <div class="flex gap-2 mb-4 border-b flex-wrap">
      ${['all','pending','reviewing','approved','rejected'].map(s => `
      <a href="/admin/advancement?status=${s}" class="px-4 py-2 text-sm font-medium ${statusFilter === s ? 'border-b-2 border-green-600 text-green-700' : 'text-gray-500 hover:text-gray-700'}">
        ${s === 'all' ? '全部' : statusLabel[s]} ${s !== 'all' && countMap[s] ? `(${countMap[s]})` : ''}
      </a>`).join('')}
    </div>

    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">成員</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">晉升路徑</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">申請日期</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">狀態</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          ${applications.results.length === 0 ? `<tr><td colspan="5" class="py-8 text-center text-gray-400">尚無晉升申請</td></tr>` :
            applications.results.map((a: any) => `
            <tr class="hover:bg-gray-50" id="adv-${a.id}">
              <td class="px-4 py-3">
                <div class="font-medium text-gray-800 text-sm">${a.chinese_name}</div>
                <div class="text-xs text-gray-400">${a.section} · 目前：${a.rank_level || '-'}</div>
              </td>
              <td class="px-4 py-3">
                <span class="text-sm font-medium text-gray-800">${a.rank_from}</span>
                <span class="text-gray-400 mx-2">→</span>
                <span class="text-sm font-bold text-green-700">${a.rank_to}</span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">${a.apply_date}</td>
              <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[a.status] || 'bg-gray-100'}">
                  ${statusLabel[a.status] || a.status}
                </span>
                ${a.admin_notes ? `<div class="text-xs text-blue-600 mt-1 max-w-xs truncate">${a.admin_notes}</div>` : ''}
              </td>
              <td class="px-4 py-3">
                <div class="flex gap-1 flex-wrap">
                  ${a.status === 'pending' ? `<button onclick="setAdvStatus('${a.id}','reviewing')" class="bg-blue-500 hover:bg-blue-400 text-white text-xs px-2 py-1 rounded">🔍 審核中</button>` : ''}
                  ${a.status !== 'approved' ? `<button onclick="setAdvStatus('${a.id}','approved')" class="bg-green-600 hover:bg-green-500 text-white text-xs px-2 py-1 rounded">✓ 通過</button>` : ''}
                  ${a.status !== 'rejected' ? `<button onclick="setAdvStatus('${a.id}','rejected')" class="bg-red-500 hover:bg-red-400 text-white text-xs px-2 py-1 rounded">✗ 拒絕</button>` : ''}
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <script>
    async function setAdvStatus(id, status) {
      let admin_notes = ''
      if (status === 'rejected') {
        admin_notes = prompt('拒絕說明（選填）') || ''
      } else if (status === 'approved') {
        admin_notes = prompt('審核備注（選填）') || ''
      }
      const res = await fetch('/api/admin/advancement/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_notes })
      })
      const r = await res.json()
      if (r.success) {
        location.reload()
      } else { alert('操作失敗：' + r.error) }
    }
    </script>
  `))
})

// ===================== 晉升條件管理 =====================
adminRoutes.get('/advancement/requirements', authMiddleware, async (c) => {
  const db = c.env.DB
  const sectionFilter = c.req.query('section') || '童軍'
  const versionFilter = c.req.query('version') || ''

  // 取得所有版本（distinct version_year）
  const versionsRes = await db.prepare(`
    SELECT DISTINCT version_year FROM advancement_requirements
    WHERE version_year IS NOT NULL AND version_year != ''
    ORDER BY version_year DESC
  `).all()
  const versions: string[] = versionsRes.results.map((v: any) => v.version_year)

  // 如果沒指定版本，使用最新版本或全部
  const currentVersion = versionFilter || (versions.length > 0 ? versions[0] : '')

  // 取得該組別所有啟用條件（按 rank_to 分組顯示，仿截圖設計）
  const requirements = await db.prepare(`
    SELECT * FROM advancement_requirements
    WHERE section = ? AND is_active = 1
    ${currentVersion ? 'AND version_year = ?' : ''}
    ORDER BY rank_from, display_order, id
  `).bind(sectionFilter, ...(currentVersion ? [currentVersion] : [])).all()

  // 按 rank_to（目標階級）分組 — 顯示「要到達這個階段需要做什麼」
  const groupsByTarget: Record<string, any[]> = {}
  requirements.results.forEach((r: any) => {
    const key = r.rank_to
    if (!groupsByTarget[key]) groupsByTarget[key] = []
    groupsByTarget[key].push(r)
  })

  // 從各條件取得所有不重複的 rank_from / rank_to 組合（給新增表單的下拉選單用）
  const rankPairs = await db.prepare(`
    SELECT DISTINCT rank_from, rank_to FROM advancement_requirements
    WHERE section = ? AND is_active = 1 ORDER BY rank_from
  `).bind(sectionFilter).all()

  // 各組別正確的階級名稱（依升級順序排列）
  // 童軍 & 行義童軍：使用相同體系；羅浮童軍：3 階段
  const sectionRanks: Record<string, { rank: string; from: string }[]> = {
    '童軍': [
      { rank: '初級童軍', from: '見習童軍' },
      { rank: '中級童軍', from: '初級童軍' },
      { rank: '高級童軍', from: '中級童軍' },
      { rank: '獅級童軍', from: '高級童軍' },
      { rank: '長城童軍', from: '獅級童軍' },
      { rank: '國花童軍', from: '長城童軍' },
    ],
    '行義童軍': [
      { rank: '初級童軍', from: '見習童軍' },
      { rank: '中級童軍', from: '初級童軍' },
      { rank: '高級童軍', from: '中級童軍' },
      { rank: '獅級童軍', from: '高級童軍' },
      { rank: '長城童軍', from: '獅級童軍' },
      { rank: '國花童軍', from: '長城童軍' },
    ],
    '羅浮童軍': [
      { rank: '授銜羅浮', from: '見習羅浮' },
      { rank: '服務羅浮', from: '授銜羅浮' },
    ],
  }
  const rankPairsDefault = sectionRanks[sectionFilter] || []
  const targetRanks = rankPairsDefault.map(p => p.rank)
  // 建立 rank_to → rank_from 的映射（預設值）
  const rankFromMap: Record<string,string> = {}
  rankPairsDefault.forEach(p => { rankFromMap[p.rank] = p.from })

  // 所有目標階段（已有條件 + 預設，按正確順序排列）
  const extraTargets = Object.keys(groupsByTarget).filter(t => !targetRanks.includes(t))
  const allTargets = [...targetRanks, ...extraTargets]

  const reqTypeOptions = [
    { value: 'attendance', label: '出席', icon: '📅' },
    { value: 'service',    label: '服務', icon: '🤝' },
    { value: 'badge',      label: '技能章', icon: '🏅' },
    { value: 'test',       label: '測驗考核', icon: '📋' },
    { value: 'camp',       label: '露營', icon: '🏕️' },
    { value: 'other',      label: '其他', icon: '⭐' },
  ]

  const reqTypeMap: Record<string, { label: string; icon: string }> = {}
  reqTypeOptions.forEach(t => { reqTypeMap[t.value] = { label: t.label, icon: t.icon } })

  // 計算各組統計
  const totalCount = requirements.results.length

  return c.html(adminLayout('進程標準設定', `
    <style>
      .req-card { transition: box-shadow .15s; }
      .req-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.08); }
      .edit-form { display:none; }
      .edit-form.active { display:block; }
      .stage-header { background: linear-gradient(135deg, #f0fdf4, #dcfce7); }
    </style>

    <!-- 頁面標題區 -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <a href="/admin/advancement" class="hover:text-green-600">晉升管理</a>
          <span>/</span>
          <span class="text-gray-700 font-medium">進程標準設定</span>
        </div>
        <h1 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <i class="fas fa-tasks text-green-600"></i>進程標準設定
        </h1>
        <p class="text-gray-500 text-sm mt-0.5">設定各階段升級所需達成的標準項目，會員可在個人頁面查看升級進度</p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <button onclick="document.getElementById('copyVersionModal').classList.remove('hidden')"
          class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-sm">
          <i class="fas fa-copy"></i>複製版本
        </button>
        <button onclick="toggleNewStageForm()"
          class="bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-sm">
          <i class="fas fa-plus"></i>新增標準
        </button>
      </div>
    </div>

    <!-- 版本選擇器 + 組別切換 tabs -->
    <div class="flex flex-col sm:flex-row gap-3 mb-5">
      <!-- 版本選擇 -->
      ${versions.length > 0 ? `
      <div class="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 w-fit">
        <i class="fas fa-layer-group text-gray-400 text-xs"></i>
        <span class="text-xs text-gray-500 font-medium">版本：</span>
        <select onchange="location.href='/admin/advancement/requirements?section=${encodeURIComponent(sectionFilter)}&version='+this.value"
          class="text-sm font-semibold text-gray-700 bg-transparent focus:outline-none cursor-pointer">
          ${versions.map(v => `<option value="${v}" ${v === currentVersion ? 'selected' : ''}>${v} 學年版</option>`).join('')}
        </select>
        ${currentVersion ? `<span class="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">${requirements.results.length} 條</span>` : ''}
      </div>` : ''}

      <!-- 組別切換 tabs -->
      <div class="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        ${['童軍','行義童軍','羅浮童軍'].map(s => `
        <a href="/admin/advancement/requirements?section=${encodeURIComponent(s)}${currentVersion ? '&version=' + currentVersion : ''}"
          class="px-5 py-2 rounded-lg text-sm font-medium transition-all ${sectionFilter === s
            ? 'bg-white text-green-700 shadow-sm font-semibold'
            : 'text-gray-500 hover:text-gray-700'}">
          ${s === '童軍' ? '🏕️' : s === '行義童軍' ? '🔰' : '⚜️'} ${s}
        </a>`).join('')}
      </div>
    </div>

    <!-- 複製版本 Modal -->
    <div id="copyVersionModal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div class="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 text-white">
          <h3 class="font-bold text-lg flex items-center gap-2"><i class="fas fa-copy"></i>複製進程標準版本</h3>
          <p class="text-blue-100 text-sm mt-0.5">將某個學年版本的標準複製到另一個學年</p>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">來源版本（從哪個學年複製）</label>
            <select id="copy_from_version"
              class="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
              ${versions.length > 0 ? versions.map(v => `<option value="${v}" ${v === currentVersion ? 'selected' : ''}>${v} 學年版（${v}）</option>`).join('') : '<option value="">尚無版本</option>'}
            </select>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">目標版本（複製到哪個學年）</label>
            <input id="copy_to_version" type="text"
              placeholder="例如：115 或 116（4位數字）"
              class="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
              value="${(() => { const latest = versions[0] ? String(parseInt(versions[0])+1) : ''; return latest })()} ">
            <p class="text-xs text-gray-400 mt-1">輸入目標學年度數字（如 116），若該版本已存在會跳過重複項目</p>
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">複製範圍</label>
            <div class="flex gap-3">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="copy_scope" value="all" checked class="accent-blue-600">
                <span class="text-sm text-gray-700">所有組別</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="copy_scope" value="section" class="accent-blue-600">
                <span class="text-sm text-gray-700">僅目前組別（${sectionFilter}）</span>
              </label>
            </div>
          </div>
          <div id="copyVersionMsg"></div>
          <div class="flex gap-3 pt-2">
            <button onclick="executeCopyVersion()"
              class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <i class="fas fa-copy"></i>確認複製
            </button>
            <button onclick="document.getElementById('copyVersionModal').classList.add('hidden')"
              class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm transition-colors">
              取消
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增標準表單 (頂部大表單) -->
    <div id="newStageForm" class="hidden mb-5 bg-white rounded-2xl shadow-sm border-2 border-green-200 overflow-hidden">
      <div class="bg-gradient-to-r from-green-600 to-emerald-500 px-6 py-4 text-white">
        <h3 class="font-bold text-lg flex items-center gap-2">
          <i class="fas fa-plus-circle"></i>新增進程標準
        </h3>
        <p class="text-green-100 text-sm">為 <strong>${sectionFilter}</strong> 新增一項晉升標準</p>
      </div>
      <div class="p-6">
        <div class="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">目標階段 <span class="text-red-500">*</span></label>
            <select id="new_rank_to" onchange="onRankToChange(this.value)"
              class="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none transition-colors bg-white">
              <option value="">選擇進程階段...</option>
              ${allTargets.map(t => `<option value="${t}">${t}${rankFromMap[t]?' (從'+rankFromMap[t]+'升)':''}</option>`).join('')}
              <option value="__custom__">＋ 自訂階段名稱</option>
            </select>
            <input id="new_rank_to_custom" type="text" placeholder="輸入自訂階段名稱"
              class="hidden w-full mt-2 border-2 border-green-300 rounded-xl px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">前置階段（自動帶入，可修改）</label>
            <input id="new_rank_from" type="text" placeholder="選擇目標階段後自動帶入"
              class="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none transition-colors">
          </div>
        </div>
        <div class="mb-4">
          <label class="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">進程標準 <span class="text-red-500">*</span></label>
          <input id="new_title" type="text" placeholder="標準標題（例如：參加露營）..."
            class="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none transition-colors">
        </div>
        <div class="mb-4">
          <label class="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">細部描述（選填）</label>
          <textarea id="new_desc" rows="2" placeholder="詳細說明（選填）..."
            class="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none transition-colors resize-none"></textarea>
        </div>
        <div class="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">類型</label>
            <select id="new_type" class="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none bg-white">
              ${reqTypeOptions.map(t => `<option value="${t.value}">${t.icon} ${t.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">需達到次數</label>
            <input id="new_count" type="number" value="1" min="1"
              class="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none text-center">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">單位</label>
            <input id="new_unit" type="text" value="次" placeholder="次/小時/章"
              class="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none">
          </div>
        </div>
        <div class="flex items-center gap-2 mb-4">
          <label class="relative inline-flex items-center cursor-pointer">
            <input id="new_mandatory" type="checkbox" checked class="sr-only peer">
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
          <span class="text-sm text-gray-700 font-medium">必填條件（未達成不可晉升）</span>
        </div>
        <div id="newFormMsg" class="mb-3"></div>
        <div class="flex gap-3">
          <button onclick="submitNewStandard()"
            class="bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
            <i class="fas fa-plus"></i>新增標準
          </button>
          <button onclick="toggleNewStageForm()"
            class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2.5 rounded-xl text-sm transition-colors">
            取消
          </button>
        </div>
      </div>
    </div>

    <!-- 進程標準列表（按階段分組） -->
    ${allTargets.length === 0 ? `
    <div class="bg-white rounded-2xl p-12 text-center">
      <div class="text-6xl mb-4">📋</div>
      <h3 class="text-lg font-semibold text-gray-700 mb-2">尚未設定進程標準</h3>
      <p class="text-gray-400 mb-4">點擊右上角「新增標準」開始設定 ${sectionFilter} 的升級條件</p>
    </div>` : allTargets.map(targetRank => {
      const reqs = groupsByTarget[targetRank] || []
      return `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 mb-4 overflow-hidden req-card" id="stage-${targetRank.replace(/\s/g,'_')}">
      <!-- 階段標題列 -->
      <div class="stage-header px-5 py-4 flex items-center justify-between border-b border-green-100">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            ${allTargets.indexOf(targetRank) + 1}
          </div>
          <div>
            <h3 class="font-bold text-gray-800 text-base">${targetRank}</h3>
            <p class="text-xs text-gray-500">${reqs.length > 0 ? `${reqs.length} 項標準` : '尚未設定標準'}</p>
          </div>
        </div>
        <button onclick="showInlineAdd('${targetRank}')"
          class="text-green-600 hover:text-green-800 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors flex items-center gap-1 border border-green-200">
          <i class="fas fa-plus"></i>新增
        </button>
      </div>

      <!-- 內嵌新增表單（初始隱藏） -->
      <div id="inline-add-${targetRank.replace(/\s/g,'_')}" class="hidden bg-green-50 border-b border-green-100 px-5 py-4">
        <div class="grid sm:grid-cols-2 gap-3 mb-3">
          <div class="sm:col-span-2">
            <input type="text" id="ia_title_${targetRank.replace(/\s/g,'_')}" placeholder="進程標準標題 *"
              class="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500">
          </div>
          <div class="sm:col-span-2">
            <textarea id="ia_desc_${targetRank.replace(/\s/g,'_')}" rows="2" placeholder="細部描述（選填）..."
              class="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 resize-none"></textarea>
          </div>
          <div>
            <select id="ia_type_${targetRank.replace(/\s/g,'_')}"
              class="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
              ${reqTypeOptions.map(t => `<option value="${t.value}">${t.icon} ${t.label}</option>`).join('')}
            </select>
          </div>
          <div class="flex gap-2">
            <input id="ia_count_${targetRank.replace(/\s/g,'_')}" type="number" value="1" min="1" placeholder="次數"
              class="w-20 border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none text-center">
            <input id="ia_unit_${targetRank.replace(/\s/g,'_')}" type="text" value="次" placeholder="單位"
              class="flex-1 border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <label class="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
              <input id="ia_mandatory_${targetRank.replace(/\s/g,'_')}" type="checkbox" checked class="rounded">必填
            </label>
          </div>
        </div>
        <div class="flex gap-2">
          <button onclick="submitInlineAdd('${targetRank}')"
            class="bg-green-600 hover:bg-green-500 text-white text-xs px-4 py-1.5 rounded-lg transition-colors">
            <i class="fas fa-check mr-1"></i>新增
          </button>
          <button onclick="document.getElementById('inline-add-${targetRank.replace(/\s/g,'_')}').classList.add('hidden')"
            class="bg-white text-gray-500 text-xs px-4 py-1.5 rounded-lg border hover:bg-gray-50 transition-colors">
            取消
          </button>
        </div>
      </div>

      <!-- 標準項目列表 -->
      <div id="reqs-${targetRank.replace(/\s/g,'_')}">
        ${reqs.length === 0 ? `
        <div class="py-6 text-center text-gray-400 text-sm" id="empty-${targetRank.replace(/\s/g,'_')}">
          <i class="fas fa-clipboard-list mr-1"></i>點擊「新增」來設定此階段的晉升標準
        </div>` : reqs.map((r: any) => renderReqRow(r, reqTypeMap)).join('')}
      </div>
    </div>`
    }).join('')}

    <!-- 編輯 Modal -->
    <div id="editModal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div class="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 text-white flex items-center justify-between">
          <h3 class="font-bold text-lg flex items-center gap-2"><i class="fas fa-edit"></i>編輯標準</h3>
          <button onclick="closeEdit()" class="text-white/70 hover:text-white"><i class="fas fa-times text-lg"></i></button>
        </div>
        <div class="p-6 space-y-4">
          <input type="hidden" id="edit_id">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">標準標題 <span class="text-red-500">*</span></label>
            <input id="edit_title" type="text" class="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">細部描述</label>
            <textarea id="edit_desc" rows="3" class="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none resize-none"></textarea>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">類型</label>
              <select id="edit_type" class="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white">
                ${reqTypeOptions.map(t => `<option value="${t.value}">${t.icon} ${t.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">數量</label>
              <input id="edit_count" type="number" min="1" class="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none text-center">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">單位</label>
              <input id="edit_unit" type="text" class="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
            </div>
          </div>
          <label class="flex items-center gap-3 cursor-pointer">
            <div class="relative">
              <input id="edit_mandatory" type="checkbox" class="sr-only peer">
              <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </div>
            <span class="text-sm text-gray-700 font-medium">必填條件</span>
          </label>
          <div id="editMsg"></div>
          <div class="flex gap-3 pt-2">
            <button onclick="saveEdit()"
              class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
              <i class="fas fa-save mr-1"></i>儲存變更
            </button>
            <button onclick="closeEdit()"
              class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm transition-colors">
              取消
            </button>
          </div>
        </div>
      </div>
    </div>

    <script>
    // ===== 資料（Server-rendered）=====
    const SECTION = '${sectionFilter}';
    const CURRENT_VERSION = '${currentVersion}';
    const RANK_PAIRS = ${JSON.stringify(rankPairs.results)};
    // 階段 → 前置階段 的對應表
    const RANK_FROM_MAP = ${JSON.stringify(rankFromMap)};

    // ===== 複製版本 =====
    async function executeCopyVersion() {
      const msgEl = document.getElementById('copyVersionMsg');
      const fromVersion = document.getElementById('copy_from_version').value.trim();
      const toVersion = document.getElementById('copy_to_version').value.trim();
      const scope = document.querySelector('input[name="copy_scope"]:checked').value;

      if (!fromVersion) { msgEl.innerHTML = '<p class="text-sm text-red-500">請選擇來源版本</p>'; return; }
      if (!toVersion) { msgEl.innerHTML = '<p class="text-sm text-red-500">請輸入目標版本（例如：116）</p>'; return; }
      if (fromVersion === toVersion) { msgEl.innerHTML = '<p class="text-sm text-red-500">來源與目標版本不能相同</p>'; return; }
      if (!/^[0-9]{2,4}$/.test(toVersion)) { msgEl.innerHTML = '<p class="text-sm text-red-500">版本格式不正確，請輸入2~4位數字</p>'; return; }

      msgEl.innerHTML = '<p class="text-sm text-gray-400"><i class="fas fa-spinner fa-spin mr-1"></i>複製中...</p>';
      try {
        const body = { from_version: fromVersion, to_version: toVersion };
        if (scope === 'section') body.section = SECTION;

        const res = await fetch('/api/admin/advancement-requirements/clone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const r = await res.json();
        if (r.success) {
          msgEl.innerHTML = '<p class="text-sm text-green-600">✅ 成功複製 ' + r.copied_count + ' 條標準到 ' + toVersion + ' 學年版！</p>';
          setTimeout(() => {
            document.getElementById('copyVersionModal').classList.add('hidden');
            location.href = '/admin/advancement/requirements?section=' + encodeURIComponent(SECTION) + '&version=' + toVersion;
          }, 1500);
        } else {
          msgEl.innerHTML = '<p class="text-sm text-red-500">複製失敗：' + (r.error || '未知錯誤') + '</p>';
        }
      } catch(e) {
        msgEl.innerHTML = '<p class="text-sm text-red-500">網路錯誤，請稍後再試</p>';
      }
    }

    // 點擊 Modal 外部關閉
    document.getElementById('copyVersionModal').addEventListener('click', function(e) {
      if (e.target === this) this.classList.add('hidden');
    });

    // ===== 目標階段選擇自動帶入前置階段 =====
    function onRankToChange(val) {
      const custom = document.getElementById('new_rank_to_custom');
      const fromEl = document.getElementById('new_rank_from');
      if (val === '__custom__') {
        custom.classList.remove('hidden');
        custom.focus();
        fromEl.value = '';
      } else {
        custom.classList.add('hidden');
        // 自動帶入前置階段
        if (RANK_FROM_MAP[val]) {
          fromEl.value = RANK_FROM_MAP[val];
        } else {
          fromEl.value = '';
        }
      }
    }

    // ===== 頂部新增表單 =====
    function toggleNewStageForm() {
      const f = document.getElementById('newStageForm');
      f.classList.toggle('hidden');
      if (!f.classList.contains('hidden')) document.getElementById('new_title').focus();
    }

    async function submitNewStandard() {
      const msg = document.getElementById('newFormMsg');
      const rankToSel = document.getElementById('new_rank_to').value;
      const rankToCustom = document.getElementById('new_rank_to_custom').value.trim();
      const rank_to = rankToSel === '__custom__' ? rankToCustom : rankToSel;
      const data = {
        section: SECTION,
        rank_from: document.getElementById('new_rank_from').value.trim() || '',
        rank_to: rank_to,
        requirement_type: document.getElementById('new_type').value,
        title: document.getElementById('new_title').value.trim(),
        description: document.getElementById('new_desc').value.trim(),
        required_count: parseInt(document.getElementById('new_count').value) || 1,
        unit: document.getElementById('new_unit').value.trim() || '次',
        is_mandatory: document.getElementById('new_mandatory').checked
      };
      if (!rank_to) { showMsg('newFormMsg', '請選擇目標階段', 'red'); return; }
      if (!data.title) { showMsg('newFormMsg', '請填寫標準標題', 'red'); return; }
      showMsg('newFormMsg', '送出中...', 'gray');
      const res = await fetch('/api/admin/advancement-requirements', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)
      });
      const r = await res.json();
      if (r.success) location.reload();
      else showMsg('newFormMsg', '失敗：' + r.error, 'red');
    }

    // ===== 各階段內嵌快速新增 =====
    function showInlineAdd(rank) {
      const key = rank.replace(/\\s/g,'_');
      const el = document.getElementById('inline-add-' + key);
      el.classList.remove('hidden');
      document.getElementById('ia_title_' + key).focus();
    }

    async function submitInlineAdd(rank) {
      const key = rank.replace(/\\s/g,'_');
      const title = document.getElementById('ia_title_' + key).value.trim();
      if (!title) { alert('請填寫標準標題'); return; }
      const data = {
        section: SECTION,
        rank_from: RANK_FROM_MAP[rank] || '', rank_to: rank,
        requirement_type: document.getElementById('ia_type_' + key).value,
        title: title,
        description: document.getElementById('ia_desc_' + key).value.trim(),
        required_count: parseInt(document.getElementById('ia_count_' + key).value) || 1,
        unit: document.getElementById('ia_unit_' + key).value.trim() || '次',
        is_mandatory: document.getElementById('ia_mandatory_' + key).checked
      };
      const res = await fetch('/api/admin/advancement-requirements', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)
      });
      const r = await res.json();
      if (r.success) location.reload();
      else alert('新增失敗：' + r.error);
    }

    // ===== 編輯 Modal =====
    function openEdit(id, title, desc, type, count, unit, mandatory) {
      document.getElementById('edit_id').value = id;
      document.getElementById('edit_title').value = title;
      document.getElementById('edit_desc').value = desc || '';
      document.getElementById('edit_type').value = type;
      document.getElementById('edit_count').value = count;
      document.getElementById('edit_unit').value = unit;
      document.getElementById('edit_mandatory').checked = mandatory == 1 || mandatory === true;
      document.getElementById('editMsg').innerHTML = '';
      document.getElementById('editModal').classList.remove('hidden');
    }

    function closeEdit() { document.getElementById('editModal').classList.add('hidden'); }

    async function saveEdit() {
      const id = document.getElementById('edit_id').value;
      const data = {
        title: document.getElementById('edit_title').value.trim(),
        description: document.getElementById('edit_desc').value.trim(),
        requirement_type: document.getElementById('edit_type').value,
        required_count: parseInt(document.getElementById('edit_count').value) || 1,
        unit: document.getElementById('edit_unit').value.trim() || '次',
        is_mandatory: document.getElementById('edit_mandatory').checked,
        is_active: true
      };
      if (!data.title) { showMsg('editMsg', '請填寫標準標題', 'red'); return; }
      showMsg('editMsg', '儲存中...', 'gray');
      const res = await fetch('/api/admin/advancement-requirements/' + id, {
        method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)
      });
      const r = await res.json();
      if (r.success) location.reload();
      else showMsg('editMsg', '失敗：' + r.error, 'red');
    }

    // ===== 刪除 =====
    async function deleteReq(id, title) {
      if (!confirm('確定要刪除「' + title + '」？\\n此操作無法復原')) return;
      const res = await fetch('/api/admin/advancement-requirements/' + id, { method:'DELETE' });
      const r = await res.json();
      if (r.success) {
        const row = document.getElementById('req-' + id);
        if (row) row.remove();
      } else alert('刪除失敗：' + r.error);
    }

    // ===== 工具函數 =====
    function showMsg(elId, msg, color) {
      const colors = { red: 'text-red-500', green: 'text-green-600', gray: 'text-gray-400' };
      document.getElementById(elId).innerHTML = '<p class="text-sm ' + (colors[color]||'text-gray-500') + '">' + msg + '</p>';
    }

    // 點擊 Modal 外部關閉
    document.getElementById('editModal').addEventListener('click', function(e) {
      if (e.target === this) closeEdit();
    });
    </script>
  `))
})

// 輔助函數：渲染一行標準項目
function renderReqRow(r: any, reqTypeMap: Record<string, { label: string; icon: string }>) {
  const typeInfo = reqTypeMap[r.requirement_type] || { label: r.requirement_type, icon: '⭐' }
  const countText = r.required_count > 1 ? `${r.required_count} ${r.unit}` : `1 ${r.unit}`
  return `
  <div class="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 group" id="req-${r.id}">
    <div class="flex items-center gap-3 min-w-0 flex-1">
      <span class="text-lg flex-shrink-0">${typeInfo.icon}</span>
      <div class="min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm font-medium text-gray-800">${r.title}</span>
          ${r.required_count > 1 ? `<span class="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">${countText}</span>` : ''}
          ${!r.is_mandatory ? `<span class="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">選填</span>` : ''}
        </div>
        ${r.description ? `<div class="text-xs text-gray-400 mt-0.5 truncate max-w-sm">${r.description}</div>` : ''}
      </div>
    </div>
    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-3">
      <button onclick="openEdit('${r.id}', ${JSON.stringify(r.title)}, ${JSON.stringify(r.description || '')}, '${r.requirement_type}', ${r.required_count}, '${r.unit}', ${r.is_mandatory})"
        class="text-blue-500 hover:text-blue-700 text-xs px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors font-medium">
        編輯
      </button>
      <button onclick="deleteReq('${r.id}', ${JSON.stringify(r.title)})"
        class="text-red-400 hover:text-red-600 text-xs px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors font-medium">
        刪除
      </button>
    </div>
  </div>`
}



// ===================== 會員帳號管理 =====================
adminRoutes.get('/member-accounts', authMiddleware, async (c) => {
  const db = c.env.DB

  const accounts = await db.prepare(`
    SELECT ma.id, ma.username, ma.is_active, ma.last_login, ma.created_at,
      m.id as member_id, m.chinese_name, m.section, m.rank_level
    FROM member_accounts ma
    JOIN members m ON m.id = ma.member_id
    ORDER BY m.section, m.chinese_name
  `).all()

  // 取得尚未建立帳號的成員
  const noAccount = await db.prepare(`
    SELECT id, chinese_name, section, rank_level
    FROM members
    WHERE id NOT IN (SELECT member_id FROM member_accounts)
      AND membership_status = 'ACTIVE'
    ORDER BY section, chinese_name
  `).all()

  return c.html(adminLayout('會員帳號管理', `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-800">會員帳號管理</h1>
      <button onclick="document.getElementById('newAccountForm').classList.toggle('hidden')"
        class="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
        <i class="fas fa-plus"></i>建立新帳號
      </button>
    </div>

    <!-- 新建帳號表單 -->
    <div id="newAccountForm" class="hidden bg-white rounded-xl shadow-sm border border-green-200 p-5 mb-4">
      <h3 class="font-semibold text-gray-800 mb-4">建立會員帳號</h3>
      <div class="grid sm:grid-cols-3 gap-4">
        <div class="sm:col-span-1">
          <label class="block text-xs font-medium text-gray-600 mb-1">選擇成員</label>
          <select id="new_member" class="w-full border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="">-- 選擇成員 --</option>
            ${noAccount.results.map((m: any) => `<option value="${m.id}">${m.chinese_name} (${m.section})</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">登入帳號</label>
          <input id="new_username" type="text" placeholder="英文/數字" class="w-full border border-gray-300 rounded px-3 py-2 text-sm">
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">初始密碼</label>
          <input id="new_pw" type="text" placeholder="至少 6 字元" class="w-full border border-gray-300 rounded px-3 py-2 text-sm">
        </div>
      </div>
      <div id="newAccMsg" class="mt-3"></div>
      <div class="flex gap-2 mt-4">
        <button onclick="createAccount()" class="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg">建立</button>
        <button onclick="document.getElementById('newAccountForm').classList.add('hidden')"
          class="bg-gray-100 text-gray-700 text-sm px-4 py-2 rounded-lg">取消</button>
      </div>
    </div>

    <!-- 帳號列表 -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">成員</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">帳號</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">最後登入</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">狀態</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          ${accounts.results.length === 0 ? `<tr><td colspan="5" class="py-8 text-center text-gray-400">尚無會員帳號</td></tr>` :
            accounts.results.map((a: any) => `
            <tr class="hover:bg-gray-50" id="acc-${a.id}">
              <td class="px-4 py-3">
                <div class="font-medium text-gray-800 text-sm">${a.chinese_name}</div>
                <div class="text-xs text-gray-400">${a.section} · ${a.rank_level || '-'}</div>
              </td>
              <td class="px-4 py-3 text-sm font-mono text-gray-700">${a.username}</td>
              <td class="px-4 py-3 text-xs text-gray-400">${a.last_login ? a.last_login.substring(0,16) : '從未登入'}</td>
              <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded-full text-xs font-medium ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                  ${a.is_active ? '✓ 啟用' : '✗ 停用'}
                </span>
              </td>
              <td class="px-4 py-3">
                <div class="flex gap-1">
                  <button onclick="resetPw('${a.id}')" class="bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded transition-colors">
                    <i class="fas fa-key"></i> 重設密碼
                  </button>
                  <button onclick="toggleStatus('${a.id}', ${a.is_active})"
                    class="${a.is_active ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-green-50 hover:bg-green-100 text-green-600'} text-xs px-2 py-1 rounded transition-colors">
                    ${a.is_active ? '停用' : '啟用'}
                  </button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    ${noAccount.results.length > 0 ? `
    <div class="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
      <h3 class="text-sm font-medium text-yellow-800 mb-2">⚠️ 尚未開通帳號的成員（${noAccount.results.length} 位）</h3>
      <div class="flex flex-wrap gap-2">
        ${noAccount.results.map((m: any) => `<span class="bg-white text-xs text-gray-700 px-2 py-1 rounded-full border">${m.chinese_name} (${m.section})</span>`).join('')}
      </div>
    </div>` : ''}

    <script>
    async function createAccount() {
      const msg = document.getElementById('newAccMsg')
      const data = {
        member_id: document.getElementById('new_member').value,
        username: document.getElementById('new_username').value.trim(),
        password: document.getElementById('new_pw').value
      }
      if (!data.member_id || !data.username || !data.password) {
        msg.innerHTML = '<p class="text-red-500 text-sm">請填寫所有欄位</p>'; return
      }
      if (data.password.length < 6) {
        msg.innerHTML = '<p class="text-red-500 text-sm">密碼至少 6 字元</p>'; return
      }
      const res = await fetch('/api/admin/member-accounts', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(data)
      })
      const r = await res.json()
      if (r.success) { location.reload() }
      else { msg.innerHTML = '<p class="text-red-500 text-sm">失敗：' + r.error + '</p>' }
    }
    async function resetPw(id) {
      const pw = prompt('請輸入新密碼（至少 6 字元）')
      if (!pw || pw.length < 6) { alert('密碼至少 6 字元'); return }
      const res = await fetch('/api/admin/member-accounts/' + id + '/password', {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ password: pw })
      })
      const r = await res.json()
      if (r.success) alert('✅ 密碼已重設')
      else alert('失敗：' + r.error)
    }
    async function toggleStatus(id, current) {
      const res = await fetch('/api/admin/member-accounts/' + id + '/status', {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ is_active: !current })
      })
      const r = await res.json()
      if (r.success) location.reload()
      else alert('失敗：' + r.error)
    }
    </script>
  `))
})

// =====================================================================
// 公假管理後台
// =====================================================================
adminRoutes.get('/official-leave', authMiddleware, async (c) => {
  const db = c.env.DB
  const tab = c.req.query('tab') || 'pending'

  // 1. 申請列表
  let q = `
    SELECT ola.*, m.chinese_name, m.section, m.unit_name
    FROM official_leave_applications ola
    JOIN members m ON m.id = ola.member_id
  `
  const params: any[] = []
  if (tab !== 'all') { q += ` WHERE ola.status = ?`; params.push(tab) }
  q += ` ORDER BY ola.leave_date DESC, ola.created_at DESC LIMIT 200`
  const applications = await db.prepare(q).bind(...params).all()

  // 2. 各狀態計數
  const counts = await db.prepare(`
    SELECT status, COUNT(*) as cnt FROM official_leave_applications GROUP BY status
  `).all()
  const cMap: Record<string,number> = {}
  counts.results.forEach((r:any) => { cMap[r.status] = r.cnt })

  const statusLabel: Record<string,string> = { pending:'⏳ 待審核', approved:'✅ 已核准', rejected:'❌ 未通過', uploaded:'📤 已上傳' }
  const statusClass: Record<string,string> = { pending:'bg-yellow-100 text-yellow-800', approved:'bg-green-100 text-green-800', rejected:'bg-red-100 text-red-800', uploaded:'bg-blue-100 text-blue-800' }

  const tabItems = [
    { key:'pending', label:'待審核' }, { key:'approved', label:'已核准' },
    { key:'rejected', label:'未通過' }, { key:'uploaded', label:'已上傳' }, { key:'all', label:'全部' }
  ]

  const appRows = applications.results.map((a:any) => {
    const ts: string[] = (() => { try{return JSON.parse(a.timeslots)}catch{return[]} })()
    return `
    <tr class="hover:bg-gray-50" id="app-${a.id}">
      <td class="px-4 py-3">
        <div class="font-medium text-sm text-gray-900">${a.chinese_name}</div>
        <div class="text-xs text-gray-400">${a.section} · ${a.unit_name||'-'}</div>
      </td>
      <td class="px-4 py-3 text-sm font-mono text-gray-700">${a.leave_date}</td>
      <td class="px-4 py-3">
        <div class="flex flex-wrap gap-1">
          ${ts.map(t=>`<span class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">${t}</span>`).join('')}
        </div>
      </td>
      <td class="px-4 py-3 text-xs text-gray-500 max-w-xs">${a.reason||'-'}</td>
      <td class="px-4 py-3">
        <span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusClass[a.status]||'bg-gray-100 text-gray-600'}">
          ${statusLabel[a.status]||a.status}
        </span>
        ${a.admin_note ? `<div class="text-xs text-blue-600 mt-1">${a.admin_note}</div>` : ''}
      </td>
      <td class="px-4 py-3 text-xs text-gray-400">${a.created_at ? a.created_at.substring(0,10) : '-'}</td>
      <td class="px-4 py-3">
        <div class="flex flex-wrap gap-1">
          ${a.status !== 'approved' ? `<button onclick="setStatus('${a.id}','approved')" class="bg-green-600 hover:bg-green-500 text-white text-xs px-2 py-1 rounded">✓ 核准</button>` : ''}
          ${a.status !== 'rejected' ? `<button onclick="setStatus('${a.id}','rejected')" class="bg-red-500 hover:bg-red-400 text-white text-xs px-2 py-1 rounded">✗ 拒絕</button>` : ''}
          ${a.status === 'approved' ? `<button onclick="setStatus('${a.id}','uploaded')" class="bg-blue-500 hover:bg-blue-400 text-white text-xs px-2 py-1 rounded">📤 已上傳</button>` : ''}
        </div>
      </td>
    </tr>`
  }).join('')

  // 3. 本週封鎖/排程管理（每週視圖）
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
  const wStart = fmtDate(weekStart), wEnd = fmtDate(weekDays[6])
  const prevW = new Date(weekStart); prevW.setDate(weekStart.getDate()-7)
  const nextW = new Date(weekStart); nextW.setDate(weekStart.getDate()+7)

  const weekEvents = await db.prepare(`
    SELECT * FROM leave_calendar_events WHERE date>=? AND date<=? ORDER BY date
  `).bind(wStart, wEnd).all()
  const blockedSet = new Set(weekEvents.results.filter((e:any)=>e.type==='blocked').map((e:any)=>e.date as string))

  const dowLabel = ['日','一','二','三','四','五','六']

  const weekGrid = weekDays.map(d => {
    const dStr = fmtDate(d)
    const isBlocked = blockedSet.has(dStr)
    const dayEv = weekEvents.results.filter((e:any) => e.date===dStr && e.type!=='blocked')
    return `
    <div class="border rounded-lg overflow-hidden">
      <div class="bg-gray-100 text-center py-2 text-sm font-bold text-gray-700">
        ${dStr.substring(5).replace('-','/')} (星期${dowLabel[d.getDay()]})
      </div>
      <div class="p-2 min-h-[80px]">
        ${dayEv.map((e:any)=>`<div class="text-xs text-gray-600 mb-1">📌 ${e.title}</div>`).join('')}
        ${isBlocked ? '<div class="text-xs text-red-600 mb-1">⛔ 已封鎖</div>' : '<div class="text-xs text-gray-300 mb-1">無</div>'}
        <button onclick="toggleBlock('${dStr}', ${!isBlocked})"
          class="${isBlocked ? 'bg-green-500 hover:bg-green-400' : 'bg-red-500 hover:bg-red-400'} text-white text-xs px-2 py-1 rounded w-full mt-1">
          ${isBlocked ? '🔓 解除封鎖' : '🔒 封鎖此日'}
        </button>
      </div>
    </div>`
  }).join('')

  // 4. 系統設定
  const settingRows = await db.prepare(`
    SELECT key, value FROM site_settings WHERE key LIKE 'official_leave%'
  `).all()
  const sMap: Record<string,string> = {}
  settingRows.results.forEach((r:any) => { sMap[r.key] = r.value })
  const semStart = sMap['official_leave_semester_start']||''
  const semEnd   = sMap['official_leave_semester_end']||''
  let allowedDays: number[] = [1,2,3,4,5]
  try { allowedDays = JSON.parse(sMap['official_leave_allowed_weekdays']||'[1,2,3,4,5]') } catch {}
  let recurringRules: any[] = []
  try { recurringRules = JSON.parse(sMap['official_leave_recurring_rules']||'[]') } catch {}

  const dowNames = ['日','一','二','三','四','五','六']
  const dowChecks = dowNames.map((n,i) =>
    `<label class="flex items-center gap-1 text-sm"><input type="checkbox" value="${i}" ${allowedDays.includes(i)?'checked':''} class="chk-dow w-4 h-4 rounded">${i===0?'星期日':i===6?'星期六':`星期${n}`}</label>`
  ).join('')

  const ruleRows = recurringRules.map((r:any,i:number) =>
    `<div class="flex items-center gap-2 flex-wrap py-1.5 border-b border-gray-50" id="rule-${i}">
      <span class="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded">週${dowNames[r.dayOfWeek]||r.dayOfWeek}</span>
      <span class="text-sm font-medium text-gray-800 flex-1">${r.title}</span>
      ${r.description ? `<span class="text-xs text-gray-400">${r.description}</span>` : ''}
      <button onclick="deleteRule(${i})" class="text-red-400 hover:text-red-600 text-xs px-2 py-0.5 rounded hover:bg-red-50">刪除</button>
    </div>`
  ).join('')

  return c.html(adminLayout('公假管理', `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <i class="fas fa-calendar-check text-blue-600"></i>公假管理
        </h1>
        <p class="text-gray-500 text-sm mt-0.5">管理成員的公假申請、行事曆封鎖與系統設定</p>
      </div>
      <a href="/member/official-leave" class="text-blue-600 hover:underline text-sm flex items-center gap-1">
        <i class="fas fa-external-link-alt"></i>公假行事曆
      </a>
    </div>

    <!-- 四個 Tab -->
    <div class="border-b mb-5">
      <div class="flex gap-0 overflow-x-auto">
        ${['pending','approved','schedule','settings'].map((t,i) => {
          const labels = ['待審核申請','行事曆管理','每週排程與封鎖','系統設定']
          return `<button onclick="switchTab('${t}')" id="tab-${t}"
            class="px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${tab===t&&i===0?'border-blue-600 text-blue-700':'border-transparent text-gray-500 hover:text-gray-700'}" onclick="switchTab('${t}')">
            ${labels[i]}
            ${t==='pending' && cMap['pending'] ? `<span class="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">${cMap['pending']}</span>` : ''}
          </button>`
        }).join('')}
      </div>
    </div>

    <!-- Tab 1: 待審核 -->
    <div id="panel-pending" class="tab-panel">
      <div class="flex gap-2 mb-4 flex-wrap">
        ${tabItems.map(t =>
          `<a href="/admin/official-leave?tab=${t.key}" class="px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${tab===t.key?'bg-blue-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
            ${t.label} ${cMap[t.key] !== undefined ? `(${cMap[t.key]})` : ''}
          </a>`
        ).join('')}
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div id="reviewMsg" class="hidden px-4 py-2 text-sm"></div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[700px]">
            <thead class="bg-gray-50 border-b">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">申請人</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">日期</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">時段</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">事由</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">狀態</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">申請日</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              ${appRows || `<tr><td colspan="7" class="py-10 text-center text-gray-400">尚無公假申請</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab 2: 行事曆事件管理 -->
    <div id="panel-calendar" class="tab-panel hidden">
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
        <h3 class="font-bold text-gray-800 mb-3 text-sm">新增行事曆事件</h3>
        <div class="grid sm:grid-cols-4 gap-3">
          <input id="ev_date" type="date" class="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" placeholder="日期">
          <select id="ev_type" class="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white">
            <option value="event">📌 一般活動</option>
            <option value="holiday">🔴 假日</option>
            <option value="exam">📋 考試</option>
            <option value="blocked">⛔ 封鎖申請</option>
          </select>
          <input id="ev_title" type="text" placeholder="標題 *" class="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
          <input id="ev_desc" type="text" placeholder="說明（選填）" class="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
        </div>
        <div id="evMsg" class="mt-2"></div>
        <button onclick="addCalendarEvent()" class="mt-3 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-xl transition-colors">
          <i class="fas fa-plus mr-1"></i>新增事件
        </button>
      </div>
      <div id="evList" class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 class="font-bold text-gray-800 mb-3 text-sm">現有行事曆事件</h3>
        <div id="evListContent">載入中...</div>
      </div>
    </div>

    <!-- Tab 3: 每週排程與封鎖 -->
    <div id="panel-schedule" class="tab-panel hidden">
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
        <h3 class="font-bold text-gray-800 mb-3">每週例行活動設定</h3>
        <div class="grid sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">星期</label>
            <select id="rule_dow" class="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:border-blue-500 focus:outline-none">
              ${dowNames.map((n,i)=>`<option value="${i}">星期${n}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">標題</label>
            <input id="rule_title" type="text" placeholder="例：國務會議"
              class="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">備註（選填）</label>
            <input id="rule_desc" type="text" placeholder="例：午休"
              class="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
          </div>
        </div>
        <button onclick="addRule()" class="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-xl">
          <i class="fas fa-plus mr-1"></i>新增
        </button>
        <div id="ruleMsg" class="mt-2 text-xs"></div>
        <div class="mt-4 border-t pt-3" id="ruleList">
          ${ruleRows || '<p class="text-gray-400 text-sm">尚無例行活動設定</p>'}
        </div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-gray-800">每週排程與封鎖管理</h3>
          <div class="flex items-center gap-3">
            <a href="/admin/official-leave?tab=schedule&week=${fmtDate(prevW)}" class="text-gray-500 hover:text-gray-700 text-sm">◀</a>
            <span class="text-sm font-medium text-gray-700">${wStart.substring(5).replace('-','/')} - ${wEnd.substring(5).replace('-','/')}</span>
            <a href="/admin/official-leave?tab=schedule&week=${fmtDate(nextW)}" class="text-gray-500 hover:text-gray-700 text-sm">▶</a>
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          ${weekGrid}
        </div>
      </div>
    </div>

    <!-- Tab 4: 系統設定 -->
    <div id="panel-settings" class="tab-panel hidden">
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 class="font-bold text-gray-800 mb-4">公假系統設定</h3>
        <div class="space-y-4 max-w-xl">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">學期開始日期</label>
              <input id="set_start" type="date" value="${semStart}"
                class="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">學期結束日期</label>
              <input id="set_end" type="date" value="${semEnd}"
                class="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
            </div>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-2">開放申請的星期幾</label>
            <div class="flex flex-wrap gap-3">${dowChecks}</div>
          </div>
          <div id="settingsMsg"></div>
          <button onclick="saveSettings()"
            class="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <i class="fas fa-save mr-1"></i>儲存設定
          </button>
        </div>
      </div>
    </div>

    <script>
    // Tab 切換
    const TAB_MAP = { pending:'panel-pending', approved:'panel-pending', rejected:'panel-pending', uploaded:'panel-pending', all:'panel-pending', calendar:'panel-calendar', schedule:'panel-schedule', settings:'panel-settings' }
    const CURRENT_TAB = '${tab}'

    function switchTab(t) {
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'))
      const panel = { pending:'panel-pending', calendar:'panel-calendar', schedule:'panel-schedule', settings:'panel-settings' }[t] || 'panel-pending'
      document.getElementById(panel).classList.remove('hidden')
      // Update tab buttons
      document.querySelectorAll('[id^="tab-"]').forEach(b => b.classList.remove('border-blue-600','text-blue-700'))
      const btn = document.getElementById('tab-' + t)
      if (btn) { btn.classList.add('border-blue-600','text-blue-700') }
      if (t === 'calendar') loadCalendarEvents()
    }

    // Init tabs
    document.querySelectorAll('[id^="tab-"]').forEach(b => {
      b.classList.remove('border-blue-600','text-blue-700')
    })
    document.getElementById('tab-pending').classList.add('border-blue-600','text-blue-700')

    // 審核操作
    async function setStatus(id, status) {
      const note = status === 'rejected' ? (prompt('拒絕原因（選填）：') || '') : ''
      const res = await fetch('/api/admin/official-leave/' + id, {
        method: 'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status, admin_note: note || null })
      })
      const r = await res.json()
      if (r.success) location.reload()
      else alert('操作失敗：' + r.error)
    }

    // 封鎖/解封
    async function toggleBlock(date, isBlocked) {
      const reason = isBlocked ? (prompt('封鎖原因（選填，例：團長有事）：') || '團長有事或不開放') : ''
      const res = await fetch('/api/admin/official-leave/toggle-block', {
        method: 'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ date, is_blocked: isBlocked, reason })
      })
      const r = await res.json()
      if (r.success) location.reload()
      else alert('操作失敗：' + r.error)
    }

    // 新增行事曆事件
    async function addCalendarEvent() {
      const date  = document.getElementById('ev_date').value
      const type  = document.getElementById('ev_type').value
      const title = document.getElementById('ev_title').value.trim()
      const desc  = document.getElementById('ev_desc').value.trim()
      if (!date || !title) { showEvMsg('請填寫日期和標題','red'); return }
      const res = await fetch('/api/admin/official-leave/calendar-event', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ date, type, title, description: desc || null })
      })
      const r = await res.json()
      if (r.success) { showEvMsg('✅ 已新增','green'); loadCalendarEvents() }
      else showEvMsg('失敗：'+r.error,'red')
    }

    function showEvMsg(msg, color) {
      const el = document.getElementById('evMsg')
      const c = { red:'text-red-500', green:'text-green-600', gray:'text-gray-400' }
      el.innerHTML = '<span class="text-sm '+(c[color]||'text-gray-500')+'">'+msg+'</span>'
    }

    async function loadCalendarEvents() {
      const el = document.getElementById('evListContent')
      el.innerHTML = '<span class="text-gray-400 text-sm">載入中...</span>'
      const res = await fetch('/api/official-leave/calendar-events')
      const r = await res.json()
      if (!r.success || r.data.length === 0) {
        el.innerHTML = '<p class="text-gray-400 text-sm">尚無行事曆事件</p>'
        return
      }
      const evTypeIcon = { blocked:'\u26d4', holiday:'\ud83d\udd34', exam:'\ud83d\udccb', event:'\ud83d\udccc' }
      el.innerHTML = r.data.map(function(e) {
        return '<div class="flex items-center justify-between py-2 border-b last:border-0" id="ev-'+e.id+'">' +
          '<div class="flex items-center gap-3">' +
          '<span class="font-mono text-xs text-gray-500">'+e.date+'</span>' +
          '<span class="text-sm">'+(evTypeIcon[e.type]||'\ud83d\udccc')+' '+e.title+'</span>' +
          (e.description ? '<span class="text-xs text-gray-400">('+e.description+')</span>' : '') +
          '</div>' +
          '<button onclick="deleteCalEvent(\'' + e.id + '\')" class="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50">\u522a\u9664</button>' +
          '</div>'
      }).join('')
    }

    async function deleteCalEvent(id) {
      if (!confirm('確定刪除此事件？')) return
      const res = await fetch('/api/admin/official-leave/calendar-event/' + id, { method:'DELETE' })
      const r = await res.json()
      if (r.success) { const el = document.getElementById('ev-'+id); if (el) el.remove() }
      else alert('刪除失敗：'+r.error)
    }

    // 每週例行規則
    let RULES = ${JSON.stringify(recurringRules)}

    function renderRules() {
      const dowN = ['日','一','二','三','四','五','六']
      const el = document.getElementById('ruleList')
      if (RULES.length === 0) { el.innerHTML = '<p class="text-gray-400 text-sm">尚無例行活動設定</p>'; return }
      el.innerHTML = RULES.map(function(r,i) {
        return '<div class="flex items-center gap-2 flex-wrap py-1.5 border-b border-gray-50">' +
          '<span class="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded">\u9031'+dowN[r.dayOfWeek]+'</span>' +
          '<span class="text-sm font-medium text-gray-800 flex-1">'+r.title+'</span>' +
          (r.description ? '<span class="text-xs text-gray-400">('+r.description+')</span>' : '') +
          '<button onclick="deleteRule('+i+')" class="text-red-400 hover:text-red-600 text-xs px-2 py-0.5 rounded hover:bg-red-50">\u522a\u9664</button>' +
          '</div>'
      }).join('')
    }

    async function addRule() {
      const dow   = parseInt(document.getElementById('rule_dow').value)
      const title = document.getElementById('rule_title').value.trim()
      const desc  = document.getElementById('rule_desc').value.trim()
      if (!title) { document.getElementById('ruleMsg').innerHTML='<span class="text-red-500">請填寫標題</span>'; return }
      const id = 'rule-' + Date.now()
      RULES.push({ id, dayOfWeek: dow, title, type:'recurring', description: desc || undefined })
      await saveRules()
      document.getElementById('rule_title').value = ''
      document.getElementById('rule_desc').value = ''
      renderRules()
    }

    async function deleteRule(idx) {
      RULES.splice(idx, 1)
      await saveRules()
      renderRules()
    }

    async function saveRules() {
      await fetch('/api/admin/official-leave/settings', {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ recurringRules: RULES })
      })
    }

    // 系統設定
    async function saveSettings() {
      const start = document.getElementById('set_start').value
      const end   = document.getElementById('set_end').value
      const dow   = [...document.querySelectorAll('.chk-dow:checked')].map(c => parseInt(c.value))
      if (!start || !end) { showSettingsMsg('請填寫學期日期','red'); return }
      showSettingsMsg('儲存中...','gray')
      const res = await fetch('/api/admin/official-leave/settings', {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ semesterStart:start, semesterEnd:end, allowedWeekdays:dow })
      })
      const r = await res.json()
      if (r.success) showSettingsMsg('✅ 設定已儲存','green')
      else showSettingsMsg('儲存失敗：'+r.error,'red')
    }
    function showSettingsMsg(msg, color) {
      const c = { red:'text-red-500', green:'text-green-600', gray:'text-gray-400' }
      document.getElementById('settingsMsg').innerHTML = '<p class="text-sm '+(c[color]||'text-gray-500')+'">'+msg+'</p>'
    }
    </script>
  `))
})
