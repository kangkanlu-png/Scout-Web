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

  return c.html(adminLayout('儀表板', `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
        <div class="text-3xl font-bold text-green-700">${activitiesCount?.cnt || 0}</div>
        <div class="text-sm text-green-600 mt-1">活動記錄</div>
      </div>
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
        <div class="text-3xl font-bold text-blue-700">${imagesCount?.cnt || 0}</div>
        <div class="text-sm text-blue-600 mt-1">活動圖片</div>
      </div>
      <div class="bg-purple-50 border border-purple-200 rounded-xl p-5 text-center">
        <div class="text-3xl font-bold text-purple-700">${groupsCount?.cnt || 0}</div>
        <div class="text-sm text-purple-600 mt-1">童軍分組</div>
      </div>
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
        <div class="text-3xl font-bold text-amber-700">${announcementsCount?.cnt || 0}</div>
        <div class="text-sm text-amber-600 mt-1">公告訊息</div>
      </div>
    </div>
    <div class="bg-white rounded-xl shadow p-6">
      <h3 class="font-bold text-gray-700 mb-4">快速操作</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <a href="/admin/activities/new" class="flex flex-col items-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors">
          <span class="text-2xl">➕</span>
          <span class="text-sm text-green-700 font-medium">新增活動</span>
        </a>
        <a href="/admin/activities" class="flex flex-col items-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors">
          <span class="text-2xl">📋</span>
          <span class="text-sm text-blue-700 font-medium">管理活動</span>
        </a>
        <a href="/admin/groups" class="flex flex-col items-center gap-2 p-4 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors">
          <span class="text-2xl">👥</span>
          <span class="text-sm text-purple-700 font-medium">管理分組</span>
        </a>
        <a href="/admin/announcements" class="flex flex-col items-center gap-2 p-4 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors">
          <span class="text-2xl">📢</span>
          <span class="text-sm text-amber-700 font-medium">管理公告</span>
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
          <div class="flex items-center gap-2">
            <input type="checkbox" id="f-is_published" ${activity?.is_published !== 0 ? 'checked' : ''} class="w-4 h-4 text-green-600">
            <label for="f-is_published" class="text-sm text-gray-700">發佈（顯示於前台）</label>
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
          is_published: document.getElementById('f-is_published').checked ? 1 : 0,
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
        <a href="/admin/activities" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm ${title.includes('活動') ? 'bg-green-700' : ''}">
          <span>📋</span> 活動管理
        </a>
        <a href="/admin/groups" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm ${title === '分組管理' ? 'bg-green-700' : ''}">
          <span>👥</span> 童軍分組
        </a>
        <a href="/admin/announcements" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm ${title === '公告管理' ? 'bg-green-700' : ''}">
          <span>📢</span> 公告管理
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
