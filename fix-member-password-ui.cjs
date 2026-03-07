const fs = require('fs');
let code = fs.readFileSync('src/routes/member.tsx', 'utf8');

// Add modify password button
const oldNav = `        <a href="/member/logout" class="bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-full transition-colors">
          <i class="fas fa-sign-out-alt mr-1"></i>登出
        </a>`;
const newNav = `        <button onclick="document.getElementById('pwd-modal').classList.remove('hidden')" class="bg-blue-700 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full transition-colors">
          <i class="fas fa-key mr-1"></i>密碼
        </button>
        <a href="/member/logout" class="bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-full transition-colors">
          <i class="fas fa-sign-out-alt mr-1"></i>登出
        </a>`;

code = code.replace(oldNav, newNav);

// Add the modal HTML to memberLayout
const modifyPwdModal = `
  <!-- 修改密碼 Modal -->
  <div id="pwd-modal" class="fixed inset-0 bg-black/50 hidden items-center justify-center z-50 flex">
    <div class="bg-white rounded-2xl w-full max-w-sm mx-4 overflow-hidden shadow-xl">
      <div class="bg-blue-600 px-4 py-3 flex justify-between items-center text-white">
        <h3 class="font-bold"><i class="fas fa-key mr-2"></i>修改密碼</h3>
        <button onclick="document.getElementById('pwd-modal').classList.add('hidden')" class="hover:text-blue-200">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="p-5">
        <form id="pwd-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">舊密碼</label>
            <input type="password" id="pwd-old" required class="w-full border-gray-300 rounded-lg p-2 bg-gray-50 border focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">新密碼</label>
            <input type="password" id="pwd-new" required minlength="6" class="w-full border-gray-300 rounded-lg p-2 bg-gray-50 border focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <p class="text-xs text-gray-500 mt-1">至少 6 個字元</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">確認新密碼</label>
            <input type="password" id="pwd-confirm" required minlength="6" class="w-full border-gray-300 rounded-lg p-2 bg-gray-50 border focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
          </div>
          <div id="pwd-msg" class="text-sm font-medium hidden"></div>
          <div class="pt-2">
            <button type="submit" class="w-full bg-blue-600 text-white rounded-lg py-2.5 font-bold hover:bg-blue-700 transition-colors">
              儲存密碼
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const pwdForm = document.getElementById('pwd-form');
      if (pwdForm) {
        pwdForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const oldPwd = document.getElementById('pwd-old').value;
          const newPwd = document.getElementById('pwd-new').value;
          const confirmPwd = document.getElementById('pwd-confirm').value;
          const msgEl = document.getElementById('pwd-msg');
          
          if (newPwd !== confirmPwd) {
            msgEl.textContent = '新密碼與確認密碼不相符';
            msgEl.className = 'text-sm font-medium text-red-600 block';
            return;
          }
          
          msgEl.textContent = '處理中...';
          msgEl.className = 'text-sm font-medium text-blue-600 block';
          
          try {
            const res = await fetch('/api/member/password', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ old_password: oldPwd, new_password: newPwd })
            });
            const data = await res.json();
            
            if (data.success) {
              msgEl.textContent = '密碼修改成功！';
              msgEl.className = 'text-sm font-medium text-green-600 block';
              setTimeout(() => {
                document.getElementById('pwd-modal').classList.add('hidden');
                pwdForm.reset();
                msgEl.classList.add('hidden');
              }, 1500);
            } else {
              msgEl.textContent = data.error || '發生錯誤';
              msgEl.className = 'text-sm font-medium text-red-600 block';
            }
          } catch (err) {
            msgEl.textContent = '網路錯誤，請稍後再試';
            msgEl.className = 'text-sm font-medium text-red-600 block';
          }
        });
      }
    });
  </script>
</body>`;

code = code.replace("</body>", modifyPwdModal);

fs.writeFileSync('src/routes/member.tsx', code);
