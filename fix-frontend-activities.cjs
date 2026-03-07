const fs = require('fs');
let file = fs.readFileSync('src/routes/frontend.tsx', 'utf8');

// Update navBar
file = file.replace(
  /<a href="\/#activities" class="hover:text-amber-300 transition-colors">活動<\/a>/,
  '<a href="/announcements" class="hover:text-amber-300 transition-colors">📢 公告</a>\n          <a href="/activities" class="hover:text-amber-300 transition-colors">📅 活動報名</a>'
);
file = file.replace(
  /<a href="\/#activities" class="bg-amber-500 hover:bg-amber-400 text-white px-6 py-2.5 rounded-full font-medium transition-colors">查看活動<\/a>/,
  '<a href="/activities" class="bg-amber-500 hover:bg-amber-400 text-white px-6 py-2.5 rounded-full font-medium transition-colors">報名專區</a>'
);

// We need to add two new routes: /announcements and /activities
const newRoutes = `
// ===================== 公告專區 =====================
frontendRoutes.get('/announcements', async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(\`SELECT key, value FROM site_settings\`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  // 取得公告列表 (整合後使用 activities table的 activity_type = 'announcement')
  // 如果還有舊的 announcements 表，我們也一起撈？但這裡我們先只看活動表內的公告，或是都看
  // 為了相容，我們撈兩個表，或者假設已經整合
  const acts = await db.prepare(\`
    SELECT * FROM activities 
    WHERE is_published = 1 AND activity_type = 'announcement'
    ORDER BY created_at DESC
  \`).all()

  // 舊的公告表也拿一下以防萬一
  const oldAnns = await db.prepare(\`SELECT * FROM announcements WHERE is_active = 1 ORDER BY created_at DESC\`).all()
  
  // 合併
  const allAnns = [
    ...acts.results.map((a: any) => ({ ...a, is_new: true, date: a.created_at })),
    ...oldAnns.results.map((a: any) => ({ ...a, is_new: false, date: a.created_at }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const itemsHtml = allAnns.map((a: any) => \`
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div class="flex items-center gap-3 mb-2">
        <span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">公告</span>
        <span class="text-sm text-gray-500">\${a.date ? a.date.substring(0, 10) : ''}</span>
      </div>
      <h3 class="text-lg font-bold text-gray-800 mb-2">\${a.title}</h3>
      <div class="text-gray-600 text-sm whitespace-pre-line">\${a.content || a.description || ''}</div>
      \${a.link_url ? \`<a href="\${a.link_url}" target="_blank" class="inline-block mt-3 text-blue-600 hover:text-blue-800 text-sm">🔗 查看相關連結</a>\` : ''}
    </div>
  \`).join('') || '<div class="text-center py-10 text-gray-400">目前無公告</div>'

  const html = \`\${pageHead('最新公告 - ' + (settings.site_title || ''), settings)}
  <body>
    \${navBar(settings)}
    <div class="hero-gradient text-white py-14 px-4">
      <div class="max-w-4xl mx-auto text-center">
        <div class="text-5xl mb-4">📢</div>
        <h1 class="text-3xl md:text-4xl font-bold mb-2">最新公告</h1>
        <p class="text-green-200">Announcements</p>
      </div>
    </div>
    <div class="max-w-4xl mx-auto px-4 py-10">
      <div class="space-y-4">
        \${itemsHtml}
      </div>
    </div>
    \${pageFooter(settings)}
  </body></html>\`
  return c.html(html)
})

// ===================== 活動報名專區 =====================
frontendRoutes.get('/activities', async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(\`SELECT key, value FROM site_settings\`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  const acts = await db.prepare(\`
    SELECT a.*, GROUP_CONCAT(ai.image_url) as images
    FROM activities a
    LEFT JOIN activity_images ai ON ai.activity_id = a.id
    WHERE a.is_published = 1 AND a.activity_type = 'registration'
    GROUP BY a.id
    ORDER BY a.activity_date DESC
  \`).all()

  const itemsHtml = acts.results.map((a: any) => {
    let cover = a.cover_image
    if (!cover && a.images) cover = a.images.split(',')[0]
    const defaultCover = 'https://images.unsplash.com/photo-1526404423292-15db8c2334e5?auto=format&fit=crop&q=80&w=800'
    
    // 判斷報名狀態
    const now = new Date()
    let regStatus = ''
    let regClass = ''
    if (a.is_registration_open) {
      if (a.registration_start && new Date(a.registration_start) > now) {
        regStatus = '即將開放'
        regClass = 'bg-blue-100 text-blue-700'
      } else if (a.registration_end && new Date(a.registration_end) < now) {
        regStatus = '報名截止'
        regClass = 'bg-gray-100 text-gray-600'
      } else {
        regStatus = '報名中'
        regClass = 'bg-green-100 text-green-700'
      }
    } else {
      regStatus = '尚未開放'
      regClass = 'bg-gray-100 text-gray-500'
    }

    return \`
    <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all flex flex-col md:flex-row">
      <div class="md:w-1/3 h-48 md:h-auto bg-gray-200">
        <img src="\${cover || defaultCover}" class="w-full h-full object-cover">
      </div>
      <div class="p-6 md:w-2/3 flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-start mb-2">
            <span class="\${regClass} px-2 py-1 rounded text-xs font-bold">\${regStatus}</span>
            <span class="text-sm text-gray-500">📅 \${a.date_display || a.activity_date || '-'}</span>
          </div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">\${a.title}</h3>
          <p class="text-gray-600 text-sm line-clamp-2 mb-4">\${a.description || a.content?.substring(0, 100) || '無詳細說明'}</p>
        </div>
        <div class="flex items-center justify-between border-t pt-4">
          <div class="text-sm text-gray-500 flex items-center gap-4">
            \${a.location ? \`<span title="活動地點"><i class="fas fa-map-marker-alt"></i> \${a.location}</span>\` : ''}
            \${a.cost ? \`<span title="活動費用"><i class="fas fa-dollar-sign"></i> \${a.cost}</span>\` : ''}
          </div>
          <a href="/activities/\${a.id}" class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            查看詳情
          </a>
        </div>
      </div>
    </div>
  \`}).join('') || '<div class="text-center py-10 text-gray-400">目前無開放報名的活動</div>'

  const html = \`\${pageHead('活動報名 - ' + (settings.site_title || ''), settings)}
  <body>
    \${navBar(settings)}
    <div class="hero-gradient text-white py-14 px-4">
      <div class="max-w-5xl mx-auto text-center">
        <div class="text-5xl mb-4">📅</div>
        <h1 class="text-3xl md:text-4xl font-bold mb-2">活動報名</h1>
        <p class="text-green-200">Activity Registrations</p>
      </div>
    </div>
    <div class="max-w-5xl mx-auto px-4 py-10">
      <div class="space-y-6">
        \${itemsHtml}
      </div>
    </div>
    \${pageFooter(settings)}
  </body></html>\`
  return c.html(html)
})

// 單一活動詳情頁
frontendRoutes.get('/activities/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const settingsRows = await db.prepare(\`SELECT key, value FROM site_settings\`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  const activity = await db.prepare(\`SELECT * FROM activities WHERE id = ? AND is_published = 1\`).bind(id).first() as any
  if (!activity) return c.notFound()

  let cover = activity.cover_image
  if (!cover) {
    const images = await db.prepare(\`SELECT image_url FROM activity_images WHERE activity_id = ? LIMIT 1\`).bind(id).all()
    if (images.results.length > 0) cover = images.results[0].image_url
  }
  const defaultCover = 'https://images.unsplash.com/photo-1526404423292-15db8c2334e5?auto=format&fit=crop&q=80&w=1200'

  const html = \`\${pageHead(activity.title + ' - 活動詳情', settings)}
  <body>
    \${navBar(settings)}
    <div class="w-full h-64 md:h-80 relative bg-gray-900">
      <img src="\${cover || defaultCover}" class="w-full h-full object-cover opacity-50">
      <div class="absolute inset-0 flex items-center justify-center text-center px-4">
        <div>
          <span class="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium mb-3 inline-block">報名活動</span>
          <h1 class="text-3xl md:text-5xl font-bold text-white mb-2">\${activity.title}</h1>
          \${activity.title_en ? \`<p class="text-gray-200">\${activity.title_en}</p>\` : ''}
        </div>
      </div>
    </div>
    
    <div class="max-w-4xl mx-auto px-4 py-10">
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8 -mt-20 relative z-10">
        <div class="grid md:grid-cols-3 gap-8">
          <div class="md:col-span-2 prose max-w-none">
            <h3 class="text-xl font-bold text-gray-800 mb-4 border-b pb-2">活動內容</h3>
            \${activity.content || activity.description || '無詳細說明'}
          </div>
          <div class="bg-gray-50 rounded-xl p-5 h-fit">
            <h3 class="text-lg font-bold text-gray-800 mb-4">活動資訊</h3>
            <ul class="space-y-4 text-sm text-gray-600">
              <li>
                <div class="font-medium text-gray-800 mb-1"><i class="fas fa-calendar-alt w-5"></i> 活動時間</div>
                <div>\${activity.date_display || activity.activity_date} \${activity.activity_end_date ? '~ ' + activity.activity_end_date : ''}</div>
              </li>
              \${activity.location ? \`
              <li>
                <div class="font-medium text-gray-800 mb-1"><i class="fas fa-map-marker-alt w-5"></i> 活動地點</div>
                <div>\${activity.location}</div>
              </li>\` : ''}
              \${activity.cost ? \`
              <li>
                <div class="font-medium text-gray-800 mb-1"><i class="fas fa-dollar-sign w-5"></i> 活動費用</div>
                <div>\${activity.cost}</div>
              </li>\` : ''}
              \${activity.max_participants ? \`
              <li>
                <div class="font-medium text-gray-800 mb-1"><i class="fas fa-users w-5"></i> 名額限制</div>
                <div>\${activity.max_participants} 人</div>
              </li>\` : ''}
              <li>
                <div class="font-medium text-gray-800 mb-1"><i class="fas fa-clock w-5"></i> 報名期限</div>
                <div>\${activity.registration_start ? activity.registration_start.replace('T', ' ') : '即日起'} <br>至 \${activity.registration_end ? activity.registration_end.replace('T', ' ') : '額滿為止'}</div>
              </li>
            </ul>
            
            <div class="mt-6 pt-6 border-t border-gray-200">
              <a href="/member" class="block w-full bg-orange-500 hover:bg-orange-600 text-white text-center py-3 rounded-lg font-bold transition-colors shadow-sm">
                前往會員專區報名
              </a>
              <p class="text-xs text-gray-500 text-center mt-2">請先登入會員系統，並於「活動報名」區塊進行報名</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    \${pageFooter(settings)}
  </body></html>\`
  return c.html(html)
})

`;

file = file.replace(/\/\/ ===================== 首頁 =====================/, newRoutes + '\n// ===================== 首頁 =====================');

// The original homepage has an "announcementsHtml" logic. Let's make it fetch all types of announcements
file = file.replace(
  /const announcements = await db\.prepare\(`\s*SELECT \* FROM announcements WHERE is_active = 1 ORDER BY created_at DESC LIMIT 5\s*`\)\.all\(\)/,
  `// 合併兩種公告來源 (新版活動公告 + 舊版公告)
  const actAnns = await db.prepare(\`SELECT * FROM activities WHERE is_published = 1 AND activity_type = 'announcement' ORDER BY created_at DESC LIMIT 5\`).all()
  const oldAnns = await db.prepare(\`SELECT * FROM announcements WHERE is_active = 1 ORDER BY created_at DESC LIMIT 5\`).all()
  const allAnnsList = [...actAnns.results.map((a: any) => ({ ...a, date: a.created_at })), ...oldAnns.results.map((a: any) => ({ ...a, date: a.created_at }))]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
  const announcements = { results: allAnnsList }`
);

// We should also replace the home page "activities" section to only show general activities or highlights.
// Originally it fetched activities: WHERE a.is_published = 1 AND (a.show_in_highlights = 0 OR a.show_in_highlights IS NULL)
file = file.replace(
  /WHERE a\.is_published = 1 AND \(a\.show_in_highlights = 0 OR a\.show_in_highlights IS NULL\)/,
  `WHERE a.is_published = 1 AND (a.show_in_highlights = 0 OR a.show_in_highlights IS NULL) AND (a.activity_type = 'general' OR a.activity_type IS NULL OR a.activity_type = 'registration')`
);

fs.writeFileSync('src/routes/frontend.tsx', file);
