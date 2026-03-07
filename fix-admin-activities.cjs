const fs = require('fs');
let file = fs.readFileSync('src/routes/admin.tsx', 'utf8');

// Update menu link
file = file.replace(/<span>📋<\/span> 活動管理/g, '<span>📋</span> 活動/公告管理');
file = file.replace(/<span>📢<\/span> 公告管理/g, '<!-- <span>📢</span> 公告管理 (已整合至活動) -->');

// Update /activities list
let actListMatch = file.match(/adminRoutes\.get\('\/activities', authMiddleware, async \(c\) => \{[\s\S]*?return c\.html\(adminLayout\('活動管理', `([\s\S]*?)`\)\)\n\}\)/);

if (actListMatch) {
  let newList = file.replace(/adminRoutes\.get\('\/activities', authMiddleware, async \(c\) => \{[\s\S]*?return c\.html\(adminLayout\('活動管理', `([\s\S]*?)`\)\)\n\}\)/, 
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
    </script>
  \`))
})`);
  file = newList;
}

// Update activityForm
let formMatch = file.match(/function activityForm\(activity: any\) \{[\s\S]*?return `([\s\S]*?)`/);
if (formMatch) {
  let formStr = file.replace(/function activityForm\(activity: any\) \{[\s\S]*?return `([\s\S]*?)`/, 
`function activityForm(activity: any) {
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
      // 動態顯示/隱藏欄位
      function updateFields() {
        const type = document.getElementById('f-activity_type').value;
        const regFields = document.querySelectorAll('.reg-only-field');
        const actFields = document.querySelectorAll('.activity-only-field');
        
        regFields.forEach(el => el.style.display = type === 'registration' ? 'block' : 'none');
        
        // 若為公告，隱藏大部分活動相關欄位
        actFields.forEach(el => el.style.display = type === 'announcement' ? 'none' : 'block');
      }
      
      document.getElementById('f-activity_type').addEventListener('change', updateFields);
      // 初始化
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

        try {
          const res = await fetch(\`/api/activities\${${isEdit} ? '/${activity?.id}' : ''}\`, {
            method: ${isEdit} ? 'PUT' : 'POST',
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
}`);
}

fs.writeFileSync('src/routes/admin.tsx', file);
