const fs = require('fs');
const file = 'src/routes/admin.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldSettingsRoute = `adminRoutes.get('/settings', authMiddleware, async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(\`SELECT key, value FROM site_settings\`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  return c.html(adminLayout('網站設定', \`
    <h2 class="text-xl font-bold text-gray-800 mb-6">網站設定</h2>
    <div class="bg-white rounded-xl shadow p-6">
      <form id="settings-form" class="space-y-5">
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
        <div class="pt-4 border-t border-gray-100 flex justify-end">
          <button type="button" onclick="saveSettings()" class="bg-green-700 hover:bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium shadow transition-colors">儲存設定</button>
        </div>
      </form>
    </div>
    
    <script>
      async function saveSettings() {
        const formData = new FormData(document.getElementById('settings-form'))
        const data = Object.fromEntries(formData.entries())
        
        try {
          const res = await fetch('/api/admin/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          })
          if (res.ok) {
            alert('設定已儲存')
            location.reload()
          } else {
            alert('儲存失敗')
          }
        } catch (e) {
          console.error(e)
          alert('儲存失敗')
        }
      }
    </script>
  \`))
})`

const newSettingsRoute = `adminRoutes.get('/settings', authMiddleware, async (c) => {
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

        <div class="pt-4 border-t border-gray-100 flex justify-end">
          <button type="button" onclick="saveSettings()" class="bg-green-700 hover:bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium shadow transition-colors">儲存設定</button>
        </div>
      </form>
    </div>
    
    <script>
      async function saveSettings() {
        const formData = new FormData(document.getElementById('settings-form'))
        const data = Object.fromEntries(formData.entries())
        
        try {
          const res = await fetch('/api/admin/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          })
          if (res.ok) {
            alert('設定已儲存')
            location.reload()
          } else {
            alert('儲存失敗')
          }
        } catch (e) {
          console.error(e)
          alert('儲存失敗')
        }
      }
    </script>
  \`))
})`

if (code.includes('adminRoutes.get(\'/settings\', authMiddleware, async (c) => {')) {
  // Let's replace just the block
  let index = code.indexOf('adminRoutes.get(\'/settings\'');
  let nextRoute = code.indexOf('adminRoutes.get(\'/groups\', authMiddleware, async (c) => {');
  if (nextRoute !== -1) {
    let block = code.substring(index, nextRoute);
    // Find the end of the block
    let actualBlock = block.substring(0, block.lastIndexOf('})') + 2);
    code = code.replace(actualBlock, newSettingsRoute);
    fs.writeFileSync(file, code);
    console.log('Patched /settings tabs');
  }
}

