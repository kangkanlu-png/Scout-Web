const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf-8');

// Find the start of the /member-accounts route
const startIdx = code.indexOf("adminRoutes.get('/member-accounts', authMiddleware, async (c) => {");
const endIdx = code.indexOf("<!-- 新建帳號表單 -->", startIdx);

const newBlock = `adminRoutes.get('/member-accounts', authMiddleware, async (c) => {
  const db = c.env.DB

  const accounts = await db.prepare(\`
    SELECT ma.id, ma.username, ma.is_active, ma.last_login, ma.created_at,
      m.id as member_id, m.chinese_name, m.section, m.rank_level
    FROM member_accounts ma
    JOIN members m ON m.id = ma.member_id
    ORDER BY m.section, m.chinese_name
  \`).all()

  // 取得尚未建立帳號的成員
  const noAccount = await db.prepare(\`
    SELECT id, chinese_name, section, rank_level
    FROM members
    WHERE id NOT IN (SELECT member_id FROM member_accounts)
      AND membership_status = 'ACTIVE'
    ORDER BY section, chinese_name
  \`).all()
  
  // 取得管理員名單
  const adminAccounts = await db.prepare(\`SELECT id, username, created_at FROM admins ORDER BY username\`).all()

  return c.html(adminLayout('會員與管理員帳號', \`
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-800">會員與管理員帳號管理</h1>
    </div>

    <!-- 主 Tab 切換 -->
    <div class="border-b border-gray-200 mb-6">
      <nav class="-mb-px flex space-x-8">
        <button onclick="switchAccountTab('members')" id="tab-members" class="border-green-500 text-green-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors">
          會員帳號管理 (\${accounts.results.length})
        </button>
        <button onclick="switchAccountTab('admins')" id="tab-admins" class="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors">
          後台管理員管理 (\${adminAccounts.results.length})
        </button>
      </nav>
    </div>

    <!-- 會員帳號區塊 -->
    <div id="content-members" class="account-content">
      <div class="flex justify-end gap-2 mb-4">
        <button onclick="document.getElementById('csvImportModal').classList.remove('hidden')"
          class="bg-orange-500 hover:bg-orange-400 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
          <i class="fas fa-file-csv"></i>CSV 批次匯入
        </button>
        <button onclick="document.getElementById('newAccountForm').classList.toggle('hidden')"
          class="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
          <i class="fas fa-plus"></i>單筆建立
        </button>
      </div>
  \`;

code = code.substring(0, startIdx) + newBlock + code.substring(endIdx);

const bottomIdx = code.indexOf("          </tbody>", startIdx);
const bottomEndIdx = code.indexOf("      function switchStatus(id, current) {", bottomIdx);

const endContent = "          </tbody>\\n" +
"        </table>\\n" +
"      </div>\\n" +
"    </div>\\n" +
"\\n" +
"    <!-- 管理員帳號區塊 -->\\n" +
"    <div id=\"content-admins\" class=\"account-content hidden\">\\n" +
"      <div class=\"flex justify-end gap-2 mb-4\">\\n" +
"        <button onclick=\"document.getElementById('newAdminForm').classList.toggle('hidden')\"\\n" +
"          class=\"bg-purple-600 hover:bg-purple-500 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2\">\\n" +
"          <i class=\"fas fa-plus\"></i>新增管理員\\n" +
"        </button>\\n" +
"      </div>\\n" +
"\\n" +
"      <!-- 新建管理員表單 -->\\n" +
"      <div id=\"newAdminForm\" class=\"hidden bg-white rounded-xl shadow-sm border border-purple-200 p-5 mb-4\">\\n" +
"        <h3 class=\"font-semibold text-gray-800 mb-4\">建立後台管理員帳號</h3>\\n" +
"        <div class=\"grid sm:grid-cols-3 gap-4\">\\n" +
"          <div>\\n" +
"            <label class=\"block text-xs font-medium text-gray-600 mb-1\">登入帳號 (Username)</label>\\n" +
"            <input type=\"text\" id=\"admin_username\" class=\"w-full border border-gray-300 rounded px-3 py-2 text-sm\" placeholder=\"例如: admin\">\\n" +
"          </div>\\n" +
"          <div>\\n" +
"            <label class=\"block text-xs font-medium text-gray-600 mb-1\">登入密碼</label>\\n" +
"            <input type=\"password\" id=\"admin_password\" class=\"w-full border border-gray-300 rounded px-3 py-2 text-sm\">\\n" +
"          </div>\\n" +
"          <div class=\"flex items-end\">\\n" +
"            <button onclick=\"createAdmin()\" class=\"bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded text-sm w-full font-medium transition-colors\">\\n" +
"              <i class=\"fas fa-save mr-1\"></i>建立管理員\\n" +
"            </button>\\n" +
"          </div>\\n" +
"        </div>\\n" +
"      </div>\\n" +
"\\n" +
"      <div class=\"bg-white rounded-xl shadow overflow-hidden border border-gray-100\">\\n" +
"        <table class=\"w-full text-left border-collapse text-sm\">\\n" +
"          <thead class=\"bg-gray-50 border-b border-gray-100 text-gray-600\">\\n" +
"            <tr>\\n" +
"              <th class=\"py-3 px-4 font-medium\">帳號 (Username)</th>\\n" +
"              <th class=\"py-3 px-4 font-medium\">建立時間</th>\\n" +
"              <th class=\"py-3 px-4 font-medium\">操作</th>\\n" +
"            </tr>\\n" +
"          </thead>\\n" +
"          <tbody class=\"divide-y divide-gray-100\">\\n" +
"            ${adminAccounts.results.map((a: any) => `\\n" +
"              <tr class=\"hover:bg-gray-50 transition-colors\">\\n" +
"                <td class=\"py-3 px-4 font-medium text-purple-700\">${a.username}</td>\\n" +
"                <td class=\"py-3 px-4 text-gray-500\">${a.created_at ? a.created_at.substring(0, 16) : '-'}</td>\\n" +
"                <td class=\"py-3 px-4\">\\n" +
"                  <div class=\"flex gap-2\">\\n" +
"                    <button onclick=\"resetAdminPassword(${a.id}, '${a.username}')\" class=\"text-blue-500 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors\">重設密碼</button>\\n" +
"                    ${a.username !== 'admin' ? `<button onclick=\"deleteAdmin(${a.id}, '${a.username}')\" class=\"text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors\">刪除</button>` : ''}\\n" +
"                  </div>\\n" +
"                </td>\\n" +
"              </tr>\\n" +
"            `).join('')}\\n" +
"            ${adminAccounts.results.length === 0 ? '<tr><td colspan=\"3\" class=\"py-8 text-center text-gray-400\">目前尚無管理員資料</td></tr>' : ''}\\n" +
"          </tbody>\\n" +
"        </table>\\n" +
"      </div>\\n" +
"    </div>\\n" +
"\\n" +
"    <script>\\n" +
"      function switchAccountTab(tabId) {\\n" +
"        document.querySelectorAll('.account-content').forEach(el => el.classList.add('hidden'));\\n" +
"        document.getElementById('content-' + tabId).classList.remove('hidden');\\n" +
"        \\n" +
"        document.querySelectorAll('[id^=\"tab-\"]').forEach(el => {\\n" +
"          el.classList.remove('border-green-500', 'text-green-600');\\n" +
"          el.classList.add('border-transparent', 'text-gray-500');\\n" +
"        });\\n" +
"        const activeTab = document.getElementById('tab-' + tabId);\\n" +
"        activeTab.classList.remove('border-transparent', 'text-gray-500');\\n" +
"        activeTab.classList.add('border-green-500', 'text-green-600');\\n" +
"      }\\n" +
"\\n" +
"      async function createAdmin() {\\n" +
"        const username = document.getElementById('admin_username').value.trim();\\n" +
"        const password = document.getElementById('admin_password').value;\\n" +
"        if (!username || !password) return alert('帳號與密碼為必填');\\n" +
"\\n" +
"        const res = await fetch('/api/admin/admins', {\\n" +
"          method: 'POST', headers: {'Content-Type':'application/json'},\\n" +
"          body: JSON.stringify({ username, password })\\n" +
"        });\\n" +
"        const data = await res.json();\\n" +
"        if (data.success) {\\n" +
"          alert('管理員建立成功！');\\n" +
"          location.reload();\\n" +
"        } else {\\n" +
"          alert('建立失敗: ' + (data.error || ''));\\n" +
"        }\\n" +
"      }\\n" +
"\\n" +
"      async function resetAdminPassword(id, username) {\\n" +
"        const newPassword = prompt('請輸入「' + username + '」的新密碼：');\\n" +
"        if (!newPassword) return;\\n" +
"\\n" +
"        const res = await fetch('/api/admin/admins/' + id + '/reset-password', {\\n" +
"          method: 'PUT', headers: {'Content-Type':'application/json'},\\n" +
"          body: JSON.stringify({ password: newPassword })\\n" +
"        });\\n" +
"        if (res.ok) alert('密碼重設成功！');\\n" +
"        else alert('重設失敗');\\n" +
"      }\\n" +
"\\n" +
"      async function deleteAdmin(id, username) {\\n" +
"        if (!confirm('確定要刪除管理員「' + username + '」嗎？這將導致該帳號無法再登入後台！')) return;\\n" +
"        const res = await fetch('/api/admin/admins/' + id, { method: 'DELETE' });\\n" +
"        if (res.ok) {\\n" +
"          alert('刪除成功');\\n" +
"          location.reload();\\n" +
"        } else alert('刪除失敗');\\n" +
"      }\\n\\n";

code = code.substring(0, bottomIdx) + endContent + code.substring(bottomEndIdx);

fs.writeFileSync('src/routes/admin.tsx', code);
console.log('Patched UI for admin accounts management');
