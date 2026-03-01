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
        <div class="flex gap-2">
          <a href="/admin/activities/${a.id}/edit" class="text-blue-600 hover:text-blue-800 text-sm font-medium">編輯</a>
          <a href="/admin/activities/${a.id}/images" class="text-purple-600 hover:text-purple-800 text-sm font-medium">圖片</a>
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
            <label class="block text-sm font-medium text-gray-700 mb-1">活動日期</label>
            <input type="date" id="f-activity_date" value="${activity?.activity_date || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">日期顯示文字（可自訂，例如：2025年6月30日 - 7月2日）</label>
            <input type="text" id="f-date_display" value="${activity?.date_display || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="例：2025年6月30日 - 7月2日">
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">活動說明（中文）</label>
            <textarea id="f-description" rows="4" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="活動內容說明...">${activity?.description || ''}</textarea>
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Activity Description (English)</label>
            <textarea id="f-description_en" rows="3" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="English description...">${activity?.description_en || ''}</textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">YouTube 影片 ID</label>
            <input type="text" id="f-youtube_url" value="${activity?.youtube_url || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="例：Odi8piH1PHE（影片網址中的ID）">
            <p class="text-xs text-gray-400 mt-1">YouTube 網址：https://youtube.com/watch?v=<strong>這段</strong></p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">排序（數字越小越前面）</label>
            <input type="number" id="f-display_order" value="${activity?.display_order || 0}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">封面圖片 URL（精彩回顧相冊封面）</label>
            <input type="text" id="f-cover_image" value="${activity?.cover_image || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="https://example.com/photo.jpg">
            <p class="text-xs text-gray-400 mt-1">此圖片將作為精彩回顧頁面的相冊封面縮圖</p>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" id="f-is_published" ${activity?.is_published !== 0 ? 'checked' : ''} class="w-4 h-4 text-green-600">
            <label for="f-is_published" class="text-sm text-gray-700">發佈（顯示於前台）</label>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" id="f-show_in_highlights" ${activity?.show_in_highlights ? 'checked' : ''} class="w-4 h-4 text-amber-500">
            <label for="f-show_in_highlights" class="text-sm text-gray-700">📸 顯示在精彩回顧頁面</label>
          </div>
        </div>
        <div id="form-msg" class="hidden bg-green-50 text-green-700 border border-green-200 rounded-lg px-4 py-3 text-sm"></div>
        <div class="flex gap-3">
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
          description_en: document.getElementById('f-description_en').value,
          activity_date: document.getElementById('f-activity_date').value,
          date_display: document.getElementById('f-date_display').value,
          category: document.getElementById('f-category').value,
          youtube_url: document.getElementById('f-youtube_url').value,
          display_order: parseInt(document.getElementById('f-display_order').value) || 0,
          cover_image: document.getElementById('f-cover_image').value,
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
        <a href="/admin/attendance" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm ${title.includes('出席') ? 'bg-green-700' : ''}">
          <span>📅</span> 出席管理
        </a>
        <a href="/admin/progress" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm ${title.includes('進程') || title.includes('榮譽') ? 'bg-green-700' : ''}">
          <span>🏅</span> 進程/榮譽
        </a>
        <a href="/admin/leaves" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm ${title.includes('請假') || title.includes('公假') ? 'bg-green-700' : ''}">
          <span>📝</span> 請假審核
        </a>
        <a href="/admin/advancement" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm ${title.includes('晉升') ? 'bg-green-700' : ''}">
          <span>⬆️</span> 晉升審核
        </a>
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

// ===================== 成員管理 =====================
adminRoutes.get('/members', authMiddleware, async (c) => {
  const db = c.env.DB
  const section = c.req.query('section') || ''
  const search = c.req.query('search') || ''

  let query = `SELECT * FROM members WHERE membership_status = 'ACTIVE'`
  const params: any[] = []
  if (section) { query += ` AND section = ?`; params.push(section) }
  if (search) { query += ` AND (chinese_name LIKE ? OR english_name LIKE ?)`; params.push(`%${search}%`, `%${search}%`) }
  query += ` ORDER BY section, unit_name, chinese_name`

  const members = await db.prepare(query).bind(...params).all()
  const total = await db.prepare(`SELECT COUNT(*) as c FROM members WHERE membership_status='ACTIVE'`).first() as any

  const sectionCounts: Record<string, number> = {}
  const sc = await db.prepare(`SELECT section, COUNT(*) as c FROM members WHERE membership_status='ACTIVE' GROUP BY section`).all()
  sc.results.forEach((r: any) => { sectionCounts[r.section] = r.c })

  const sectionList = ['童軍','行義童軍','羅浮童軍','服務員','幼童軍','稚齡童軍']
  const sectionTabs = sectionList.map(s => `
    <a href="/admin/members?section=${encodeURIComponent(s)}${search ? '&search='+encodeURIComponent(search) : ''}"
      class="px-4 py-2 rounded-full text-sm font-medium transition ${section === s ? 'bg-green-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}">
      ${s} <span class="ml-1 text-xs opacity-70">${sectionCounts[s] || 0}</span>
    </a>
  `).join('')

  const rows = members.results.map((m: any) => `
    <tr class="hover:bg-gray-50 border-b">
      <td class="px-4 py-3">
        <a href="/admin/members/${m.id}" class="font-medium text-green-700 hover:text-green-900 hover:underline">${m.chinese_name}</a>
        ${m.english_name ? `<div class="text-xs text-gray-400">${m.english_name}</div>` : ''}
      </td>
      <td class="px-4 py-3 text-sm text-gray-600">${m.section}</td>
      <td class="px-4 py-3 text-sm text-gray-600">${m.unit_name || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-600">${m.role_name || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-600">${m.rank_level || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${m.gender || '-'}</td>
      <td class="px-4 py-3">
        <button onclick="editMember('${m.id}')" class="text-blue-600 hover:text-blue-800 text-xs mr-3">✏️ 編輯</button>
        <button onclick="deleteMember('${m.id}','${m.chinese_name}')" class="text-red-500 hover:text-red-700 text-xs">🗑 刪除</button>
      </td>
    </tr>
  `).join('')

  return c.html(adminLayout('成員管理', `
    <div class="flex items-center justify-between mb-4">
      <div>
        <p class="text-sm text-gray-500">共 ${total?.c || 0} 位在籍成員</p>
      </div>
      <button onclick="document.getElementById('add-member-modal').classList.remove('hidden')"
        class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">＋ 新增成員</button>
    </div>

    <!-- 搜尋 & 分類 -->
    <div class="flex flex-wrap gap-2 mb-4 items-center">
      <a href="/admin/members" class="px-4 py-2 rounded-full text-sm font-medium ${!section ? 'bg-green-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}">全部 <span class="ml-1 text-xs opacity-70">${total?.c || 0}</span></a>
      ${sectionTabs}
      <form class="ml-auto flex gap-2" method="get" action="/admin/members">
        ${section ? `<input type="hidden" name="section" value="${section}">` : ''}
        <input type="search" name="search" value="${search}" placeholder="搜尋姓名..." class="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
        <button type="submit" class="bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded-lg text-sm">搜尋</button>
      </form>
    </div>

    <!-- 成員列表 -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">姓名</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">組別</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">小隊</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">職位</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">級別</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">性別</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">操作</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="7" class="py-8 text-center text-gray-400">尚無成員資料</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- 新增成員 Modal -->
    <div id="add-member-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto p-6">
        <h3 class="text-lg font-bold mb-4">新增成員</h3>
        ${memberFormFields('add')}
        <div class="flex gap-3 mt-4">
          <button onclick="saveMember()" class="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium">新增</button>
          <button onclick="document.getElementById('add-member-modal').classList.add('hidden')" class="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm">取消</button>
        </div>
      </div>
    </div>

    <!-- 編輯成員 Modal -->
    <div id="edit-member-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto p-6">
        <h3 class="text-lg font-bold mb-4">編輯成員</h3>
        <input type="hidden" id="edit-member-id">
        ${memberFormFields('edit')}
        <div class="flex gap-3 mt-4">
          <button onclick="updateMember()" class="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium">更新</button>
          <button onclick="document.getElementById('edit-member-modal').classList.add('hidden')" class="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm">取消</button>
        </div>
      </div>
    </div>

    <script>
      async function editMember(id) {
        const res = await fetch('/api/members/' + id);
        const json = await res.json();
        const m = json.data;
        document.getElementById('edit-member-id').value = m.id;
        document.getElementById('edit-chinese_name').value = m.chinese_name || '';
        document.getElementById('edit-english_name').value = m.english_name || '';
        document.getElementById('edit-gender').value = m.gender || '';
        document.getElementById('edit-section').value = m.section || '';
        document.getElementById('edit-rank_level').value = m.rank_level || '';
        document.getElementById('edit-unit_name').value = m.unit_name || '';
        document.getElementById('edit-role_name').value = m.role_name || '';
        document.getElementById('edit-troop').value = m.troop || '';
        document.getElementById('edit-phone').value = m.phone || '';
        document.getElementById('edit-email').value = m.email || '';
        document.getElementById('edit-parent_name').value = m.parent_name || '';
        document.getElementById('edit-notes').value = m.notes || '';
        document.getElementById('edit-member-modal').classList.remove('hidden');
      }
      async function saveMember() {
        const data = getMemberFormData('add');
        if (!data.chinese_name) { alert('姓名為必填'); return; }
        const res = await fetch('/api/members', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
        if (res.ok) location.reload(); else alert('儲存失敗');
      }
      async function updateMember() {
        const id = document.getElementById('edit-member-id').value;
        const data = getMemberFormData('edit');
        const res = await fetch('/api/members/' + id, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
        if (res.ok) location.reload(); else alert('更新失敗');
      }
      async function deleteMember(id, name) {
        if (!confirm('確定要刪除成員「' + name + '」嗎？')) return;
        const res = await fetch('/api/members/' + id, { method:'DELETE' });
        if (res.ok) location.reload(); else alert('刪除失敗');
      }
      function getMemberFormData(prefix) {
        return {
          chinese_name: document.getElementById(prefix+'-chinese_name').value,
          english_name: document.getElementById(prefix+'-english_name').value,
          gender: document.getElementById(prefix+'-gender').value,
          section: document.getElementById(prefix+'-section').value,
          rank_level: document.getElementById(prefix+'-rank_level').value,
          unit_name: document.getElementById(prefix+'-unit_name').value,
          role_name: document.getElementById(prefix+'-role_name').value,
          troop: document.getElementById(prefix+'-troop').value,
          phone: document.getElementById(prefix+'-phone').value,
          email: document.getElementById(prefix+'-email').value,
          parent_name: document.getElementById(prefix+'-parent_name').value,
          notes: document.getElementById(prefix+'-notes').value,
        };
      }
    </script>
  `))
})

// ===================== 出席管理 =====================
adminRoutes.get('/attendance', authMiddleware, async (c) => {
  const db = c.env.DB
  const section = c.req.query('section') || ''

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
    <div id="add-session-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
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
              <label class="block text-sm font-medium text-gray-700 mb-1">組別</label>
              <select id="add-ses-section" class="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="junior">童軍</option>
                <option value="senior">行義童軍</option>
                <option value="rover">羅浮童軍</option>
                <option value="all">全體</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">課程主題</label>
            <input type="text" id="add-ses-topic" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="例：繩結技術">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">場次編號</label>
            <input type="number" id="add-ses-number" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="1">
          </div>
        </div>
        <div class="flex gap-3 mt-4">
          <button onclick="saveSession()" class="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium">新增（自動匯入成員）</button>
          <button onclick="document.getElementById('add-session-modal').classList.add('hidden')" class="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm">取消</button>
        </div>
      </div>
    </div>

    <script>
      async function saveSession() {
        const data = {
          title: document.getElementById('add-ses-title').value,
          date: document.getElementById('add-ses-date').value,
          section: document.getElementById('add-ses-section').value,
          topic: document.getElementById('add-ses-topic').value,
          session_number: parseInt(document.getElementById('add-ses-number').value) || null,
        };
        if (!data.title || !data.date) { alert('場次名稱和日期為必填'); return; }
        const res = await fetch('/api/attendance/sessions', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
        const json = await res.json();
        if (res.ok) { window.location.href = '/admin/attendance/' + json.id; }
        else alert('新增失敗');
      }
      async function deleteSession(id) {
        if (!confirm('確定要刪除此場次及所有出席記錄嗎？')) return;
        const res = await fetch('/api/attendance/sessions/' + id, { method:'DELETE' });
        if (res.ok) location.reload(); else alert('刪除失敗');
      }
    </script>
  `))
})

// 出席點名頁面
adminRoutes.get('/attendance/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const sessionId = c.req.param('id')
  const session = await db.prepare(`SELECT * FROM attendance_sessions WHERE id=?`).bind(sessionId).first() as any
  if (!session) return c.redirect('/admin/attendance')

  const records = await db.prepare(`
    SELECT ar.*, m.chinese_name, m.english_name, m.section, m.unit_name, m.role_name
    FROM attendance_records ar
    JOIN members m ON m.id = ar.member_id
    WHERE ar.session_id = ?
    ORDER BY m.unit_name, m.chinese_name
  `).bind(sessionId).all()

  const sectionLabel: Record<string,string> = {junior:'童軍',senior:'行義童軍',rover:'羅浮童軍',all:'全體'}
  const statusLabel: Record<string,string> = {present:'出席',absent:'缺席',leave:'公假',late:'遲到'}
  const statusColor: Record<string,string> = {present:'bg-green-100 text-green-700',absent:'bg-red-100 text-red-700',leave:'bg-blue-100 text-blue-700',late:'bg-yellow-100 text-yellow-700'}

  const rows = records.results.map((r: any) => `
    <tr class="hover:bg-gray-50 border-b" id="row-${r.member_id}">
      <td class="px-4 py-3">
        <div class="font-medium text-sm">${r.chinese_name}</div>
        ${r.english_name ? `<div class="text-xs text-gray-400">${r.english_name}</div>` : ''}
      </td>
      <td class="px-4 py-3 text-xs text-gray-500">${r.unit_name || '-'}</td>
      <td class="px-4 py-3 text-xs text-gray-500">${r.role_name || '-'}</td>
      <td class="px-4 py-3">
        <select onchange="updateRecord('${sessionId}','${r.member_id}',this.value)"
          class="border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          ${['present','absent','leave','late'].map(s => `<option value="${s}" ${r.status===s?'selected':''}>${statusLabel[s]}</option>`).join('')}
        </select>
      </td>
    </tr>
  `).join('')

  const presentCount = records.results.filter((r: any) => r.status === 'present').length
  const total = records.results.length

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
            ${session.topic ? ` ｜ 主題：${session.topic}` : ''}
          </p>
        </div>
        <div class="text-right">
          <div class="text-2xl font-bold text-green-700">${presentCount}</div>
          <div class="text-sm text-gray-500">/ ${total} 出席</div>
        </div>
      </div>
    </div>

    <div class="flex gap-2 mb-4">
      <button onclick="markAll('present')" class="bg-green-100 text-green-700 hover:bg-green-200 px-4 py-2 rounded-lg text-sm font-medium">✅ 全部出席</button>
      <button onclick="markAll('absent')" class="bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 rounded-lg text-sm font-medium">❌ 全部缺席</button>
    </div>

    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">姓名</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">小隊</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">職位</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">狀態</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="4" class="py-8 text-center text-gray-400">尚無成員記錄</td></tr>'}
        </tbody>
      </table>
    </div>

    <script>
      async function updateRecord(sessionId, memberId, status) {
        await fetch('/api/attendance/records/' + sessionId + '/' + memberId, {
          method: 'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({status})
        });
      }
      async function markAll(status) {
        const selects = document.querySelectorAll('select');
        for (const sel of selects) {
          sel.value = status;
          const parts = sel.getAttribute('onchange').match(/'([^']+)'/g);
          if (parts && parts.length >= 2) {
            const sId = parts[0].replace(/'/g,''), mId = parts[1].replace(/'/g,'');
            await updateRecord(sId, mId, status);
          }
        }
      }
    </script>
  `))
})

// ===================== 進程/榮譽管理 =====================
adminRoutes.get('/progress', authMiddleware, async (c) => {
  const db = c.env.DB
  const type = c.req.query('type') || ''

  let query = `
    SELECT pr.*, m.chinese_name, m.section
    FROM progress_records pr
    JOIN members m ON m.id = pr.member_id
    WHERE 1=1
  `
  const params: any[] = []
  if (type) { query += ` AND pr.record_type = ?`; params.push(type) }
  query += ` ORDER BY pr.awarded_at DESC`
  const records = await db.prepare(query).bind(...params).all()

  const members = await db.prepare(`SELECT id, chinese_name, section FROM members WHERE membership_status='ACTIVE' ORDER BY section, chinese_name`).all()

  const rows = records.results.map((r: any) => `
    <tr class="hover:bg-gray-50 border-b">
      <td class="px-4 py-3 font-medium text-sm">${r.chinese_name}</td>
      <td class="px-4 py-3 text-sm text-gray-600">${r.section}</td>
      <td class="px-4 py-3 text-sm">
        <span class="px-2 py-0.5 rounded-full text-xs ${r.record_type==='rank' ? 'bg-purple-100 text-purple-700' : r.record_type==='badge' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}">
          ${r.record_type==='rank'?'晉級':r.record_type==='badge'?'徽章':'成就'}
        </span>
      </td>
      <td class="px-4 py-3 text-sm font-medium">${r.award_name}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${r.year_label ? r.year_label + '學年' : '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${r.awarded_at ? r.awarded_at.substring(0,10) : '-'}</td>
      <td class="px-4 py-3">
        <button onclick="deleteProgress('${r.id}')" class="text-red-500 hover:text-red-700 text-xs">🗑 刪除</button>
      </td>
    </tr>
  `).join('')

  const typeTabs = [['','全部'],['rank','晉級'],['badge','徽章'],['achievement','成就']].map(([v,l]) => `
    <a href="/admin/progress${v ? '?type='+v : ''}" class="px-4 py-2 rounded-full text-sm font-medium transition ${type === v ? 'bg-green-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}">${l}</a>
  `).join('')

  const memberOptions = members.results.map((m: any) => `<option value="${m.id}">[${m.section}] ${m.chinese_name}</option>`).join('')

  const rankOptions = ['初級童軍','中級童軍','高級童軍','獅級童軍','長城童軍','國花童軍','見習羅浮','授銜羅浮','服務羅浮'].map(r => `<option value="${r}">${r}</option>`).join('')

  return c.html(adminLayout('進程/榮譽管理', `
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-500">記錄成員的晉級、徽章與各項榮譽</p>
      <button onclick="document.getElementById('add-progress-modal').classList.remove('hidden')"
        class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">＋ 新增記錄</button>
    </div>
    <div class="flex flex-wrap gap-2 mb-4">${typeTabs}</div>

    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">成員</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">組別</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">類型</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">獎項名稱</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">學年度</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">日期</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500">操作</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="7" class="py-8 text-center text-gray-400">尚無進程記錄</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- 新增進程 Modal -->
    <div id="add-progress-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 class="text-lg font-bold mb-4">新增進程/榮譽記錄</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">成員 *</label>
            <select id="add-prog-member" class="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">請選擇成員</option>
              ${memberOptions}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">類型</label>
            <select id="add-prog-type" class="w-full border rounded-lg px-3 py-2 text-sm" onchange="updateAwardOptions()">
              <option value="rank">晉級</option>
              <option value="badge">徽章</option>
              <option value="achievement">成就/榮譽</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">獎項名稱 *</label>
            <select id="add-prog-rank-select" class="w-full border rounded-lg px-3 py-2 text-sm">
              ${rankOptions}
            </select>
            <input type="text" id="add-prog-award-name" class="hidden w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="輸入徽章或成就名稱">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">學年度</label>
              <input type="text" id="add-prog-year" class="w-full border rounded-lg px-3 py-2 text-sm" placeholder="115">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">獲獎日期</label>
              <input type="date" id="add-prog-date" class="w-full border rounded-lg px-3 py-2 text-sm">
            </div>
          </div>
        </div>
        <div class="flex gap-3 mt-4">
          <button onclick="saveProgress()" class="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium">新增</button>
          <button onclick="document.getElementById('add-progress-modal').classList.add('hidden')" class="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm">取消</button>
        </div>
      </div>
    </div>

    <script>
      function updateAwardOptions() {
        const type = document.getElementById('add-prog-type').value;
        const rankSel = document.getElementById('add-prog-rank-select');
        const textInp = document.getElementById('add-prog-award-name');
        if (type === 'rank') { rankSel.classList.remove('hidden'); textInp.classList.add('hidden'); }
        else { rankSel.classList.add('hidden'); textInp.classList.remove('hidden'); }
      }
      async function saveProgress() {
        const type = document.getElementById('add-prog-type').value;
        const awardName = type === 'rank'
          ? document.getElementById('add-prog-rank-select').value
          : document.getElementById('add-prog-award-name').value;
        const data = {
          member_id: document.getElementById('add-prog-member').value,
          record_type: type,
          award_name: awardName,
          year_label: document.getElementById('add-prog-year').value,
          awarded_at: document.getElementById('add-prog-date').value || null,
        };
        if (!data.member_id || !data.award_name) { alert('成員和獎項名稱為必填'); return; }
        const res = await fetch('/api/progress', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
        if (res.ok) location.reload(); else alert('儲存失敗');
      }
      async function deleteProgress(id) {
        if (!confirm('確定要刪除此記錄嗎？')) return;
        const res = await fetch('/api/progress/' + id, { method:'DELETE' });
        if (res.ok) location.reload(); else alert('刪除失敗');
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
  const ranks = ['','初級童軍','中級童軍','高級童軍','獅級童軍','長城童軍','國花童軍','見習羅浮','授銜羅浮','服務羅浮']
  const roles = ['隊員','小隊長','副小隊長','群長','副群長','器材長','副器材長','行政長','副行政長','輔導長']
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
      const header = COLUMNS.join(',')
      const example = '王小明,Wang Xiaoming,男,童軍,台灣小隊,隊員,初級童軍,54團,0912345678,test@email.com,王大明,'
      const csv = '\\uFEFF' + header + '\\n' + example
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'members_template.csv'; a.click()
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

// ===================== 成員詳細頁面 =====================
adminRoutes.get('/members/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const member = await db.prepare(`SELECT * FROM members WHERE id=?`).bind(id).first() as any
  if (!member) return c.redirect('/admin/members')

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
  const ranks = ['','初級童軍','中級童軍','高級童軍','獅級童軍','長城童軍','國花童軍','見習羅浮','授銜羅浮','服務羅浮']

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
            <div class="flex justify-between text-sm"><span class="text-gray-500">組別</span><span class="font-medium">${member.section}</span></div>
            <div class="flex justify-between text-sm"><span class="text-gray-500">小隊</span><span>${member.unit_name||'-'}</span></div>
            <div class="flex justify-between text-sm"><span class="text-gray-500">職位</span><span>${member.role_name||'-'}</span></div>
            <div class="flex justify-between text-sm"><span class="text-gray-500">級別</span><span>${member.rank_level||'-'}</span></div>
            <div class="flex justify-between text-sm"><span class="text-gray-500">所屬團</span><span>${member.troop||'-'}</span></div>
            <div class="flex justify-between text-sm"><span class="text-gray-500">性別</span><span>${member.gender||'-'}</span></div>
            ${member.phone ? `<div class="flex justify-between text-sm"><span class="text-gray-500">電話</span><span>${member.phone}</span></div>` : ''}
            ${member.email ? `<div class="flex justify-between text-sm"><span class="text-gray-500">Email</span><a href="mailto:${member.email}" class="text-blue-600 text-xs">${member.email}</a></div>` : ''}
            ${member.parent_name ? `<div class="flex justify-between text-sm"><span class="text-gray-500">家長</span><span>${member.parent_name}</span></div>` : ''}
          </div>
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

  // 取得該組別所有啟用條件（按 rank_to 分組顯示，仿截圖設計）
  const requirements = await db.prepare(`
    SELECT * FROM advancement_requirements
    WHERE section = ? AND is_active = 1
    ORDER BY rank_from, display_order, id
  `).bind(sectionFilter).all()

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

  // 各組別預設的階級名稱
  const sectionRanks: Record<string, string[]> = {
    '童軍':    ['初級童軍','中級童軍','高級童軍','獅級童軍'],
    '行義童軍': ['初級行義','中級行義','高級行義','資深行義'],
    '羅浮童軍': ['初級羅浮','中級羅浮','高級羅浮','資深羅浮'],
  }
  const targetRanks = sectionRanks[sectionFilter] || []

  // 所有目標階段（已有條件 + 預設）
  const allTargets = [...new Set([...Object.keys(groupsByTarget), ...targetRanks])]

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
      <button onclick="toggleNewStageForm()"
        class="bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-sm">
        <i class="fas fa-plus"></i>新增標準
      </button>
    </div>

    <!-- 組別切換 tabs -->
    <div class="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
      ${['童軍','行義童軍','羅浮童軍'].map(s => `
      <a href="/admin/advancement/requirements?section=${encodeURIComponent(s)}"
        class="px-5 py-2 rounded-lg text-sm font-medium transition-all ${sectionFilter === s
          ? 'bg-white text-green-700 shadow-sm font-semibold'
          : 'text-gray-500 hover:text-gray-700'}">
        ${s === '童軍' ? '🏕️' : s === '行義童軍' ? '🔰' : '⚜️'} ${s}
      </a>`).join('')}
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
            <select id="new_rank_to" class="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none transition-colors bg-white">
              <option value="">選擇進程階段...</option>
              ${allTargets.map(t => `<option value="${t}">${t}</option>`).join('')}
              <option value="__custom__">＋ 自訂階段名稱</option>
            </select>
            <input id="new_rank_to_custom" type="text" placeholder="輸入自訂階段名稱"
              class="hidden w-full mt-2 border-2 border-green-300 rounded-xl px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none">
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">前置階段（選填）</label>
            <input id="new_rank_from" type="text" placeholder="例：見習童軍（可空白）"
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
    const RANK_PAIRS = ${JSON.stringify(rankPairs.results)};

    // ===== 頂部新增表單 =====
    function toggleNewStageForm() {
      const f = document.getElementById('newStageForm');
      f.classList.toggle('hidden');
      if (!f.classList.contains('hidden')) document.getElementById('new_title').focus();
    }

    document.getElementById('new_rank_to').addEventListener('change', function() {
      const custom = document.getElementById('new_rank_to_custom');
      if (this.value === '__custom__') {
        custom.classList.remove('hidden');
        custom.focus();
      } else { custom.classList.add('hidden'); }
    });

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
        rank_from: '', rank_to: rank,
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
