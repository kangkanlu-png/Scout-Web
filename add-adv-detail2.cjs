const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/routes/admin.tsx');
let content = fs.readFileSync(file, 'utf-8');

const handlerCode = `
// ===================== 晉升申請詳細 =====================
adminRoutes.get('/advancement/:id', authMiddleware, async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  
  // exclude 'requirements' or 'badges' which might match :id
  if (id === 'requirements' || id === 'badges') return c.notFound()

  const app = await db.prepare(\`
    SELECT aa.*, m.chinese_name, m.section, m.unit_name, m.rank_level
    FROM advancement_applications aa
    JOIN members m ON m.id = aa.member_id
    WHERE aa.id = ?
  \`).bind(id).first() as any

  if (!app) return c.redirect('/admin/advancement')

  const statusLabel: Record<string, string> = {
    pending: '待審核', reviewing: '審核中', approved: '已通過', rejected: '未通過'
  }
  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    reviewing: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800'
  }

  return c.html(adminLayout('晉升申請詳細', \`
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <a href="/admin/advancement" class="text-gray-500 hover:text-gray-700 text-xl"><i class="fas fa-arrow-left"></i></a>
        <h1 class="text-2xl font-bold text-gray-800">晉升申請審核</h1>
      </div>
      <span class="px-3 py-1 rounded-full text-sm font-medium \${statusColor[app.status]}">
        \${statusLabel[app.status]}
      </span>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-2xl">
      <h2 class="text-lg font-bold text-gray-800 mb-4 border-b pb-3">申請資料</h2>
      
      <div class="space-y-4 text-sm">
        <div class="grid grid-cols-3 gap-4">
          <div class="text-gray-500">申請人</div>
          <div class="col-span-2 font-medium text-gray-800">\${app.chinese_name} (\${app.section} \${app.unit_name ? '· '+app.unit_name : ''})</div>
        </div>
        <div class="grid grid-cols-3 gap-4">
          <div class="text-gray-500">目前進程</div>
          <div class="col-span-2">\${app.rank_from}</div>
        </div>
        <div class="grid grid-cols-3 gap-4">
          <div class="text-gray-500">申請晉升至</div>
          <div class="col-span-2 font-bold text-green-700">\${app.rank_to}</div>
        </div>
        <div class="grid grid-cols-3 gap-4">
          <div class="text-gray-500">申請日期</div>
          <div class="col-span-2">\${new Date(app.apply_date).toLocaleDateString()}</div>
        </div>
        
        \${app.evidence_file ? \`
        <div class="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-100">
          <div class="text-gray-500">佐證資料</div>
          <div class="col-span-2">
            <a href="\${app.evidence_file}" target="_blank" class="inline-flex items-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
              <i class="fas fa-file-download"></i> 查看附檔
            </a>
          </div>
        </div>
        \` : \`
        <div class="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-100">
          <div class="text-gray-500">佐證資料</div>
          <div class="col-span-2 text-gray-400">無附檔</div>
        </div>
        \`}
      </div>

      \${app.status === 'pending' || app.status === 'reviewing' ? \`
      <div class="mt-8 border-t pt-6">
        <h3 class="font-bold text-gray-800 mb-3">審核操作</h3>
        <textarea id="admin_notes" rows="3" class="w-full border rounded-lg p-3 text-sm mb-4 focus:ring-2 focus:ring-green-500 outline-none" placeholder="審核備註 (非必填)"></textarea>
        <div class="flex gap-3">
          <button onclick="updateStatus('approved')" class="flex-1 bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-lg font-medium transition-colors">
            <i class="fas fa-check mr-1"></i> 核准晉升
          </button>
          <button onclick="updateStatus('rejected')" class="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-lg font-medium transition-colors">
            <i class="fas fa-times mr-1"></i> 退回申請
          </button>
        </div>
        \${app.status === 'pending' ? \`
        <button onclick="updateStatus('reviewing')" class="w-full mt-3 bg-blue-50 text-blue-600 hover:bg-blue-100 py-2.5 rounded-lg font-medium transition-colors text-sm">
          標記為「審核中」
        </button>
        \` : ''}
      </div>
      \` : \`
      <div class="mt-8 border-t pt-6">
        <div class="bg-gray-50 p-4 rounded-xl">
          <p class="text-sm text-gray-600 mb-1"><strong>審核備註：</strong> \${app.admin_notes || '無'}</p>
          <p class="text-xs text-gray-400">審核時間：\${new Date(app.reviewed_at).toLocaleString()}</p>
        </div>
      </div>
      \`}
    </div>

    <script>
      async function updateStatus(status) {
        if (status === 'approved' && !confirm('確定要核准此申請？系統將自動為該學員新增進程紀錄並更新最高階級。')) return;
        if (status === 'rejected' && !confirm('確定要退回此申請？')) return;
        
        const notes = document.getElementById('admin_notes')?.value || '';
        
        try {
          const res = await fetch('/api/admin/advancement/\${app.id}', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status, admin_notes: notes })
          });
          const result = await res.json();
          if (result.success) {
            location.reload();
          } else {
            alert('操作失敗：' + (result.error || ''));
          }
        } catch(err) {
          alert('網路錯誤');
        }
      }
    </script>
  \`))
})

`;

content = content.replace(`adminRoutes.get('/advancement/requirements', authMiddleware, async (c) => {`, handlerCode + `adminRoutes.get('/advancement/requirements', authMiddleware, async (c) => {`);
fs.writeFileSync(file, content);
console.log('Added advancement detail route');
