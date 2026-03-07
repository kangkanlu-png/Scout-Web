const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/routes/admin.tsx');
let content = fs.readFileSync(file, 'utf-8');

// 1. Add menu item
content = content.replace(
  /<a href="\/admin\/progress" class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-xs \$\{title === '進程標準設定' \? 'bg-green-700' : 'text-green-200'\}">\n            📏 標準設定\n          <\/a>/g,
  `<a href="/admin/progress" class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-xs \${title === '進程標準設定' ? 'bg-green-700' : 'text-green-200'}">
            📏 標準設定
          </a>
          <a href="/admin/group-honors" class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-xs \${title === '榮譽榜管理' ? 'bg-green-700' : 'text-green-200'}">
            🏆 榮譽榜管理
          </a>`
);

// 2. Add route handler
const routeCode = `
// ── 榮譽榜管理 ──
adminRoutes.get('/group-honors', async (c) => {
  const db = c.env.DB
  const honors = await db.prepare('SELECT * FROM group_honors ORDER BY year_label DESC, created_at DESC').all()
  
  return c.html(adminLayout('榮譽榜管理', \`
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-gray-800">🏆 榮譽榜管理 (團體獎項)</h2>
      <button onclick="document.getElementById('addModal').classList.remove('hidden')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
        ＋ 新增榮譽記錄
      </button>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-gray-50 border-b border-gray-200">
            <th class="p-4 font-semibold text-gray-700">獎項名稱</th>
            <th class="p-4 font-semibold text-gray-700">年度/年份</th>
            <th class="p-4 font-semibold text-gray-700">階層</th>
            <th class="p-4 font-semibold text-gray-700">建立時間</th>
            <th class="p-4 font-semibold text-gray-700 w-24">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          \${honors.results.length > 0 ? honors.results.map((h: any) => \`
            <tr class="hover:bg-gray-50/50">
              <td class="p-4 font-medium text-amber-800">\${h.honor_name}</td>
              <td class="p-4 text-gray-600">\${h.year_label}</td>
              <td class="p-4"><span class="bg-rose-100 text-rose-800 px-2 py-1 rounded text-xs font-bold">第 \${h.tier} 階</span></td>
              <td class="p-4 text-sm text-gray-500">\${new Date(h.created_at).toLocaleDateString()}</td>
              <td class="p-4">
                <button onclick="deleteHonor('\${h.id}')" class="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded transition-colors" title="刪除">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </td>
            </tr>
          \`).join('') : '<tr><td colspan="5" class="p-8 text-center text-gray-500">尚無記錄</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- 新增 Modal -->
    <div id="addModal" class="fixed inset-0 bg-black/50 hidden flex items-center justify-center z-50">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 class="text-lg font-bold text-gray-800">新增榮譽記錄</h3>
          <button onclick="document.getElementById('addModal').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <form onsubmit="saveHonor(event)" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">獎項名稱</label>
            <input type="text" id="honor_name" placeholder="例如：績優童軍團" required class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">年度/年份</label>
            <input type="text" id="year_label" placeholder="例如：110年" required class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">所屬階層</label>
            <select id="tier" class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="1">第一階：全國性</option>
              <option value="2">第二階：縣市級</option>
              <option value="3">第三階：童軍團</option>
            </select>
          </div>
          <div class="pt-2 flex justify-end gap-3">
            <button type="button" onclick="document.getElementById('addModal').classList.add('hidden')" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">取消</button>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">儲存</button>
          </div>
        </form>
      </div>
    </div>

    <script>
      async function saveHonor(e) {
        e.preventDefault();
        const data = {
          honor_name: document.getElementById('honor_name').value,
          year_label: document.getElementById('year_label').value,
          tier: parseInt(document.getElementById('tier').value)
        };
        try {
          const res = await fetch('/api/admin/group-honors', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
          });
          if (res.ok) location.reload();
          else alert('儲存失敗');
        } catch(err) {
          alert('發生錯誤');
        }
      }

      async function deleteHonor(id) {
        if(!confirm('確定要刪除此記錄？')) return;
        try {
          const res = await fetch('/api/admin/group-honors/' + id, { method: 'DELETE' });
          if(res.ok) location.reload();
          else alert('刪除失敗');
        } catch(err) {
          alert('發生錯誤');
        }
      }
    </script>
  \`))
})

export default adminRoutes
`

content = content.replace(/export default adminRoutes\n?$/g, routeCode);
fs.writeFileSync(file, content);
console.log('Added Admin UI');
