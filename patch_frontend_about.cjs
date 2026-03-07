const fs = require('fs');
let code = fs.readFileSync('src/routes/frontend.tsx', 'utf8');

// 1. Add Instagram button next to Facebook button
code = code.replace(
  /(\$\{settings\.facebook_url \? `\n\s*<div class="mt-6">\n\s*<a href="\$\{settings\.facebook_url\}"[^>]*>\n\s*<i class="fab fa-facebook"><\/i> 追蹤我們的 Facebook\n\s*<\/a>\n\s*<\/div>\n\s*` : ''\})/,
  `$1\n        \${settings.instagram_url ? \`\n          <div class="mt-6">\n            <a href="\${settings.instagram_url}" target="_blank" class="inline-flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-5 py-2.5 rounded-lg transition-colors">\n              <i class="fab fa-instagram"></i> 追蹤我們的 Instagram\n            </a>\n          </div>\n        \` : ''}`
);

// We need to match where it renders the about pages, but wait, those routes don't exist yet!
// Let's find the end of the file or somewhere safe to add them.
// "frontendRoutes.get('/', ..." starts at line 2351. Let's add them before that.

const aboutRoutes = `
frontendRoutes.get('/about/scout', async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(\`SELECT key, value FROM site_settings\`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })
  
  return c.html(layout(c, '認識童軍', \`
    <div class="max-w-4xl mx-auto px-4 py-10">
      <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">認識童軍</h1>
      <div class="bg-white rounded-xl shadow-md p-8 prose max-w-none">
        \${settings.about_scout_content || '<p class="text-gray-500 text-center">內容建置中...</p>'}
      </div>
    </div>
  \`))
})

frontendRoutes.get('/about/leaders', async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(\`SELECT key, value FROM site_settings\`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })
  
  return c.html(layout(c, '服務員介紹', \`
    <div class="max-w-4xl mx-auto px-4 py-10">
      <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">服務員介紹</h1>
      <div class="bg-white rounded-xl shadow-md p-8 prose max-w-none">
        \${settings.about_leaders_content || '<p class="text-gray-500 text-center">內容建置中...</p>'}
      </div>
    </div>
  \`))
})
`

// Just add them at the bottom of the file before `export default frontendRoutes`
code = code.replace(/export default frontendRoutes/, aboutRoutes + '\nexport default frontendRoutes');

fs.writeFileSync('src/routes/frontend.tsx', code);
console.log('Patched frontend about pages and IG');
