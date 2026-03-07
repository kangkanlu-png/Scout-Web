const fs = require('fs');
const file = 'src/routes/frontend.tsx';
let code = fs.readFileSync(file, 'utf8');

const newRoutes = `
// ===================== 認識童軍 =====================
frontendRoutes.get('/about/scout', async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(\`SELECT key, value FROM site_settings\`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  return c.html(\`\${pageHead('認識童軍 - 林口康橋童軍團')}
<body class="bg-gray-50">
  \${navBar(settings)}
  <div class="hero-gradient text-white py-14 px-4">
    <div class="max-w-5xl mx-auto text-center">
      <h1 class="text-3xl md:text-4xl font-bold">認識童軍</h1>
      <p class="text-green-200 mt-2">Scouting Introduction</p>
    </div>
  </div>
  <div class="max-w-4xl mx-auto px-4 py-10">
    <div class="bg-white rounded-xl shadow-sm p-8">
      <h2 class="text-2xl font-bold text-gray-800 mb-4 text-center">準備、日行一善、人生以服務為目的</h2>
      <p class="text-gray-600 leading-relaxed mb-4">
        童軍活動（Scouting）是一個國際性的、按照特定方法進行的青少年社會性運動。童軍運動的目的，是向青少年提供他們在生理、心理和精神上的支持，培養出健全的公民。
      </p>
      <p class="text-gray-600 leading-relaxed">
        （詳細內容可於後台建置或在此頁面進一步擴充）
      </p>
    </div>
  </div>
</body></html>\`)
})

// ===================== 服務員介紹 =====================
frontendRoutes.get('/about/leaders', async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(\`SELECT key, value FROM site_settings\`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  return c.html(\`\${pageHead('服務員介紹 - 林口康橋童軍團')}
<body class="bg-gray-50">
  \${navBar(settings)}
  <div class="hero-gradient text-white py-14 px-4">
    <div class="max-w-5xl mx-auto text-center">
      <h1 class="text-3xl md:text-4xl font-bold">服務員介紹</h1>
      <p class="text-green-200 mt-2">Scout Leaders & Staff</p>
    </div>
  </div>
  <div class="max-w-4xl mx-auto px-4 py-10">
    <div class="bg-white rounded-xl shadow-sm p-8 text-center">
      <div class="text-6xl mb-4">🤝</div>
      <h2 class="text-2xl font-bold text-gray-800 mb-4">感謝每一位付出的服務員</h2>
      <p class="text-gray-600 leading-relaxed">
        童軍服務員是推動童軍活動的幕後推手，以志願服務的精神，帶領孩子們成長。
      </p>
      <p class="text-gray-600 leading-relaxed mt-4">
        （未來可串接資料庫，動態顯示各分團服務員名單）
      </p>
    </div>
  </div>
</body></html>\`)
})
`;

// Insert the new routes before `export default frontendRoutes`
code = code.replace('export default frontendRoutes', newRoutes + '\nexport default frontendRoutes');

fs.writeFileSync(file, code);
console.log('Patched about routes');
