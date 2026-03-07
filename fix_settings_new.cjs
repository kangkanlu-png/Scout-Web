const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

const regex = /adminRoutes\.get\('\/settings', authMiddleware, async \(c\) => \{[\s\S]*?\/\/ ===================== 相關網頁管理 =====================/

const replacement = `adminRoutes.get('/settings', authMiddleware, async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(\`SELECT key, value FROM site_settings\`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  const tab = c.req.query('tab') || 'general'

  return c.html(adminLayout('網站設定', \`
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-bold text-gray-800">網站設定</h2>
    </div>

    <!-- Tabs -->
    <div class="flex space-x-2 border-b border-gray-200 mb-6">
      <a href="?tab=general" class="px-4 py-2 border-b-2 font-medium text-sm transition-colors \${tab === 'general' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">一般設定</a>
      <a href="?tab=scout" class="px-4 py-2 border-b-2 font-medium text-sm transition-colors \${tab === 'scout' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">認識童軍頁面</a>
      <a href="?tab=leaders" class="px-4 py-2 border-b-2 font-medium text-sm transition-colors \${tab === 'leaders' ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}">服務員介紹頁面</a>
    </div>

    <div class="bg-white rounded-xl shadow p-6">
      <form id="settings-form" class="space-y-5">
        \${tab === 'general' ? \`
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">網站標題（中文）</label>
            <input type="text" name="site_title" value="\${settings.site_title || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">網站副標題（英文）</label>
            <input type="text" name="site_subtitle" value="\${settings.site_subtitle || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">關於我們（中文）</label>
            <textarea name="about_text_zh" rows="4" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">\${settings.about_text_zh || ''}</textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">About Us (English)</label>
            <textarea name="about_text_en" rows="4" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">\${settings.about_text_en || ''}</textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Facebook 網址</label>
            <input type="url" name="facebook_url" value="\${settings.facebook_url || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Instagram 網址</label>
            <input type="url" name="instagram_url" value="\${settings.instagram_url || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">聯絡信箱</label>
            <input type="email" name="contact_email" value="\${settings.contact_email || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          </div>
        \` : ''}
        
        \${tab === 'scout' ? \`
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">認識童軍（支援 HTML）</label>
            <textarea name="about_scout_content" rows="15" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono">\${settings.about_scout_content || ''}</textarea>
            <p class="text-xs text-gray-500 mt-2">請輸入HTML語法，此內容將直接顯示於前台的「認識童軍」頁面。</p>
          </div>
        \` : ''}

        \${tab === 'leaders' ? \`
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">服務員介紹（支援 HTML）</label>
            <textarea name="about_leaders_content" rows="15" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono">\${settings.about_leaders_content || ''}</textarea>
            <p class="text-xs text-gray-500 mt-2">請輸入HTML語法，此內容將直接顯示於前台的「服務員介紹」頁面。</p>
          </div>
        \` : ''}

        <div id="save-msg" class="hidden bg-green-50 text-green-700 border border-green-200 rounded-lg px-4 py-3 text-sm">✅ 設定已儲存！</div>
        <div class="pt-4 border-t border-gray-100 flex justify-end">
          <button type="submit" class="bg-green-700 hover:bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium">儲存設定</button>
        </div>
      </form>
    </div>
    
    <script>
      document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {};
        for (const [k, v] of formData.entries()) data[k] = v;
        const res = await fetch('/api/settings', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
        if (res.ok) {
          document.getElementById('save-msg').classList.remove('hidden');
          setTimeout(() => document.getElementById('save-msg').classList.add('hidden'), 3000);
        } else alert('儲存失敗');
      });
    </script>
  \`))
})

// ===================== 相關網頁管理 =====================`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/routes/admin.tsx', code);
console.log('Patched settings!');
