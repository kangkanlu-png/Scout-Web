const fs = require('fs');

let code = fs.readFileSync('src/routes/admin.tsx', 'utf-8');

const targetStr = `    </div>\` : ''}

    <script>`;

if (!code.includes(targetStr)) {
  console.log("Could not find the target string. Exiting.");
  process.exit(1);
}

const replacementStr = `    </div>\` : ''}
    </div> <!-- end member-section -->
    
    <div id="admin-section" class="hidden">
      <div class="flex justify-end mb-4">
        <button onclick="document.getElementById('newAdminForm').classList.toggle('hidden')" class="bg-purple-600 hover:bg-purple-500 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
          <i class="fas fa-plus"></i>新增管理員
        </button>
      </div>

      <div id="newAdminForm" class="hidden bg-white rounded-xl shadow-sm border border-purple-200 p-5 mb-4">
        <h3 class="font-semibold text-gray-800 mb-4">建立後台管理員帳號</h3>
        <div class="grid sm:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">登入帳號 (Username)</label>
            <input type="text" id="admin_username" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="例如: admin">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">登入密碼</label>
            <input type="password" id="admin_password" class="w-full border border-gray-300 rounded px-3 py-2 text-sm">
          </div>
          <div class="flex items-end">
            <button onclick="createAdmin()" class="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded text-sm w-full font-medium transition-colors">
              建立管理員
            </button>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl shadow overflow-hidden border border-gray-100">
        <table class="w-full text-left border-collapse text-sm">
          <thead class="bg-gray-50 border-b border-gray-100 text-gray-600">
            <tr>
              <th class="py-3 px-4 font-medium">帳號 (Username)</th>
              <th class="py-3 px-4 font-medium">建立時間</th>
              <th class="py-3 px-4 font-medium">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            \${adminAccounts.results.map((a: any) => \`
              <tr class="hover:bg-gray-50 transition-colors">
                <td class="py-3 px-4 font-medium text-purple-700">\${a.username}</td>
                <td class="py-3 px-4 text-gray-500">\${a.created_at ? a.created_at.substring(0, 16) : '-'}</td>
                <td class="py-3 px-4">
                  <div class="flex gap-2">
                    <button onclick="resetAdminPassword(\${a.id}, '\${a.username}')" class="text-blue-500 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors">重設密碼</button>
                    \${a.username !== 'admin' ? \`<button onclick="deleteAdmin(\${a.id}, '\${a.username}')" class="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors">刪除</button>\` : ''}
                  </div>
                </td>
              </tr>
            \`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    <script>
      async function createAdmin() {
        const username = document.getElementById('admin_username').value.trim();
        const password = document.getElementById('admin_password').value;
        if (!username || !password) return alert('帳號與密碼為必填');
        const res = await fetch('/api/admin/admins', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ username, password })
        });
        if (res.ok) { alert('成功！'); location.reload(); } else { const r=await res.json(); alert('失敗: ' + r.error); }
      }
      async function resetAdminPassword(id, username) {
        const p = prompt('請輸入「' + username + '」的新密碼：');
        if (!p) return;
        const res = await fetch('/api/admin/admins/' + id + '/reset-password', {
          method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ password: p })
        });
        if (res.ok) alert('重設成功！'); else alert('失敗');
      }
      async function deleteAdmin(id, username) {
        if (!confirm('確定刪除管理員「' + username + '」嗎？')) return;
        const res = await fetch('/api/admin/admins/' + id, { method: 'DELETE' });
        if (res.ok) { alert('成功'); location.reload(); } else alert('失敗');
      }
`;

code = code.replace(targetStr, replacementStr);

fs.writeFileSync('src/routes/admin.tsx', code);
console.log('Successfully injected admin-section HTML and JS.');
