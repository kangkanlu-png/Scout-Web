const fs = require('fs');
let code = fs.readFileSync('src/routes/frontend.tsx', 'utf8');

const aboutRoutes = `
// ===================== 認識童軍 / 服務員介紹 =====================
frontendRoutes.get('/about/scout', async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(\`SELECT key, value FROM site_settings\`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })
  
  return c.html(\`\${pageHead('認識童軍 - 林口康橋童軍團')}
  <div class="max-w-4xl mx-auto px-4 py-10 min-h-[60vh]">
    <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">認識童軍</h1>
    <div class="bg-white rounded-xl shadow-md p-8 prose max-w-none text-gray-700 leading-relaxed">
      \${settings.about_scout_content || '<p class="text-gray-500 text-center">內容建置中...</p>'}
    </div>
  </div>
  \${pageFooter(settings)}\`)
})

frontendRoutes.get('/about/leaders', async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(\`SELECT key, value FROM site_settings\`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })
  
  return c.html(\`\${pageHead('服務員介紹 - 林口康橋童軍團')}
  <div class="max-w-4xl mx-auto px-4 py-10 min-h-[60vh]">
    <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">服務員介紹</h1>
    <div class="bg-white rounded-xl shadow-md p-8 prose max-w-none text-gray-700 leading-relaxed">
      \${settings.about_leaders_content || '<p class="text-gray-500 text-center">內容建置中...</p>'}
    </div>
  </div>
  \${pageFooter(settings)}\`)
})
`

// Append to the file just before the `function generateGroupPage` or at the end
code += '\n' + aboutRoutes + '\n';

fs.writeFileSync('src/routes/frontend.tsx', code);
console.log('Patched frontend about pages at the end');
