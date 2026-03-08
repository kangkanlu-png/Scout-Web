const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf-8');

// Find the start of the /activities route
const startIdx = code.indexOf("adminRoutes.get('/activities', authMiddleware, async (c) => {");
const endIdx = code.indexOf("// 新增活動表單", startIdx);

if (startIdx === -1 || endIdx === -1) {
  console.log('Could not find activities block');
  process.exit(1);
}

const newBlock = `adminRoutes.get('/activities', authMiddleware, async (c) => {
  const db = c.env.DB
  // 取得活動列表，包含圖片數量
  const activities = await db.prepare(\`
    SELECT a.*, COUNT(ai.id) as image_count
    FROM activities a
    LEFT JOIN activity_images ai ON ai.activity_id = a.id
    GROUP BY a.id
    ORDER BY a.display_order ASC, a.activity_date DESC, a.created_at DESC
  \`).all()

  const categoryLabel: Record<string, string> = {
    general: '一般活動', tecc: 'TECC 急救', camping: '大露營', training: '訓練課程', service: '服務活動', national_day: '國慶服務活動'
  }
  const typeLabel: Record<string, string> = {
    general: '<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">一般活動</span>',
    registration: '<span class="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs">報名活動</span>',
    announcement: '<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">最新公告</span>'
  }
  
  const generateRow = (a: any) => \`
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
          \${a.activity_type !== 'announcement' && !a.show_in_highlights ? \`<button onclick="closeAndHighlight(\${a.id})" class="text-green-600 hover:text-green-800 text-sm font-medium" title="結案並移至精彩活動">結案</button>\` : ''}
          \${a.show_in_highlights ? '<span class="text-yellow-600 text-xs font-bold" title="已在精彩活動展示">★ 精彩活動</span>' : ''}
          <button onclick="deleteActivity(\${a.id})" class="text-red-500 hover:text-red-700 text-sm font-medium">刪除</button>
        </div>
      </td>
    </tr>
  \`

  const latestActivities = activities.results.filter((a: any) => a.activity_type !== 'announcement' && !a.show_in_highlights)
  const announcements = activities.results.filter((a: any) => a.activity_type === 'announcement')
  const highlights = activities.results.filter((a: any) => a.show_in_highlights)

  // 精彩回顧分類 Tabs
  const renderHighlightsByCategory = () => {
    let html = '<div class="mt-4 border-b border-gray-200 mb-4"><nav class="-mb-px flex space-x-6 overflow-x-auto">';
    const cats = [{id: 'all', name: '全部'}, {id: 'general', name: '一般活動'}, {id: 'tecc', name: 'TECC 急救'}, {id: 'camping', name: '大露營'}, {id: 'training', name: '訓練課程'}, {id: 'service', name: '服務活動'}, {id: 'national_day', name: '國慶服務活動'}];
    
    cats.forEach((cat, idx) => {
      html += \`<button onclick="switchHighlightTab('\${cat.id}')" id="htab-\${cat.id}" class="\${idx === 0 ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors">\${cat.name}</button>\`;
    });
    html += '</nav></div>';

    cats.forEach(cat => {
      const filtered = cat.id === 'all' ? highlights : highlights.filter((a: any) => a.category === cat.id);
      html += \`
        <div id="hcontent-\${cat.id}" class="highlight-content \${cat.id === 'all' ? '' : 'hidden'}">
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
              \${filtered.length > 0 ? filtered.map(generateRow).join('') : '<tr><td colspan="6" class="py-8 text-center text-gray-400">尚無資料</td></tr>'}
            </tbody>
          </table>
        </div>
      \`;
    });
    return html;
  }

  return c.html(adminLayout('活動/公告管理', \`
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-bold text-gray-800">活動與公告管理</h2>
      <a href="/admin/activities/new" class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">➕ 新增項目</a>
    </div>

    <!-- 主 Tab 切換 -->
    <div class="border-b border-gray-200 mb-6">
      <nav class="-mb-px flex space-x-8">
        <button onclick="switchMainTab('latest')" id="tab-latest" class="border-green-500 text-green-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors">
          最新活動 (\${latestActivities.length})
        </button>
        <button onclick="switchMainTab('announcement')" id="tab-announcement" class="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors">
          活動公告 (\${announcements.length})
        </button>
        <button onclick="switchMainTab('highlights')" id="tab-highlights" class="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors">
          精彩回顧 (\${highlights.length})
        </button>
      </nav>
    </div>

    <div class="bg-white rounded-xl shadow overflow-hidden p-2">
      <!-- 最新活動 Content -->
      <div id="content-latest" class="main-content">
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
            \${latestActivities.length > 0 ? latestActivities.map(generateRow).join('') : '<tr><td colspan="6" class="py-8 text-center text-gray-400">尚無最新活動</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- 活動公告 Content -->
      <div id="content-announcement" class="main-content hidden">
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
            \${announcements.length > 0 ? announcements.map(generateRow).join('') : '<tr><td colspan="6" class="py-8 text-center text-gray-400">尚無活動公告</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- 精彩回顧 Content -->
      <div id="content-highlights" class="main-content hidden">
        \${renderHighlightsByCategory()}
      </div>
    </div>

    <script>
      function switchMainTab(tabId) {
        document.querySelectorAll('.main-content').forEach(el => el.classList.add('hidden'));
        document.getElementById('content-' + tabId).classList.remove('hidden');
        
        document.querySelectorAll('[id^="tab-"]').forEach(el => {
          el.classList.remove('border-green-500', 'text-green-600');
          el.classList.add('border-transparent', 'text-gray-500');
        });
        const activeTab = document.getElementById('tab-' + tabId);
        activeTab.classList.remove('border-transparent', 'text-gray-500');
        activeTab.classList.add('border-green-500', 'text-green-600');
      }

      function switchHighlightTab(catId) {
        document.querySelectorAll('.highlight-content').forEach(el => el.classList.add('hidden'));
        document.getElementById('hcontent-' + catId).classList.remove('hidden');

        document.querySelectorAll('[id^="htab-"]').forEach(el => {
          el.classList.remove('border-green-500', 'text-green-600');
          el.classList.add('border-transparent', 'text-gray-500');
        });
        const activeTab = document.getElementById('htab-' + catId);
        activeTab.classList.remove('border-transparent', 'text-gray-500');
        activeTab.classList.add('border-green-500', 'text-green-600');
      }

      async function closeAndHighlight(id) {
        if (!confirm('確定要結案此活動並將其移至「精彩活動」展示嗎？\\\\n(系統將自動關閉報名功能並設定為精彩活動)')) return;
        try {
          const res = await fetch('/api/admin/activities/' + id + '/close-and-highlight', { method: 'POST' });
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
})

`;

code = code.substring(0, startIdx) + newBlock + code.substring(endIdx);
fs.writeFileSync('src/routes/admin.tsx', code);
console.log('Activities page patched!');
