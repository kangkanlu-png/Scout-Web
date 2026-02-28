import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

export const frontendRoutes = new Hono<{ Bindings: Bindings }>()

// 首頁
frontendRoutes.get('/', async (c) => {
  const db = c.env.DB

  // 取得所有已發佈活動
  const activities = await db.prepare(`
    SELECT a.*, GROUP_CONCAT(ai.image_url) as images
    FROM activities a
    LEFT JOIN activity_images ai ON ai.activity_id = a.id
    WHERE a.is_published = 1
    GROUP BY a.id
    ORDER BY a.display_order ASC, a.activity_date DESC
    LIMIT 20
  `).all()

  // 取得分組資訊
  const groups = await db.prepare(`
    SELECT * FROM scout_groups WHERE is_active = 1 ORDER BY display_order ASC
  `).all()

  // 取得網站設定
  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  // 取得公告
  const announcements = await db.prepare(`
    SELECT * FROM announcements WHERE is_active = 1 ORDER BY created_at DESC LIMIT 5
  `).all()

  const html = renderHomePage(activities.results, groups.results, settings, announcements.results)
  return c.html(html)
})

function renderHomePage(activities: any[], groups: any[], settings: Record<string, string>, announcements: any[]) {
  const categoryLabel: Record<string, string> = {
    general: '一般活動',
    tecc: 'TECC 急救訓練',
    camping: '大露營',
    training: '訓練課程',
    service: '服務活動',
  }
  const categoryColor: Record<string, string> = {
    general: 'bg-blue-100 text-blue-800',
    tecc: 'bg-red-100 text-red-800',
    camping: 'bg-green-100 text-green-800',
    training: 'bg-yellow-100 text-yellow-800',
    service: 'bg-purple-100 text-purple-800',
  }

  const activitiesHtml = activities.map((act: any) => {
    const imgs = act.images ? act.images.split(',').filter((x: string) => x && !x.includes('placeholder')) : []
    const imgHtml = imgs.length > 0
      ? `<img src="${imgs[0]}" alt="${act.title}" class="w-full h-48 object-cover rounded-lg mb-3" onerror="this.style.display='none'">`
      : ''
    const youtubeHtml = act.youtube_url
      ? `<div class="mt-3 rounded-lg overflow-hidden"><iframe width="100%" height="220" src="https://www.youtube.com/embed/${act.youtube_url}" frameborder="0" allowfullscreen class="rounded-lg"></iframe></div>`
      : ''
    const badge = `<span class="inline-block px-2 py-1 text-xs font-medium rounded-full ${categoryColor[act.category] || 'bg-gray-100 text-gray-800'} mb-2">${categoryLabel[act.category] || act.category}</span>`
    return `
      <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
        <div class="p-5">
          ${badge}
          ${imgHtml}
          <h3 class="text-lg font-bold text-gray-800 mb-1">${act.title}</h3>
          ${act.title_en ? `<p class="text-sm text-gray-500 mb-2">${act.title_en}</p>` : ''}
          ${act.date_display ? `<p class="text-sm text-amber-600 font-medium mb-2">📅 ${act.date_display}</p>` : ''}
          ${act.description ? `<p class="text-sm text-gray-600 leading-relaxed">${act.description}</p>` : ''}
          ${youtubeHtml}
        </div>
      </div>
    `
  }).join('')

  const groupsHtml = groups.map((g: any) => `
    <div class="bg-white rounded-xl shadow-md p-5 text-center hover:shadow-lg transition-shadow border-t-4 border-amber-500">
      <div class="text-3xl mb-3">⚜️</div>
      <h3 class="text-lg font-bold text-gray-800">${g.name}</h3>
      <p class="text-amber-600 font-medium text-sm">${g.name_en || ''}</p>
      ${g.grade_range ? `<p class="text-gray-500 text-sm mt-1">${g.grade_range}</p>` : ''}
      ${g.description ? `<p class="text-gray-600 text-sm mt-2">${g.description}</p>` : ''}
    </div>
  `).join('')

  const announcementsHtml = announcements.length > 0 ? `
    <div class="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8">
      <h3 class="text-lg font-bold text-amber-800 mb-3">📢 最新公告</h3>
      <ul class="space-y-2">
        ${announcements.map((a: any) => `
          <li class="flex items-start gap-2">
            <span class="text-amber-500 mt-0.5">▸</span>
            ${a.link_url
              ? `<a href="${a.link_url}" target="_blank" class="text-amber-700 hover:text-amber-900 hover:underline">${a.title}</a>`
              : `<span class="text-gray-700">${a.title}</span>`}
          </li>
        `).join('')}
      </ul>
    </div>
  ` : ''

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${settings.site_title || 'KCISLK 童軍團'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap');
    body { font-family: 'Noto Sans TC', sans-serif; }
    .hero-gradient { background: linear-gradient(135deg, #1a472a 0%, #2d6a4f 40%, #1b4332 100%); }
    .fleur-de-lis { font-size: 2rem; }
  </style>
</head>
<body class="bg-gray-50">
  <!-- 導覽列 -->
  <nav class="bg-[#1a472a] text-white shadow-lg sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="text-2xl">⚜️</span>
        <div>
          <div class="font-bold text-base leading-tight">林口康橋圓桌武士童軍團</div>
          <div class="text-xs text-green-200">KCISLK Excalibur Knights Scout Groups</div>
        </div>
      </div>
      <div class="flex items-center gap-4 text-sm">
        <a href="#groups" class="hover:text-amber-300 transition-colors">分組</a>
        <a href="#activities" class="hover:text-amber-300 transition-colors">活動</a>
        <a href="#about" class="hover:text-amber-300 transition-colors">關於我們</a>
        <a href="/admin" class="bg-amber-500 hover:bg-amber-400 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">⚙ 後台管理</a>
      </div>
    </div>
  </nav>

  <!-- Hero Banner -->
  <div class="hero-gradient text-white py-20 px-4">
    <div class="max-w-4xl mx-auto text-center">
      <div class="text-5xl mb-4">⚜️</div>
      <h1 class="text-4xl md:text-5xl font-bold mb-3">${settings.site_title || 'KCISLK 林口康橋童軍團'}</h1>
      <p class="text-xl text-green-200 mb-2">${settings.site_subtitle || 'KCISLK Excalibur Knights Scout Groups'}</p>
      <p class="text-green-300 text-sm">新北市第54團 · 成立於2019年</p>
      <div class="mt-8 flex justify-center gap-4">
        <a href="#activities" class="bg-amber-500 hover:bg-amber-400 text-white px-6 py-2.5 rounded-full font-medium transition-colors">查看活動</a>
        <a href="#about" class="border border-green-300 hover:bg-green-800 text-white px-6 py-2.5 rounded-full font-medium transition-colors">關於我們</a>
      </div>
    </div>
  </div>

  <div class="max-w-6xl mx-auto px-4 py-10">
    ${announcementsHtml}

    <!-- 童軍分組 -->
    <section id="groups" class="mb-14">
      <h2 class="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
        <span class="text-[#1a472a]">⚜️</span> 童軍分組
      </h2>
      <p class="text-gray-500 mb-6">Scout Groups</p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        ${groupsHtml || '<p class="text-gray-500 col-span-3">尚無分組資料</p>'}
      </div>
    </section>

    <!-- 活動記錄 -->
    <section id="activities" class="mb-14">
      <h2 class="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
        <i class="fas fa-campground text-[#1a472a]"></i> 活動記錄
      </h2>
      <p class="text-gray-500 mb-6">Activities & Events</p>
      ${activities.length === 0
        ? '<div class="text-center py-16 text-gray-400"><div class="text-5xl mb-4">📋</div><p>尚無活動記錄，請至後台新增活動。</p></div>'
        : `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${activitiesHtml}</div>`
      }
    </section>

    <!-- 關於我們 -->
    <section id="about" class="mb-10">
      <h2 class="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
        <i class="fas fa-info-circle text-[#1a472a]"></i> 關於我們
      </h2>
      <p class="text-gray-500 mb-6">About Us</p>
      <div class="bg-white rounded-xl shadow-md p-8">
        <div class="prose max-w-none">
          <p class="text-gray-700 leading-relaxed mb-4">${settings.about_text_zh || ''}</p>
          <p class="text-gray-500 leading-relaxed text-sm italic">${settings.about_text_en || ''}</p>
          ${settings.facebook_url ? `
            <div class="mt-6">
              <a href="${settings.facebook_url}" target="_blank" class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg transition-colors">
                <i class="fab fa-facebook"></i> 追蹤我們的 Facebook
              </a>
            </div>
          ` : ''}
        </div>
      </div>
    </section>
  </div>

  <!-- Footer -->
  <footer class="bg-[#1a472a] text-white py-8 mt-8">
    <div class="max-w-6xl mx-auto px-4 text-center">
      <div class="text-2xl mb-2">⚜️</div>
      <p class="font-bold">${settings.site_title || 'KCISLK 林口康橋圓桌武士童軍團'}</p>
      <p class="text-green-300 text-sm mt-1">${settings.site_subtitle || 'KCISLK Excalibur Knights Scout Groups'}</p>
      <p class="text-green-400 text-xs mt-3">一日童軍，終生童軍 · Once a Scout, Always a Scout</p>
    </div>
  </footer>
</body>
</html>`
}
