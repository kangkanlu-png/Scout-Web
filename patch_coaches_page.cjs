const fs = require('fs');
let code = fs.readFileSync('src/routes/frontend.tsx', 'utf8');

const regex = /\/\/ ===================== 教練團總覽頁（公開）→ 重定向至行義團教練團頁 =====================[\s\S]*?frontendRoutes\.get\('\/coaches', async \(c\) => \{[\s\S]*?return c\.redirect\('\/group\/senior-scout\/coaches-list', 302\)[\s\S]*?\}\)/;

const newRoute = `// ===================== 教練團總覽頁 =====================
frontendRoutes.get('/coaches', async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(\`SELECT key, value FROM site_settings\`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  const coaches = await db.prepare(\`SELECT * FROM coach_members ORDER BY chinese_name ASC\`).all()
  
  const levels = ['指導教練', '助理教練', '見習教練', '預備教練']
  const grouped = {
    '指導教練': [],
    '助理教練': [],
    '見習教練': [],
    '預備教練': [],
    '其他': []
  }
  
  coaches.results.forEach((c: any) => {
    if (grouped[c.coach_level]) {
      grouped[c.coach_level].push(c)
    } else {
      grouped['其他'].push(c)
    }
  })

  let html = \`\${pageHead('教練團組織 - 林口康橋童軍團')}
<body class="bg-gray-50 font-sans">
  \${navBar(settings)}
  
  <div class="hero-gradient text-white py-16 px-4">
    <div class="max-w-5xl mx-auto text-center">
      <div class="text-5xl mb-4">🧗‍♂️</div>
      <h1 class="text-4xl font-bold mb-4 drop-shadow-md">教練團組織</h1>
      <p class="text-lg text-green-100 max-w-2xl mx-auto leading-relaxed drop-shadow">
        林口康橋童軍團專業教練群，帶領各階段進程與戶外技能訓練。
      </p>
    </div>
  </div>

  <div class="max-w-6xl mx-auto px-4 py-12 min-h-[50vh]">
  \`

  levels.forEach(level => {
    const list = grouped[level]
    if (list.length > 0) {
      html += \`
        <div class="mb-12">
          <div class="flex items-center gap-3 mb-6 border-b-2 border-green-700 pb-2">
            <h2 class="text-2xl font-bold text-gray-800">\${level}</h2>
            <span class="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">\${list.length} 人</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            \${list.map((c: any) => \`
              <div class="bg-white border border-gray-200 rounded-xl p-4 text-center hover:shadow-md transition-shadow">
                <div class="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 text-green-700 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
                  \${c.chinese_name.substring(0, 1)}
                </div>
                <h3 class="font-bold text-gray-900">\${c.chinese_name}</h3>
                \${c.english_name ? \`<div class="text-xs text-gray-500 mb-2">\${c.english_name}</div>\` : ''}
                \${c.specialties ? \`
                  <div class="mt-2 flex flex-wrap justify-center gap-1">
                    \${c.specialties.split(',').map((s:string) => \`<span class="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">\${s.trim()}</span>\`).join('')}
                  </div>
                \` : ''}
              </div>
            \`).join('')}
          </div>
        </div>
      \`
    }
  })

  // 如果完全沒有資料
  if (coaches.results.length === 0) {
    html += \`<div class="text-center py-16 text-gray-500">目前尚無教練團資料</div>\`
  }

  html += \`
  </div>
  \${pageFooter(settings)}
</body></html>\`

  return c.html(html)
})`;

code = code.replace(regex, newRoute);
fs.writeFileSync('src/routes/frontend.tsx', code);
console.log('patched coaches page');
