const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/routes/admin.tsx');
let content = fs.readFileSync(file, 'utf-8');

// Find the GET /advancement handler
const start = content.indexOf(`adminRoutes.get('/advancement', authMiddleware, async (c) => {`);
const end = content.indexOf(`// ===================== 晉升條件管理 =====================`);
if (start === -1 || end === -1) {
    console.log("Could not find the bounds");
    process.exit(1);
}

const replacement = `adminRoutes.get('/advancement', authMiddleware, async (c) => {
  const db = c.env.DB
  const tab = c.req.query('tab') || 'applications'

  if (tab === 'members') {
    // ── 學員進程管理頁面 ──
    const sectionFilter = c.req.query('section') || 'all'
    
    // 取得所有學員
    let query = \`SELECT m.id, m.chinese_name, m.section, m.unit_name, m.rank_level,
                 (SELECT award_name FROM progress_records WHERE member_id = m.id AND record_type = 'rank' ORDER BY awarded_at DESC LIMIT 1) as current_rank
                 FROM members m WHERE m.status = 'active'\`
    const params = []
    if (sectionFilter !== 'all') {
      query += \` AND m.section = ?\`
      params.push(sectionFilter)
    }
    query += \` ORDER BY m.section, m.chinese_name\`
    
    const members = await db.prepare(query).bind(...params).all()

    return c.html(adminLayout('進程管理中心', \`
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-800">進程管理中心</h1>
        <a href="/admin/advancement/requirements" class="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
          <i class="fas fa-cog"></i>晉升條件管理
        </a>
      </div>

      <!-- 主 Tabs -->
      <div class="flex border-b mb-6">
        <a href="/admin/advancement?tab=applications" class="px-6 py-3 font-medium text-gray-500 hover:text-gray-700">晉升申請審核</a>
        <a href="/admin/advancement?tab=members" class="px-6 py-3 font-medium text-green-700 border-b-2 border-green-600">學員進程管理</a>
      </div>

      <!-- 篩選器 -->
      <div class="flex gap-2 mb-4">
        \${['all','童軍','行義童軍','羅浮童軍'].map(s => \`
          <a href="/admin/advancement?tab=members&section=\${s}" class="px-4 py-1.5 rounded-full text-sm font-medium \${sectionFilter === s ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">\${s === 'all' ? '全部階段' : s}</a>
        \`).join('')}
      </div>

      <div class="bg-white rounded-xl shadow-sm overflow-hidden">
        <table class="w-full">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">姓名</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">階段 / 小隊</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">最高晉級紀錄</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            \${members.results.length === 0 ? '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-400">查無資料</td></tr>' : ''}
            \${members.results.map((m: any) => \`
              <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3 font-medium text-gray-800">\${m.chinese_name}</td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100">\${m.section}</span>
                  \${m.unit_name ? \`<span class="ml-1 text-gray-500">\${m.unit_name}</span>\` : ''}
                </td>
                <td class="px-4 py-3 text-sm text-amber-700 font-medium">
                  \${m.current_rank ? \`🏅 \${m.current_rank}\` : '<span class="text-gray-400 font-normal">無紀錄</span>'}
                </td>
                <td class="px-4 py-3 text-sm">
                  <a href="/admin/members/\${m.id}" class="text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-3 py-1 rounded hover:bg-blue-100 transition-colors">
                    管理進程紀錄 &rarr;
                  </a>
                </td>
              </tr>
            \`).join('')}
          </tbody>
        </table>
      </div>
    \`))
  }

  // ── 晉升申請審核頁面 ──
  const statusFilter = c.req.query('status') || 'pending'

  const applications = await db.prepare(\`
    SELECT aa.*, m.chinese_name, m.section, m.rank_level
    FROM advancement_applications aa
    JOIN members m ON m.id = aa.member_id
    \${statusFilter !== 'all' ? 'WHERE aa.status = ?' : ''}
    ORDER BY aa.created_at DESC LIMIT 100
  \`).bind(...(statusFilter !== 'all' ? [statusFilter] : [])).all()

  const counts = await db.prepare(\`
    SELECT status, COUNT(*) as cnt FROM advancement_applications GROUP BY status
  \`).all()
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

  return c.html(adminLayout('進程管理中心', \`
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-800">進程管理中心</h1>
      <a href="/admin/advancement/requirements" class="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
        <i class="fas fa-cog"></i>晉升條件管理
      </a>
    </div>

    <!-- 主 Tabs -->
    <div class="flex border-b mb-6">
      <a href="/admin/advancement?tab=applications" class="px-6 py-3 font-medium text-green-700 border-b-2 border-green-600">晉升申請審核</a>
      <a href="/admin/advancement?tab=members" class="px-6 py-3 font-medium text-gray-500 hover:text-gray-700">學員進程管理</a>
    </div>

    <!-- 篩選 tabs -->
    <div class="flex gap-2 mb-4 border-b flex-wrap">
      \${['all','pending','reviewing','approved','rejected'].map(s => \`
      <a href="/admin/advancement?tab=applications&status=\${s}" class="px-4 py-2 text-sm font-medium \${statusFilter === s ? 'border-b-2 border-green-600 text-green-700' : 'text-gray-500 hover:text-gray-700'}">
        \${s === 'all' ? '全部' : statusLabel[s]} \${s !== 'all' && countMap[s] ? \`(\${countMap[s]})\` : ''}
      </a>\`).join('')}
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
          \${applications.results.length === 0 ? '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400">尚無晉升申請</td></tr>' : ''}
          \${applications.results.map((a: any) => \`
            <tr class="hover:bg-gray-50 transition-colors">
              <td class="px-4 py-4">
                <div class="font-medium text-gray-800">\${a.chinese_name}</div>
                <div class="text-xs text-gray-500">\${a.section} \${a.rank_level ? \`· \${a.rank_level}\` : ''}</div>
              </td>
              <td class="px-4 py-4">
                <div class="flex items-center gap-2">
                  <span class="text-sm text-gray-500">\${a.current_rank}</span>
                  <span class="text-gray-300">&rarr;</span>
                  <span class="font-bold text-green-700">\${a.target_rank}</span>
                </div>
              </td>
              <td class="px-4 py-4 text-sm text-gray-600">
                \${new Date(a.created_at).toLocaleDateString()}
              </td>
              <td class="px-4 py-4">
                <span class="px-2.5 py-1 rounded-full text-xs font-medium \${statusColor[a.status]}">\
                  \${statusLabel[a.status]}\
                </span>
              </td>
              <td class="px-4 py-4">
                <a href="/admin/advancement/\${a.id}" class="text-blue-600 hover:text-blue-800 text-sm font-medium">審核 &rarr;</a>
              </td>
            </tr>
          \`).join('')}
        </tbody>
      </table>
    </div>
  \`))
})
\n`

const newContent = content.substring(0, start) + replacement + content.substring(end);
fs.writeFileSync(file, newContent);
console.log("Patched successfully");
