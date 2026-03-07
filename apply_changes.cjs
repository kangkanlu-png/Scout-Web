const fs = require('fs');

// 1. Update API.tsx
let apiFile = fs.readFileSync('src/routes/api.tsx', 'utf8');

// POST activities
apiFile = apiFile.replace(
  /const { \n    title, title_en, description, description_en, activity_date, date_display, category, \n    youtube_url, display_order, is_published, cover_image, show_in_highlights,\n    location, cost, content, registration_start, registration_end, max_participants, is_registration_open, activity_end_date\n  } = body/,
  `const { 
    title, title_en, description, description_en, activity_date, date_display, category, 
    youtube_url, display_order, is_published, cover_image, show_in_highlights, activity_type,
    location, cost, content, registration_start, registration_end, max_participants, is_registration_open, activity_end_date
  } = body`
);

apiFile = apiFile.replace(
  /INSERT INTO activities \(\n      title, title_en, description, description_en, activity_date, date_display, category, \n      youtube_url, display_order, is_published, cover_image, show_in_highlights,\n      location, cost, content, registration_start, registration_end, max_participants, is_registration_open, activity_end_date\n    \)/,
  `INSERT INTO activities (
      title, title_en, description, description_en, activity_date, date_display, category, 
      youtube_url, display_order, is_published, cover_image, show_in_highlights, activity_type,
      location, cost, content, registration_start, registration_end, max_participants, is_registration_open, activity_end_date
    )`
);

apiFile = apiFile.replace(
  /VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?\)/,
  `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

apiFile = apiFile.replace(
  /cover_image \|\| null, show_in_highlights \? 1 : 0,\n    location \|\| null, cost \|\| null/,
  `cover_image || null, show_in_highlights ? 1 : 0, activity_type || 'general',\n    location || null, cost || null`
);

// PUT activities
apiFile = apiFile.replace(
  /display_order = \?, is_published = \?, cover_image = \?, show_in_highlights = \?,\n      location = \?, cost = \?,/,
  `display_order = ?, is_published = ?, cover_image = ?, show_in_highlights = ?, activity_type = ?,\n      location = ?, cost = ?,`
);

// We should run `node` to check if `activity_type` is there for PUT binding... ah wait, the PUT bind didn't replace correctly in regex. Let's do it safely:
apiFile = apiFile.replace(
  /cover_image \|\| null, show_in_highlights \? 1 : 0,\n    location \|\| null, cost \|\| null/g,
  `cover_image || null, show_in_highlights ? 1 : 0, activity_type || 'general',\n    location || null, cost || null`
);

// Add the highlight endpoint
const highlightEndpoint = `
// 結案並移至精彩活動
apiRoutes.post('/admin/activities/:id/close-and-highlight', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  
  await db.prepare(\`
    UPDATE activities SET
      show_in_highlights = 1,
      is_registration_open = 0,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  \`).bind(id).run()

  return c.json({ success: true })
})
`;
if (!apiFile.includes('close-and-highlight')) {
  apiFile = apiFile.replace(
    /\/\/ 刪除活動\napiRoutes\.delete\('\/activities\/:id'/,
    match => highlightEndpoint + '\n' + match
  );
}
fs.writeFileSync('src/routes/api.tsx', apiFile);


// 2. Update Admin.tsx
let adminFile = fs.readFileSync('src/routes/admin.tsx', 'utf8');

// Update menu link
adminFile = adminFile.replace(/<span>📋<\/span> 活動管理/g, '<span>📋</span> 活動/公告管理');
adminFile = adminFile.replace(/<span>📢<\/span> 公告管理/g, '<!-- <span>📢</span> 公告管理 (已整合) -->');

// Replace /activities get route logic
adminFile = adminFile.replace(/adminRoutes\.get\('\/activities', authMiddleware, async \(c\) => \{[\s\S]*?return c\.html\(adminLayout\('活動管理', `([\s\S]*?)`\)\)\n\}\)/, 
`adminRoutes.get('/activities', authMiddleware, async (c) => {
  const db = c.env.DB
  const activities = await db.prepare(\`
    SELECT a.*, COUNT(ai.id) as image_count
    FROM activities a
    LEFT JOIN activity_images ai ON ai.activity_id = a.id
    GROUP BY a.id
    ORDER BY a.display_order ASC, a.activity_date DESC, a.created_at DESC
  \`).all()

  const categoryLabel: Record<string, string> = {
    general: '一般活動', tecc: 'TECC 急救', camping: '大露營', training: '訓練課程', service: '服務活動'
  }
  const typeLabel: Record<string, string> = {
    general: '<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">一般活動</span>',
    registration: '<span class="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs">報名活動</span>',
    announcement: '<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">最新公告</span>'
  }
  
  const rows = activities.results.map((a: any) => \`
    <tr class="border-b hover:bg-gray-50">
      <td class="py-3 px-4">
        \${typeLabel[a.activity_type || 'general'] || typeLabel.general}
        <div class="mt-1">
          <span class="inline-block px-2 py-0.5 text-xs rounded-full \${a.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
            \${a.is_published ? '已發佈' : '草稿'}
          </span>
        </div>
      </td>
      <td class="py-3 px-4 font-medium">\${a.title}</td>
      <td class="py-3 px-4 text-sm text-gray-500">\${categoryLabel[a.category] || a.category}</td>
      <td class="py-3 px-4 text-sm text-gray-500">\${a.date_display || a.activity_date || '-'}</td>
      <td class="py-3 px-4 text-sm text-gray-500">\${a.image_count} 張</td>
      <td class="py-3 px-4">
        <div class="flex flex-wrap gap-2 items-center">
          <a href="/admin/activities/\${a.id}/edit" class="text-blue-600 hover:text-blue-800 text-sm font-medium">編輯</a>
          \${a.activity_type !== 'announcement' ? \`<a href="/admin/activities/\${a.id}/images" class="text-purple-600 hover:text-purple-800 text-sm font-medium">圖片</a>\` : ''}
          \${a.activity_type === 'registration' ? \`<a href="/admin/activities/\${a.id}/registrations" class="text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center gap-1">報名\${a.is_registration_open ? '<span class="w-2 h-2 rounded-full bg-green-500"></span>' : ''}</a>\` : ''}
          \${a.activity_type !== 'announcement' && !a.show_in_highlights && a.image_count > 0 ? \`<button onclick="closeAndHighlight(\${a.id})" class="text-green-600 hover:text-green-800 text-sm font-medium" title="結案並移至精彩活動">結案</button>\` : ''}
          \${a.show_in_highlights ? '<span class="text-yellow-600 text-xs font-bold" title="已在精彩活動展示">★</span>' : ''}
          <button onclick="deleteActivity(\${a.id})" class="text-red-500 hover:text-red-700 text-sm font-medium">刪除</button>
        </div>
      </td>
    </tr>
  \`).join('')

  return c.html(adminLayout('活動/公告管理', \`
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-bold text-gray-800">活動與公告管理</h2>
      <a href="/admin/activities/new" class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">➕ 新增項目</a>
    </div>
    <div class="bg-white rounded-xl shadow overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="py-3 px-4 text-left text-gray-600">屬性/狀態</th>
            <th class="py-3 px-4 text-left text-gray-600">標題</th>
            <th class="py-3 px-4 text-left text-gray-600">分類</th>
            <th class="py-3 px-4 text-left text-gray-600">日期</th>
            <th class="py-3 px-4 text-left text-gray-600">圖片</th>
            <th class="py-3 px-4 text-left text-gray-600">操作</th>
          </tr>
        </thead>
        <tbody>
          \${rows || '<tr><td colspan="6" class="py-8 text-center text-gray-400">尚無資料</td></tr>'}
        </tbody>
      </table>
    </div>
    <script>
      async function closeAndHighlight(id) {
        if (!confirm('確定要結案此活動並將其移至「精彩活動」展示嗎？\\n(系統將自動關閉報名功能並設定為精彩活動)')) return;
        try {
          const res = await fetch(\`/api/admin/activities/\${id}/close-and-highlight\`, { method: 'POST' });
          if (res.ok) {
            alert('已成功結案並移至精彩活動！');
            location.reload();
          } else {
            alert('操作失敗');
          }
        } catch (e) {
          alert('連線錯誤');
        }
      }
    </script>\`))
})`);

// Replace activityForm function
let startIdx = adminFile.indexOf('function activityForm(activity: any) {');
let endIdx = adminFile.indexOf('function imageUploadForm', startIdx);
let newFormStr = `function activityForm(activity: any) {
  const isEdit = !!activity
  const categories = [
    { value: 'general', label: '一般活動' },
    { value: 'camping', label: '大露營' },
    { value: 'tecc', label: 'TECC 急救訓練' },
    { value: 'training', label: '訓練課程' },
    { value: 'service', label: '服務活動' },
  ]
  const catOptions = categories.map(c =>
    \`<option value="\${c.value}" \${activity?.category === c.value ? 'selected' : ''}>\${c.label}</option>\`
  ).join('')

  const typeOptions = [
    { value: 'general', label: '一般活動 (無報名)' },
    { value: 'registration', label: '報名活動 (開放報名)' },
    { value: 'announcement', label: '最新公告 (純文字發布)' }
  ].map(t =>
    \`<option value="\${t.value}" \${(activity?.activity_type || 'general') === t.value ? 'selected' : ''}>\${t.label}</option>\`
  ).join('')

  return \`
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-bold text-gray-800">\${isEdit ? '編輯項目' : '新增項目'}</h2>
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
            <label class="block text-sm font-medium text-gray-700 mb-1">屬性 *</label>
            <select id="f-activity_type" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">\${typeOptions}</select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">發佈狀態</label>
            <select id="f-is_published" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="1" \${activity?.is_published !== 0 ? 'selected' : ''}>已發佈</option>
              <option value="0" \${activity?.is_published === 0 ? 'selected' : ''}>草稿 (不公開)</option>
            </select>
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">標題 *</label>
            <input type="text" id="f-title" value="\${activity?.title || ''}" required class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="例：第12屆全國童軍大露營 或 團集會改期公告">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">英文標題</label>
            <input type="text" id="f-title_en" value="\${activity?.title_en || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="e.g. 12th National Scout Jamboree">
          </div>
          <div class="activity-only-field">
            <label class="block text-sm font-medium text-gray-700 mb-1">活動分類</label>
            <select id="f-category" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">\${catOptions}</select>
          </div>
          <div class="activity-only-field">
            <label class="block text-sm font-medium text-gray-700 mb-1">地點</label>
            <input type="text" id="f-location" value="\${activity?.location || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="例：陽明山露營場">
          </div>
          <div class="activity-only-field">
            <label class="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
            <input type="date" id="f-activity_date" value="\${activity?.activity_date || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div class="activity-only-field">
            <label class="block text-sm font-medium text-gray-700 mb-1">結束日期 (選填)</label>
            <input type="date" id="f-activity_end_date" value="\${activity?.activity_end_date || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div class="activity-only-field">
            <label class="block text-sm font-medium text-gray-700 mb-1">自訂日期顯示 (選填)</label>
            <input type="text" id="f-date_display" value="\${activity?.date_display || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="例：2024年暑假">
          </div>

          <!-- 詳細內容 -->
          <div class="md:col-span-2 border-b pb-2 mb-2 mt-4">
            <h3 class="font-bold text-gray-700">內容設定</h3>
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">簡短描述 (顯示於列表)</label>
            <textarea id="f-description" rows="2" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">\${activity?.description || ''}</textarea>
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">詳細內容 (支援 HTML)</label>
            <textarea id="f-content" rows="6" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">\${activity?.content || ''}</textarea>
          </div>
          
          <!-- 報名設定 -->
          <div class="md:col-span-2 border-b pb-2 mb-2 mt-4 reg-only-field">
            <h3 class="font-bold text-gray-700">報名設定 (僅報名活動適用)</h3>
          </div>
          <div class="reg-only-field">
            <label class="block text-sm font-medium text-gray-700 mb-1">報名開始時間</label>
            <input type="datetime-local" id="f-registration_start" value="\${activity?.registration_start || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div class="reg-only-field">
            <label class="block text-sm font-medium text-gray-700 mb-1">報名截止時間</label>
            <input type="datetime-local" id="f-registration_end" value="\${activity?.registration_end || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div class="reg-only-field">
            <label class="block text-sm font-medium text-gray-700 mb-1">名額限制 (留空表示不限)</label>
            <input type="number" id="f-max_participants" value="\${activity?.max_participants || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div class="reg-only-field">
            <label class="block text-sm font-medium text-gray-700 mb-1">活動費用</label>
            <input type="text" id="f-cost" value="\${activity?.cost || ''}" placeholder="例：免費 或 500元" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div class="reg-only-field">
            <label class="flex items-center gap-2 mt-6 cursor-pointer">
              <input type="checkbox" id="f-is_registration_open" \${activity?.is_registration_open ? 'checked' : ''} class="w-4 h-4 text-green-600 rounded">
              <span class="text-sm font-medium text-gray-700">手動開放報名 (勾選後前台顯示報名按鈕)</span>
            </label>
          </div>

          <!-- 其他設定 -->
          <div class="md:col-span-2 border-b pb-2 mb-2 mt-4 activity-only-field">
            <h3 class="font-bold text-gray-700">其他設定</h3>
          </div>
          <div class="md:col-span-2 activity-only-field">
            <label class="block text-sm font-medium text-gray-700 mb-1">封面圖片網址 (選填)</label>
            <input type="text" id="f-cover_image" value="\${activity?.cover_image || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="https://...">
          </div>
          <div class="activity-only-field">
            <label class="block text-sm font-medium text-gray-700 mb-1">YouTube 連結 (選填)</label>
            <input type="text" id="f-youtube_url" value="\${activity?.youtube_url || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="https://youtube.com/...">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">排序權重 (數字越小越前面)</label>
            <input type="number" id="f-display_order" value="\${activity?.display_order || '0'}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div class="activity-only-field">
            <label class="flex items-center gap-2 mt-6 cursor-pointer">
              <input type="checkbox" id="f-show_in_highlights" \${activity?.show_in_highlights ? 'checked' : ''} class="w-4 h-4 text-green-600 rounded">
              <span class="text-sm font-medium text-gray-700">直接顯示於「精彩活動」區塊</span>
            </label>
          </div>
        </div>

        <div class="pt-4 flex gap-3">
          <button type="submit" class="bg-green-700 hover:bg-green-800 text-white px-6 py-2 rounded-lg font-medium">\${isEdit ? '儲存更新' : '確認新增'}</button>
          <a href="/admin/activities" class="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg font-medium">取消</a>
        </div>
      </form>
    </div>
    <script>
      function updateFields() {
        const type = document.getElementById('f-activity_type').value;
        const regFields = document.querySelectorAll('.reg-only-field');
        const actFields = document.querySelectorAll('.activity-only-field');
        
        regFields.forEach(el => el.style.display = type === 'registration' ? 'block' : 'none');
        actFields.forEach(el => el.style.display = type === 'announcement' ? 'none' : 'block');
      }
      
      document.getElementById('f-activity_type').addEventListener('change', updateFields);
      updateFields();

      document.getElementById('activity-form').addEventListener('submit', async (e) => {
        e.preventDefault()
        const data = {
          activity_type: document.getElementById('f-activity_type').value,
          title: document.getElementById('f-title').value,
          title_en: document.getElementById('f-title_en').value,
          category: document.getElementById('f-category').value,
          location: document.getElementById('f-location').value,
          activity_date: document.getElementById('f-activity_date').value,
          activity_end_date: document.getElementById('f-activity_end_date').value,
          date_display: document.getElementById('f-date_display').value,
          description: document.getElementById('f-description').value,
          content: document.getElementById('f-content').value,
          registration_start: document.getElementById('f-registration_start')?.value || null,
          registration_end: document.getElementById('f-registration_end')?.value || null,
          max_participants: document.getElementById('f-max_participants')?.value ? parseInt(document.getElementById('f-max_participants').value) : null,
          cost: document.getElementById('f-cost')?.value || null,
          is_registration_open: document.getElementById('f-is_registration_open')?.checked,
          cover_image: document.getElementById('f-cover_image').value,
          youtube_url: document.getElementById('f-youtube_url').value,
          display_order: parseInt(document.getElementById('f-display_order').value) || 0,
          show_in_highlights: document.getElementById('f-show_in_highlights')?.checked || false,
          is_published: parseInt(document.getElementById('f-is_published').value)
        }

        const isEditStr = '\${isEdit ? "true" : "false"}';
        const actIdStr = '\${activity?.id || ""}';
        const url = isEditStr === 'true' ? '/api/activities/' + actIdStr : '/api/activities';
        const method = isEditStr === 'true' ? 'PUT' : 'POST';

        try {
          const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          })
          if (res.ok) {
            window.location.href = '/admin/activities'
          } else {
            const err = await res.json()
            alert(err.error || '儲存失敗')
          }
        } catch (error) {
          alert('系統錯誤')
        }
      })
    </script>
  \`
}
`;
adminFile = adminFile.substring(0, startIdx) + newFormStr + adminFile.substring(endIdx);

fs.writeFileSync('src/routes/admin.tsx', adminFile);

// 3. Update Frontend.tsx
let frontFile = fs.readFileSync('src/routes/frontend.tsx', 'utf8');

frontFile = frontFile.replace(
  /<a href="\/#activities" class="hover:text-amber-300 transition-colors">活動<\/a>/,
  '<a href="/announcements" class="hover:text-amber-300 transition-colors">📢 公告</a>\n          <a href="/activities" class="hover:text-amber-300 transition-colors">📅 活動報名</a>'
);
frontFile = frontFile.replace(
  /<a href="\/#activities" class="bg-amber-500 hover:bg-amber-400 text-white px-6 py-2.5 rounded-full font-medium transition-colors">查看活動<\/a>/,
  '<a href="/activities" class="bg-amber-500 hover:bg-amber-400 text-white px-6 py-2.5 rounded-full font-medium transition-colors">報名專區</a>'
);

const newRoutes = `
// ===================== 公告專區 =====================
frontendRoutes.get('/announcements', async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(\`SELECT key, value FROM site_settings\`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  const acts = await db.prepare(\`
    SELECT * FROM activities 
    WHERE is_published = 1 AND activity_type = 'announcement'
    ORDER BY created_at DESC
  \`).all()

  const oldAnns = await db.prepare(\`SELECT * FROM announcements WHERE is_active = 1 ORDER BY created_at DESC\`).all()
  
  const allAnns = [
    ...acts.results.map((a: any) => ({ ...a, is_new: true, date: a.created_at })),
    ...oldAnns.results.map((a: any) => ({ ...a, is_new: false, date: a.created_at }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const itemsHtml = allAnns.map((a: any) => \`
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div class="flex items-center gap-3 mb-2">
        <span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">公告</span>
        <span class="text-sm text-gray-500">\${a.date ? a.date.substring(0, 10) : ''}</span>
      </div>
      <h3 class="text-lg font-bold text-gray-800 mb-2">\${a.title}</h3>
      <div class="text-gray-600 text-sm whitespace-pre-line">\${a.content || a.description || ''}</div>
      \${a.link_url ? \`<a href="\${a.link_url}" target="_blank" class="inline-block mt-3 text-blue-600 hover:text-blue-800 text-sm">🔗 查看相關連結</a>\` : ''}
    </div>
  \`).join('') || '<div class="text-center py-10 text-gray-400">目前無公告</div>'

  const html = \`\${pageHead('最新公告 - ' + (settings.site_title || ''), settings)}
  <body>
    \${navBar(settings)}
    <div class="hero-gradient text-white py-14 px-4">
      <div class="max-w-4xl mx-auto text-center">
        <div class="text-5xl mb-4">📢</div>
        <h1 class="text-3xl md:text-4xl font-bold mb-2">最新公告</h1>
        <p class="text-green-200">Announcements</p>
      </div>
    </div>
    <div class="max-w-4xl mx-auto px-4 py-10">
      <div class="space-y-4">
        \${itemsHtml}
      </div>
    </div>
    \${pageFooter(settings)}
  </body></html>\`
  return c.html(html)
})

// ===================== 活動報名專區 =====================
frontendRoutes.get('/activities', async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(\`SELECT key, value FROM site_settings\`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  const acts = await db.prepare(\`
    SELECT a.*, GROUP_CONCAT(ai.image_url) as images
    FROM activities a
    LEFT JOIN activity_images ai ON ai.activity_id = a.id
    WHERE a.is_published = 1 AND a.activity_type = 'registration'
    GROUP BY a.id
    ORDER BY a.activity_date DESC
  \`).all()

  const itemsHtml = acts.results.map((a: any) => {
    let cover = a.cover_image
    if (!cover && a.images) cover = a.images.split(',')[0]
    const defaultCover = 'https://images.unsplash.com/photo-1526404423292-15db8c2334e5?auto=format&fit=crop&q=80&w=800'
    
    const now = new Date()
    let regStatus = ''
    let regClass = ''
    if (a.is_registration_open) {
      if (a.registration_start && new Date(a.registration_start) > now) {
        regStatus = '即將開放'
        regClass = 'bg-blue-100 text-blue-700'
      } else if (a.registration_end && new Date(a.registration_end) < now) {
        regStatus = '報名截止'
        regClass = 'bg-gray-100 text-gray-600'
      } else {
        regStatus = '報名中'
        regClass = 'bg-green-100 text-green-700'
      }
    } else {
      regStatus = '尚未開放'
      regClass = 'bg-gray-100 text-gray-500'
    }

    return \`
    <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all flex flex-col md:flex-row">
      <div class="md:w-1/3 h-48 md:h-auto bg-gray-200">
        <img src="\${cover || defaultCover}" class="w-full h-full object-cover">
      </div>
      <div class="p-6 md:w-2/3 flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-start mb-2">
            <span class="\${regClass} px-2 py-1 rounded text-xs font-bold">\${regStatus}</span>
            <span class="text-sm text-gray-500">📅 \${a.date_display || a.activity_date || '-'}</span>
          </div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">\${a.title}</h3>
          <p class="text-gray-600 text-sm line-clamp-2 mb-4">\${a.description || a.content?.substring(0, 100) || '無詳細說明'}</p>
        </div>
        <div class="flex items-center justify-between border-t pt-4">
          <div class="text-sm text-gray-500 flex items-center gap-4">
            \${a.location ? \`<span title="活動地點"><i class="fas fa-map-marker-alt"></i> \${a.location}</span>\` : ''}
            \${a.cost ? \`<span title="活動費用"><i class="fas fa-dollar-sign"></i> \${a.cost}</span>\` : ''}
          </div>
          <a href="/activities/\${a.id}" class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            查看詳情
          </a>
        </div>
      </div>
    </div>
  \`}).join('') || '<div class="text-center py-10 text-gray-400">目前無開放報名的活動</div>'

  const html = \`\${pageHead('活動報名 - ' + (settings.site_title || ''), settings)}
  <body>
    \${navBar(settings)}
    <div class="hero-gradient text-white py-14 px-4">
      <div class="max-w-5xl mx-auto text-center">
        <div class="text-5xl mb-4">📅</div>
        <h1 class="text-3xl md:text-4xl font-bold mb-2">活動報名</h1>
        <p class="text-green-200">Activity Registrations</p>
      </div>
    </div>
    <div class="max-w-5xl mx-auto px-4 py-10">
      <div class="space-y-6">
        \${itemsHtml}
      </div>
    </div>
    \${pageFooter(settings)}
  </body></html>\`
  return c.html(html)
})

// 單一活動詳情頁
frontendRoutes.get('/activities/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const settingsRows = await db.prepare(\`SELECT key, value FROM site_settings\`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  const activity = await db.prepare(\`SELECT * FROM activities WHERE id = ? AND is_published = 1\`).bind(id).first() as any
  if (!activity) return c.notFound()

  let cover = activity.cover_image
  if (!cover) {
    const images = await db.prepare(\`SELECT image_url FROM activity_images WHERE activity_id = ? LIMIT 1\`).bind(id).all()
    if (images.results.length > 0) cover = images.results[0].image_url
  }
  const defaultCover = 'https://images.unsplash.com/photo-1526404423292-15db8c2334e5?auto=format&fit=crop&q=80&w=1200'

  const html = \`\${pageHead(activity.title + ' - 活動詳情', settings)}
  <body>
    \${navBar(settings)}
    <div class="w-full h-64 md:h-80 relative bg-gray-900">
      <img src="\${cover || defaultCover}" class="w-full h-full object-cover opacity-50">
      <div class="absolute inset-0 flex items-center justify-center text-center px-4">
        <div>
          <span class="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium mb-3 inline-block">活動詳情</span>
          <h1 class="text-3xl md:text-5xl font-bold text-white mb-2">\${activity.title}</h1>
          \${activity.title_en ? \`<p class="text-gray-200">\${activity.title_en}</p>\` : ''}
        </div>
      </div>
    </div>
    
    <div class="max-w-4xl mx-auto px-4 py-10">
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8 -mt-20 relative z-10">
        <div class="grid md:grid-cols-3 gap-8">
          <div class="md:col-span-2 prose max-w-none">
            <h3 class="text-xl font-bold text-gray-800 mb-4 border-b pb-2">活動內容</h3>
            <div class="whitespace-pre-line">\${activity.content || activity.description || '無詳細說明'}</div>
          </div>
          <div class="bg-gray-50 rounded-xl p-5 h-fit">
            <h3 class="text-lg font-bold text-gray-800 mb-4">活動資訊</h3>
            <ul class="space-y-4 text-sm text-gray-600">
              <li>
                <div class="font-medium text-gray-800 mb-1"><i class="fas fa-calendar-alt w-5"></i> 活動時間</div>
                <div>\${activity.date_display || activity.activity_date} \${activity.activity_end_date ? '~ ' + activity.activity_end_date : ''}</div>
              </li>
              \${activity.location ? \`
              <li>
                <div class="font-medium text-gray-800 mb-1"><i class="fas fa-map-marker-alt w-5"></i> 活動地點</div>
                <div>\${activity.location}</div>
              </li>\` : ''}
              \${activity.cost ? \`
              <li>
                <div class="font-medium text-gray-800 mb-1"><i class="fas fa-dollar-sign w-5"></i> 活動費用</div>
                <div>\${activity.cost}</div>
              </li>\` : ''}
              \${activity.max_participants ? \`
              <li>
                <div class="font-medium text-gray-800 mb-1"><i class="fas fa-users w-5"></i> 名額限制</div>
                <div>\${activity.max_participants} 人</div>
              </li>\` : ''}
              \${activity.activity_type === 'registration' ? \`
              <li>
                <div class="font-medium text-gray-800 mb-1"><i class="fas fa-clock w-5"></i> 報名期限</div>
                <div>\${activity.registration_start ? activity.registration_start.replace('T', ' ') : '即日起'} <br>至 \${activity.registration_end ? activity.registration_end.replace('T', ' ') : '額滿為止'}</div>
              </li>
              \` : ''}
            </ul>
            
            \${activity.activity_type === 'registration' ? \`
            <div class="mt-6 pt-6 border-t border-gray-200">
              <a href="/member" class="block w-full bg-orange-500 hover:bg-orange-600 text-white text-center py-3 rounded-lg font-bold transition-colors shadow-sm">
                前往會員專區報名
              </a>
              <p class="text-xs text-gray-500 text-center mt-2">請先登入會員系統，並於「活動報名」區塊進行報名</p>
            </div>
            \` : ''}
          </div>
        </div>
      </div>
    </div>
    \${pageFooter(settings)}
  </body></html>\`
  return c.html(html)
})
`;

if (!frontFile.includes("frontendRoutes.get('/announcements'")) {
  frontFile = frontFile.replace(/\/\/ ===================== 首頁 =====================/, newRoutes + '\n// ===================== 首頁 =====================');
}

frontFile = frontFile.replace(
  /const announcements = await db\.prepare\(`\s*SELECT \* FROM announcements WHERE is_active = 1 ORDER BY created_at DESC LIMIT 5\s*`\)\.all\(\)/,
  `const actAnns = await db.prepare(\`SELECT * FROM activities WHERE is_published = 1 AND activity_type = 'announcement' ORDER BY created_at DESC LIMIT 5\`).all()
  const oldAnns = await db.prepare(\`SELECT * FROM announcements WHERE is_active = 1 ORDER BY created_at DESC LIMIT 5\`).all()
  const allAnnsList = [...actAnns.results.map((a: any) => ({ ...a, date: a.created_at })), ...oldAnns.results.map((a: any) => ({ ...a, date: a.created_at }))]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
  const announcements = { results: allAnnsList }`
);

frontFile = frontFile.replace(
  /WHERE a\.is_published = 1 AND \(a\.show_in_highlights = 0 OR a\.show_in_highlights IS NULL\)/,
  `WHERE a.is_published = 1 AND (a.show_in_highlights = 0 OR a.show_in_highlights IS NULL) AND (a.activity_type = 'general' OR a.activity_type IS NULL OR a.activity_type = 'registration')`
);

fs.writeFileSync('src/routes/frontend.tsx', frontFile);

console.log("Applied all changes!");
