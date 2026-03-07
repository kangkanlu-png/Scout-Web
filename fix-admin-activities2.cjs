const fs = require('fs');
let file = fs.readFileSync('src/routes/admin.tsx', 'utf8');

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

        const isEdit = \${isEdit ? 'true' : 'false'};
        const actId = \${isEdit ? \`'\${activity?.id}'\` : 'null'};

        try {
          const res = await fetch(\`/api/activities\${isEdit ? '/' + actId : ''}\`, {
            method: isEdit ? 'PUT' : 'POST',
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
  file = formStr;
}

fs.writeFileSync('src/routes/admin.tsx', file);
