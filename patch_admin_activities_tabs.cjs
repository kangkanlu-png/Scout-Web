const fs = require('fs');
const file = 'src/routes/admin.tsx';
let code = fs.readFileSync(file, 'utf8');

const newActivitiesRoute = `
adminRoutes.get('/activities', authMiddleware, async (c) => {
  const db = c.env.DB
  const currentTab = c.req.query('tab') || 'latest'
  const filterCat = c.req.query('cat') || 'all'
  
  let queryCondition = ''
  if (currentTab === 'announcements') {
    queryCondition = "WHERE a.activity_type = 'announcement'"
  } else if (currentTab === 'highlights') {
    queryCondition = "WHERE (a.show_in_highlights = 1 OR a.activity_status = 'completed') AND a.activity_type != 'announcement'"
    if (filterCat !== 'all') {
      queryCondition += " AND a.category = '" + filterCat.replace(/'/g, "''") + "'"
    }
  } else {
    // latest
    queryCondition = "WHERE (a.activity_type = 'general' OR a.activity_type = 'registration' OR a.activity_type IS NULL) AND (a.activity_status != 'completed' AND (a.show_in_highlights IS NULL OR a.show_in_highlights = 0))"
  }

  const activities = await db.prepare(\`
    SELECT a.*, COUNT(ai.id) as image_count
    FROM activities a
    LEFT JOIN activity_images ai ON ai.activity_id = a.id
    \${queryCondition}
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
  
  const statusLabel: Record<string, string> = {
    active: '<span class="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs border border-green-200">籌備/進行中</span>',
    completed: '<span class="text-gray-600 bg-gray-50 px-2 py-0.5 rounded text-xs border border-gray-200">已結案</span>',
    cancelled: '<span class="text-red-600 bg-red-50 px-2 py-0.5 rounded text-xs border border-red-200">已取消</span>'
  }
  
  const rows = activities.results.map((a: any) => \`
    <tr class="border-b hover:bg-gray-50">
      <td class="py-3 px-4">
        \${typeLabel[a.activity_type || 'general'] || typeLabel.general}
        <div class="mt-1 flex flex-col gap-1">
          <span class="inline-block px-2 py-0.5 text-xs rounded-full \${a.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
            \${a.is_published ? '已發佈' : '草稿'}
          </span>
          \${a.activity_status ? statusLabel[a.activity_status] || '' : ''}
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
          \${(a.activity_type === 'registration' || a.activity_type === 'general') ? \`<a href="/admin/activities/\${a.id}/registrations" class="text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center gap-1 bg-orange-50 px-2 py-1 rounded">📋 報名名單\${a.is_registration_open ? '<span class="w-2 h-2 rounded-full bg-green-500"></span>' : ''}</a>\` : ''}
          \${a.activity_type !== 'announcement' && !a.show_in_highlights && a.image_count > 0 ? \`<button onclick="closeAndHighlight(\${a.id})" class="text-green-600 hover:text-green-800 text-sm font-medium" title="結案並移至精彩活動">結案</button>\` : ''}
          \${a.show_in_highlights || a.activity_status === 'completed' ? '<span class="text-yellow-600 text-xs font-bold" title="已結案/展示">★ 結案/展示</span>' : ''}
          <button onclick="deleteActivity(\${a.id})" class="text-red-500 hover:text-red-700 text-sm font-medium">刪除</button>
        </div>
      </td>
    </tr>
  \`).join('')

  const tabs = [
    { id: 'latest', name: '最新活動', icon: '📅' },
    { id: 'announcements', name: '活動公告', icon: '📢' },
    { id: 'highlights', name: '精彩回顧', icon: '📸' }
  ]
  
  const tabHtml = \`
    <div class="flex border-b border-gray-200 mb-6">
      \${tabs.map(t => \`
        <a href="/admin/activities?tab=\${t.id}" class="px-6 py-3 font-medium text-sm border-b-2 \${currentTab === t.id ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">
          \${t.icon} \${t.name}
        </a>
      \`).join('')}
    </div>
  \`

  const cats = [
    { id: 'all', name: '全部' },
    { id: 'camping', name: '大露營' },
    { id: 'tecc', name: 'TECC急救' },
    { id: 'service', name: '服務' },
    { id: 'training', name: '訓練' },
    { id: 'general', name: '一般活動' }
  ]

  const filterHtml = currentTab === 'highlights' ? \`
    <div class="flex flex-wrap gap-2 mb-4 bg-gray-50 p-3 rounded-lg">
      <span class="text-sm font-medium text-gray-500 pt-1">分類：</span>
      \${cats.map(c => \`
        <a href="/admin/activities?tab=highlights&cat=\${c.id}" class="px-3 py-1 rounded-full text-xs font-medium \${filterCat === c.id ? 'bg-green-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'}">
          \${c.name}
        </a>
      \`).join('')}
    </div>
  \` : ''

  return c.html(adminLayout('活動與公告管理', \`
    <div class="flex justify-between items-center mb-2">
      <h2 class="text-2xl font-bold text-gray-800">活動與公告管理</h2>
      <a href="/admin/activities/new" class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow">➕ 新增項目</a>
    </div>
    
    \${tabHtml}
    \${filterHtml}

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
        if (!confirm('確定要結案此活動並將其移至「精彩活動」展示嗎？\\n(系統將自動關閉報名功能並設定為結案)')) return;
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

const oldRouteRegex = /adminRoutes\.get\('\/activities', authMiddleware, async \(c\) => \{[\s\S]*?\n\}\)/;
if (code.match(oldRouteRegex)) {
  code = code.replace(oldRouteRegex, newActivitiesRoute.trim());
  fs.writeFileSync(file, code);
  console.log('Replaced /activities route');
} else {
  console.log('Regex failed to match');
}
