import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  R2: any
}

export const frontendRoutes = new Hono<{ Bindings: Bindings }>()


// ===================== 公告專區 =====================
frontendRoutes.get('/announcements', async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  const acts = await db.prepare(`
    SELECT * FROM activities 
    WHERE is_published = 1 AND activity_type = 'announcement'
    ORDER BY created_at DESC
  `).all()

  const oldAnns = await db.prepare(`SELECT * FROM announcements WHERE is_active = 1 ORDER BY created_at DESC`).all()
  
  const allAnns = [
    ...acts.results.map((a: any) => ({ ...a, is_new: true, date: a.created_at })),
    ...oldAnns.results.map((a: any) => ({ ...a, is_new: false, date: a.created_at }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const itemsHtml = allAnns.map((a: any) => `
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div class="flex items-center gap-3 mb-2">
        <span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">公告</span>
        <span class="text-sm text-gray-500">${a.date ? a.date.substring(0, 10) : ''}</span>
      </div>
      <h3 class="text-lg font-bold text-gray-800 mb-2">${a.title}</h3>
      <div class="text-gray-600 text-sm whitespace-pre-line">${a.content || a.description || ''}</div>
      ${a.link_url ? `<a href="${a.link_url}" target="_blank" class="inline-block mt-3 text-blue-600 hover:text-blue-800 text-sm">🔗 查看相關連結</a>` : ''}
    </div>
  `).join('') || '<div class="text-center py-10 text-gray-400">目前無公告</div>'

  const html = `${pageHead('最新公告 - ' + (settings.site_title || ''), settings)}
  <body>
    ${navBar(settings)}
    <div class="hero-gradient text-white py-14 px-4">
      <div class="max-w-4xl mx-auto text-center">
        <div class="text-5xl mb-4">📢</div>
        <h1 class="text-3xl md:text-4xl font-bold mb-2">最新公告</h1>
        <p class="text-green-200">Announcements</p>
      </div>
    </div>
    <div class="max-w-4xl mx-auto px-4 py-10">
      <div class="space-y-4">
        ${itemsHtml}
      </div>
    </div>
    ${pageFooter(settings)}
  </body></html>`
  return c.html(html)
})

// ===================== 活動報名專區 =====================
frontendRoutes.get('/activities', async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  const acts = await db.prepare(`
    SELECT a.*, GROUP_CONCAT(ai.image_url) as images
    FROM activities a
    LEFT JOIN activity_images ai ON ai.activity_id = a.id
    WHERE a.is_published = 1 AND a.activity_type = 'registration'
    GROUP BY a.id
    ORDER BY a.activity_date DESC
  `).all()

  const itemsHtml = acts.results.map((a: any) => {
    let cover = a.cover_image
    if (!cover && a.images) cover = a.images.split(',')[0]
    const defaultCover = 'https://images.unsplash.com/photo-1526404423292-15db8c2334e5?auto=format&fit=crop&q=80&w=800'
    
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

    return `
    <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all flex flex-col md:flex-row">
      <div class="md:w-1/3 h-48 md:h-auto bg-gray-200">
        <img src="${cover || defaultCover}" class="w-full h-full object-cover">
      </div>
      <div class="p-6 md:w-2/3 flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-start mb-2">
            <span class="${regClass} px-2 py-1 rounded text-xs font-bold">${regStatus}</span>
            <span class="text-sm text-gray-500">📅 ${a.date_display || a.activity_date || '-'}</span>
          </div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">${a.title}</h3>
          <p class="text-gray-600 text-sm line-clamp-2 mb-4">${a.description || a.content?.substring(0, 100) || '無詳細說明'}</p>
        </div>
        <div class="flex items-center justify-between border-t pt-4">
          <div class="text-sm text-gray-500 flex items-center gap-4">
            ${a.location ? `<span title="活動地點"><i class="fas fa-map-marker-alt"></i> ${a.location}</span>` : ''}
            ${a.cost ? `<span title="活動費用"><i class="fas fa-dollar-sign"></i> ${a.cost}</span>` : ''}
          </div>
          <a href="/activities/${a.id}" class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            查看詳情
          </a>
        </div>
      </div>
    </div>
  `}).join('') || '<div class="text-center py-10 text-gray-400">目前無開放報名的活動</div>'

  const html = `${pageHead('活動報名 - ' + (settings.site_title || ''), settings)}
  <body>
    ${navBar(settings)}
    <div class="hero-gradient text-white py-14 px-4">
      <div class="max-w-5xl mx-auto text-center">
        <div class="text-5xl mb-4">📅</div>
        <h1 class="text-3xl md:text-4xl font-bold mb-2">活動報名</h1>
        <p class="text-green-200">Activity Registrations</p>
      </div>
    </div>
    <div class="max-w-5xl mx-auto px-4 py-10">
      <div class="space-y-6">
        ${itemsHtml}
      </div>
    </div>
    ${pageFooter(settings)}
  </body></html>`
  return c.html(html)
})

// 單一活動詳情頁
frontendRoutes.get('/activities/:id', async (c) => {
  const db = c.env.DB
  const id = c.req.param('id')
  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  const activity = await db.prepare(`SELECT * FROM activities WHERE id = ? AND is_published = 1`).bind(id).first() as any
  if (!activity) return c.notFound()

  let cover = activity.cover_image
  if (!cover) {
    const images = await db.prepare(`SELECT image_url FROM activity_images WHERE activity_id = ? LIMIT 1`).bind(id).all()
    if (images.results.length > 0) cover = images.results[0].image_url
  }
  const defaultCover = 'https://images.unsplash.com/photo-1526404423292-15db8c2334e5?auto=format&fit=crop&q=80&w=1200'

  const html = `${pageHead(activity.title + ' - 活動詳情', settings)}
  <body>
    ${navBar(settings)}
    <div class="w-full h-64 md:h-80 relative bg-gray-900">
      <img src="${cover || defaultCover}" class="w-full h-full object-cover opacity-50">
      <div class="absolute inset-0 flex items-center justify-center text-center px-4">
        <div>
          <span class="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium mb-3 inline-block">活動詳情</span>
          <h1 class="text-3xl md:text-5xl font-bold text-white mb-2">${activity.title}</h1>
          ${activity.title_en ? `<p class="text-gray-200">${activity.title_en}</p>` : ''}
        </div>
      </div>
    </div>
    
    <div class="max-w-4xl mx-auto px-4 py-10">
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8 -mt-20 relative z-10">
        <div class="grid md:grid-cols-3 gap-8">
          <div class="md:col-span-2 prose max-w-none">
            <h3 class="text-xl font-bold text-gray-800 mb-4 border-b pb-2">活動內容</h3>
            <div class="whitespace-pre-line">${activity.content || activity.description || '無詳細說明'}</div>
          </div>
          <div class="bg-gray-50 rounded-xl p-5 h-fit">
            <h3 class="text-lg font-bold text-gray-800 mb-4">活動資訊</h3>
            <ul class="space-y-4 text-sm text-gray-600">
              <li>
                <div class="font-medium text-gray-800 mb-1"><i class="fas fa-calendar-alt w-5"></i> 活動時間</div>
                <div>${activity.date_display || activity.activity_date} ${activity.activity_end_date ? '~ ' + activity.activity_end_date : ''}</div>
              </li>
              ${activity.location ? `
              <li>
                <div class="font-medium text-gray-800 mb-1"><i class="fas fa-map-marker-alt w-5"></i> 活動地點</div>
                <div>${activity.location}</div>
              </li>` : ''}
              ${activity.cost ? `
              <li>
                <div class="font-medium text-gray-800 mb-1"><i class="fas fa-dollar-sign w-5"></i> 活動費用</div>
                <div>${activity.cost}</div>
              </li>` : ''}
              ${activity.max_participants ? `
              <li>
                <div class="font-medium text-gray-800 mb-1"><i class="fas fa-users w-5"></i> 名額限制</div>
                <div>${activity.max_participants} 人</div>
              </li>` : ''}
              ${activity.activity_type === 'registration' ? `
              <li>
                <div class="font-medium text-gray-800 mb-1"><i class="fas fa-clock w-5"></i> 報名期限</div>
                <div>${activity.registration_start ? activity.registration_start.replace('T', ' ') : '即日起'} <br>至 ${activity.registration_end ? activity.registration_end.replace('T', ' ') : '額滿為止'}</div>
              </li>
              ` : ''}
            </ul>
            
            ${activity.activity_type === 'registration' ? `
            <div class="mt-6 pt-6 border-t border-gray-200">
              <a href="/member" class="block w-full bg-orange-500 hover:bg-orange-600 text-white text-center py-3 rounded-lg font-bold transition-colors shadow-sm">
                前往會員專區報名
              </a>
              <p class="text-xs text-gray-500 text-center mt-2">請先登入會員系統，並於「活動報名」區塊進行報名</p>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
    ${pageFooter(settings)}
  </body></html>`
  return c.html(html)
})

// ===================== 首頁 =====================
frontendRoutes.get('/', async (c) => {
  const db = c.env.DB

  const activities = await db.prepare(`
    SELECT a.*, GROUP_CONCAT(ai.image_url) as images
    FROM activities a
    LEFT JOIN activity_images ai ON ai.activity_id = a.id
    WHERE a.is_published = 1 AND (a.show_in_highlights = 0 OR a.show_in_highlights IS NULL) AND (a.activity_type = 'general' OR a.activity_type IS NULL OR a.activity_type = 'registration')
    GROUP BY a.id
    ORDER BY a.display_order ASC, a.activity_date DESC
    LIMIT 6
  `).all()

  const highlights = await db.prepare(`
    SELECT a.*, GROUP_CONCAT(ai.image_url) as images
    FROM activities a
    LEFT JOIN activity_images ai ON ai.activity_id = a.id
    WHERE a.is_published = 1 AND (a.show_in_highlights = 1 OR a.activity_status = 'completed')
    GROUP BY a.id
    HAVING images IS NOT NULL OR a.cover_image IS NOT NULL
    ORDER BY a.display_order ASC, a.activity_date DESC
    LIMIT 6
  `).all()

  const groups = await db.prepare(`
    SELECT * FROM scout_groups WHERE is_active = 1 ORDER BY display_order ASC
  `).all()

  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  const actAnns = await db.prepare(`SELECT * FROM activities WHERE is_published = 1 AND activity_type = 'announcement' ORDER BY created_at DESC LIMIT 5`).all()
  const oldAnns = await db.prepare(`SELECT * FROM announcements WHERE is_active = 1 ORDER BY created_at DESC LIMIT 5`).all()
  const allAnnsList = [...actAnns.results.map((a: any) => ({ ...a, date: a.created_at })), ...oldAnns.results.map((a: any) => ({ ...a, date: a.created_at }))]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
  const announcements = { results: allAnnsList }

  const html = renderHomePage(activities.results, groups.results, settings, announcements.results, highlights.results)
  return c.html(html)
})

// ===================== 榮譽榜（公開）=====================
frontendRoutes.get('/honor', async (c) => {
  const db = c.env.DB

  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  // ── 進程階層定義 ──────────────────────────────────────────
  // 每人只取「最高階段」，依此優先序判斷
  const rankPriority: Record<string, number> = {
    // 童軍 / 行義 階段（數字越大越高）
    '見習童軍': 1,
    '初級童軍': 2,
    '中級童軍': 3,
    '高級童軍': 4,
    '獅級童軍': 5,
    '長城童軍': 6,
    '國花童軍': 7,
    // 羅浮階段
    '見習羅浮': 10,
    '授銜羅浮': 11,
    '服務羅浮': 12,
    // 行義特殊
    '初級行義': 2,
  }

  // 三階段分層定義
  // 第一階（全國性）：績優童軍團、優秀童軍獎章、國花童軍、服務羅浮
  // 第二階（縣市級）：長城童軍、獅級童軍、高級童軍、授銜羅浮
  // 第三階（童軍團）：榮譽小隊、中級童軍、初級童軍、見習羅浮
  const tier1Ranks = ['國花童軍', '服務羅浮']
  const tier2Ranks = ['長城童軍', '獅級童軍', '高級童軍', '授銜羅浮']
  const tier3Ranks = ['中級童軍', '初級童軍', '見習羅浮']

  // ── 取每人最高晉級階段（童軍/行義用一套優先序，羅浮獨立）──
  // 使用 subquery 取每人最高 priority 的紀錄
  const allRankRecords = await db.prepare(`
    SELECT pr.member_id, pr.award_name, pr.year_label, m.chinese_name, m.section
    FROM progress_records pr
    JOIN members m ON m.id = pr.member_id
    WHERE pr.record_type = 'rank'
    ORDER BY m.chinese_name
  `).all()

  // 每人只保留最高階段（分童軍/行義組 vs 羅浮組）
  const memberHighestRank: Record<string, {award_name: string, year_label: string, chinese_name: string, section: string}> = {}
  ;(allRankRecords.results as any[]).forEach((r: any) => {
    const key = r.member_id
    const pri = rankPriority[r.award_name] ?? 0
    if (!memberHighestRank[key]) {
      memberHighestRank[key] = r
    } else {
      const curPri = rankPriority[memberHighestRank[key].award_name] ?? 0
      if (pri > curPri) memberHighestRank[key] = r
    }
  })

  // 按最高獎項名稱分組
  const grouped: Record<string, Array<{chinese_name: string, section: string, year_label: string}>> = {}
  Object.values(memberHighestRank).forEach((r: any) => {
    const award = r.award_name
    if (!grouped[award]) grouped[award] = []
    grouped[award].push({ chinese_name: r.chinese_name, section: r.section, year_label: r.year_label })
  })
  // 按姓名排序
  Object.values(grouped).forEach(arr => arr.sort((a, b) => a.chinese_name.localeCompare(b.chinese_name)))

  // ── 優秀童軍 / 績優童軍團（achievement/award 類型）──
  const specialAwardRecords = await db.prepare(`
    SELECT pr.award_name, pr.year_label, m.chinese_name, m.section
    FROM progress_records pr
    JOIN members m ON m.id = pr.member_id
    WHERE pr.record_type IN ('achievement', 'award')
    ORDER BY pr.award_name, m.chinese_name
  `).all()
  const specialGrouped: Record<string, any[]> = {}
  ;(specialAwardRecords.results as any[]).forEach((r: any) => {
    if (!specialGrouped[r.award_name]) specialGrouped[r.award_name] = []
    specialGrouped[r.award_name].push(r)
  })

  
  // ── 團體榮譽 (績優童軍團等) ──
  const groupHonorRecords = await db.prepare('SELECT honor_name, year_label, tier FROM group_honors ORDER BY tier ASC, year_label DESC').all()
  const groupHonorsByTier: Record<number, Record<string, string[]>> = { 1: {}, 2: {}, 3: {} }
  ;(groupHonorRecords.results as any[]).forEach((h: any) => {
    if (!groupHonorsByTier[h.tier]) groupHonorsByTier[h.tier] = {}
    if (!groupHonorsByTier[h.tier][h.honor_name]) groupHonorsByTier[h.tier][h.honor_name] = []
    groupHonorsByTier[h.tier][h.honor_name].push(h.year_label)
  })

  // ── 榮譽小隊（公告記錄）──
  const honorPatrolRecords = await db.prepare(`
    SELECT hp.*, ats.title as session_title, ats.date as session_date
    FROM honor_patrol_records hp
    JOIN attendance_sessions ats ON ats.id = hp.session_id
    WHERE hp.announced = 1
    ORDER BY hp.announced_at DESC
    LIMIT 20
  `).all()

  // ── 輔助：產生成員 chip ────────────────────────────────
  const makeChip = (m: any, borderColor: string, textColor: string, bgBadge: string, textBadge: string) => `
    <div class="inline-flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 shadow-sm border ${borderColor} text-sm">
      <span class="${textColor} font-medium">${m.chinese_name}</span>
      <span class="text-gray-400 text-xs">${m.section}</span>
      ${(m.year_label && m.year_label !== 'null') ? `<span class="text-xs ${bgBadge} ${textBadge} px-1.5 py-0.5 rounded-full">${m.year_label}</span>` : ''}
    </div>`

  // ── 輔助：產生獎項區塊 ────────────────────────────────
  const makeRankBlock = (rankName: string, emoji: string, gradient: string, border: string, headColor: string, chipBorder: string, chipText: string, chipBg: string, chipBadgeText: string) => {
    const members = grouped[rankName]
    if (!members?.length) return ''
    const chips = members.map(m => makeChip(m, chipBorder, chipText, chipBg, chipBadgeText)).join('\n')
    return `
    <div class="bg-gradient-to-br ${gradient} border ${border} rounded-2xl p-5">
      <div class="flex items-center gap-2 mb-4">
        <span class="text-2xl">${emoji}</span>
        <h3 class="${headColor} font-bold text-lg">${rankName}</h3>
        <span class="ml-auto text-sm font-semibold bg-white/60 px-3 py-0.5 rounded-full ${headColor}">${members.length} 位</span>
      </div>
      <div class="flex flex-wrap gap-2">${chips}</div>
    </div>`
  }

  // ── 三個層級的區塊 ────────────────────────────────────
  
  // 產生團體獎項區塊的函數
  const makeGroupHonorBlock = (tierData: Record<string, string[]>) => {
    return Object.entries(tierData).map(([honorName, years]) => {
      const yearChips = years.map(y => `<span class="px-3 py-1 bg-white/60 border border-amber-200 text-amber-700 text-sm font-bold rounded-full">${y}</span>`).join('\n')
      return `
      <div class="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-5">
        <div class="flex items-center gap-2 mb-4">
          <span class="text-2xl">🏆</span>
          <h3 class="text-amber-800 font-bold text-lg">${honorName}</h3>
          <span class="ml-auto text-sm font-semibold bg-amber-100 px-3 py-0.5 rounded-full text-amber-700">團體榮譽</span>
        </div>
        <div class="flex flex-wrap gap-2">${yearChips}</div>
      </div>`
    })
  }

  // 第一階：全國性

  const tier1RankBlocks = [
    makeRankBlock('國花童軍',   '🌺', 'from-rose-50 to-pink-50',     'border-rose-200',   'text-rose-800',   'border-rose-200',   'text-rose-700',   'bg-rose-50',   'text-rose-600'),
    makeRankBlock('服務羅浮',   '🦁', 'from-purple-50 to-violet-50', 'border-purple-200', 'text-purple-800', 'border-purple-200', 'text-purple-700', 'bg-purple-50', 'text-purple-600'),
  ].filter(Boolean)
  // 特殊獎章（優秀童軍、績優童軍團等）也在第一階
  const specialBlocks = Object.entries(specialGrouped).map(([awardName, members]) => {
    const chips = members.map(m => makeChip(m, 'border-amber-200', 'text-amber-800', 'bg-amber-50', 'text-amber-600')).join('\n')
    return `
    <div class="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-5">
      <div class="flex items-center gap-2 mb-4">
        <span class="text-2xl">🌟</span>
        <h3 class="text-amber-800 font-bold text-lg">${awardName}</h3>
        <span class="ml-auto text-sm font-semibold bg-white/60 px-3 py-0.5 rounded-full text-amber-700">${members.length} 位</span>
      </div>
      <div class="flex flex-wrap gap-2">${chips}</div>
    </div>`
  })

  // 第二階：縣市級
  const tier2RankBlocks = [
    makeRankBlock('長城童軍',   '🏯', 'from-blue-50 to-sky-50',      'border-blue-200',   'text-blue-800',   'border-blue-200',   'text-blue-700',   'bg-blue-50',   'text-blue-600'),
    makeRankBlock('獅級童軍',   '🦁', 'from-indigo-50 to-blue-50',   'border-indigo-200', 'text-indigo-800', 'border-indigo-200', 'text-indigo-700', 'bg-indigo-50', 'text-indigo-600'),
    makeRankBlock('高級童軍',   '⭐', 'from-cyan-50 to-sky-50',      'border-cyan-200',   'text-cyan-800',   'border-cyan-200',   'text-cyan-700',   'bg-cyan-50',   'text-cyan-600'),
    makeRankBlock('授銜羅浮',   '🧭', 'from-violet-50 to-purple-50', 'border-violet-200', 'text-violet-800', 'border-violet-200', 'text-violet-700', 'bg-violet-50', 'text-violet-600'),
  ].filter(Boolean)

  // 第三階：童軍團
  // 榮譽小隊卡片
  const sectionLabel: Record<string,string> = {junior:'童軍',senior:'行義童軍',rover:'羅浮童軍',all:'全體'}
  const honorPatrolCards = (honorPatrolRecords.results as any[]).map((h: any) => `
    <div class="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-300 rounded-2xl p-5">
      <div class="flex items-center gap-3 mb-2">
        <span class="text-3xl">🏆</span>
        <div>
          <div class="font-bold text-amber-900 text-base">${h.patrol_name}</div>
          <div class="text-xs text-amber-600">${sectionLabel[h.section] || h.section}${h.year_label ? ' · ' + h.year_label + ' 學年' : ''}</div>
        </div>
      </div>
      ${h.reason ? `<p class="text-sm text-gray-600 mt-1 mb-2">${h.reason}</p>` : ''}
      <div class="text-xs text-gray-400">場次：${h.session_title} · ${h.session_date}</div>
    </div>
  `).join('')

  const tier3RankBlocks = [
    makeRankBlock('中級童軍',   '🥈', 'from-green-50 to-emerald-50', 'border-green-200',  'text-green-800',  'border-green-200',  'text-green-700',  'bg-green-50',  'text-green-600'),
    makeRankBlock('初級童軍',   '🥉', 'from-teal-50 to-green-50',    'border-teal-200',   'text-teal-800',   'border-teal-200',   'text-teal-700',   'bg-teal-50',   'text-teal-600'),
    makeRankBlock('見習羅浮',   '🌱', 'from-purple-50 to-fuchsia-50','border-purple-100', 'text-purple-700', 'border-purple-100', 'text-purple-600', 'bg-purple-50', 'text-purple-500'),
  ].filter(Boolean)

  // ── 統計摘要 ─────────────────────────────────────────
  const totalHonored = Object.keys(memberHighestRank).length
  const tier1Count = [...tier1Ranks, ...Object.keys(specialGrouped)].reduce((s, n) => s + (grouped[n]?.length || specialGrouped[n]?.length || 0), 0)
  const tier2Count = tier2Ranks.reduce((s, n) => s + (grouped[n]?.length || 0), 0)
  const tier3Count = tier3Ranks.reduce((s, n) => s + (grouped[n]?.length || 0), 0) + (honorPatrolRecords.results as any[]).length

  return c.html(`${pageHead('榮譽榜 - 林口康橋童軍團')}
<body class="bg-gray-50">
  ${navBar(settings)}

  <!-- Hero -->
  <div class="hero-gradient text-white py-14 px-4">
    <div class="max-w-5xl mx-auto text-center">
      <div class="text-5xl mb-4">🏅</div>
      <h1 class="text-3xl md:text-4xl font-bold mb-3">童軍榮譽榜</h1>
      <p class="text-green-200">Honor Roll · 記錄每一位童軍的成長與成就</p>
    </div>
  </div>

  <!-- 摘要卡 -->
  <div class="max-w-5xl mx-auto px-4 -mt-6 mb-8">
    <div class="grid grid-cols-3 gap-3">
      <div class="bg-white rounded-2xl shadow-md p-4 text-center border-t-4 border-rose-400">
        <p class="text-2xl font-bold text-rose-600">${tier1Count}</p>
        <p class="text-xs text-gray-500 mt-1">全國性榮譽</p>
      </div>
      <div class="bg-white rounded-2xl shadow-md p-4 text-center border-t-4 border-blue-400">
        <p class="text-2xl font-bold text-blue-600">${tier2Count}</p>
        <p class="text-xs text-gray-500 mt-1">縣市級榮譽</p>
      </div>
      <div class="bg-white rounded-2xl shadow-md p-4 text-center border-t-4 border-green-400">
        <p class="text-2xl font-bold text-green-600">${tier3Count}</p>
        <p class="text-xs text-gray-500 mt-1">童軍團榮譽</p>
      </div>
    </div>
  </div>

  <div class="max-w-5xl mx-auto px-4 pb-16">

    ${(Object.keys(groupHonorsByTier[1]).length > 0 || tier1RankBlocks.length > 0 || specialBlocks.length > 0) ? `
    <!-- ══════════════ 第一階：全國性 ══════════════ -->
    <div class="flex items-center gap-3 mb-5">
      <div class="w-1 h-8 bg-rose-400 rounded-full"></div>
      <div>
        <h2 class="text-xl font-bold text-gray-800">第一階　全國性榮譽</h2>
        <p class="text-xs text-gray-500 mt-0.5">績優童軍團 · 優秀童軍獎章 · 國花童軍獎章 · 服務羅浮獎章</p>
      </div>
    </div>
    <div class="grid md:grid-cols-2 gap-4 mb-10">
      ${[...makeGroupHonorBlock(groupHonorsByTier[1]), ...tier1RankBlocks, ...specialBlocks].join('') || '<p class="text-gray-400 col-span-2 py-6 text-center">尚無全國性榮譽記錄</p>'}
    </div>` : ''}

    ${(Object.keys(groupHonorsByTier[2]).length > 0 || tier2RankBlocks.length > 0) ? `
    <!-- ══════════════ 第二階：縣市級 ══════════════ -->
    <div class="flex items-center gap-3 mb-5">
      <div class="w-1 h-8 bg-blue-400 rounded-full"></div>
      <div>
        <h2 class="text-xl font-bold text-gray-800">第二階　縣市級榮譽</h2>
        <p class="text-xs text-gray-500 mt-0.5">長城童軍獎章 · 獅級童軍獎章 · 高級童軍獎章 · 授銜羅浮獎章</p>
      </div>
    </div>
    <div class="grid md:grid-cols-2 gap-4 mb-10">
      ${[...makeGroupHonorBlock(groupHonorsByTier[2]), ...tier2RankBlocks].join('')}
    </div>` : ''}

    <!-- ══════════════ 第三階：童軍團 ══════════════ -->
    <div class="flex items-center gap-3 mb-5">
      <div class="w-1 h-8 bg-green-400 rounded-full"></div>
      <div>
        <h2 class="text-xl font-bold text-gray-800">第三階　童軍團榮譽</h2>
        <p class="text-xs text-gray-500 mt-0.5">榮譽小隊 · 中級童軍 · 初級童軍 · 見習羅浮</p>
      </div>
    </div>

    ${honorPatrolCards ? `
    <h3 class="font-semibold text-gray-700 mb-3 flex items-center gap-2 ml-4">
      <span>🏆</span> 榮譽小隊公告
    </h3>
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      ${honorPatrolCards}
    </div>` : ''}

    <div class="grid md:grid-cols-2 gap-4 mb-10">
      ${tier3RankBlocks.join('') || '<p class="text-gray-400 col-span-2 py-6 text-center">尚無童軍團晉級記錄</p>'}
    </div>

    ${totalHonored === 0 && !honorPatrolCards ? `
    <div class="text-center py-20 text-gray-400">
      <p class="text-4xl mb-3">🏅</p>
      <p>尚無榮譽記錄</p>
    </div>` : ''}

  </div>

  ${pageFooter(settings)}
</body></html>`)
})

// ===================== 教練團總覽頁 =====================
frontendRoutes.get('/coaches', async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  const coaches = await db.prepare(`SELECT cms.id, m.chinese_name, m.english_name, cms.current_stage as coach_level, cms.section_assigned, cms.specialties, cms.year_label, m.id as member_id FROM coach_member_status cms JOIN members m ON m.id = cms.member_id ORDER BY m.chinese_name ASC`).all()
  
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

  let html = `${pageHead('教練團組織 - 林口康橋童軍團')}
<body class="bg-gray-50 font-sans">
  ${navBar(settings)}
  
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
  `

  levels.forEach(level => {
    const list = grouped[level]
    if (list.length > 0) {
      html += `
        <div class="mb-12">
          <div class="flex items-center gap-3 mb-6 border-b-2 border-green-700 pb-2">
            <h2 class="text-2xl font-bold text-gray-800">${level}</h2>
            <span class="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">${list.length} 人</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            ${list.map((c: any) => `
              <div class="bg-white border border-gray-200 rounded-xl p-4 text-center hover:shadow-md transition-shadow">
                <div class="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 text-green-700 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
                  ${c.chinese_name.substring(0, 1)}
                </div>
                <h3 class="font-bold text-gray-900">${c.chinese_name}</h3>
                ${c.english_name ? `<div class="text-xs text-gray-500 mb-2">${c.english_name}</div>` : ''}
                ${c.specialties ? `
                  <div class="mt-2 flex flex-wrap justify-center gap-1">
                    ${c.specialties.split(',').map((s:string) => `<span class="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">${s.trim()}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `
    }
  })

  // 如果完全沒有資料
  if (coaches.results.length === 0) {
    html += `<div class="text-center py-16 text-gray-500">目前尚無教練團資料</div>`
  }

  html += `
  </div>
  ${pageFooter(settings)}
</body></html>`

  return c.html(html)
})

// ===================== 教練團舊版（保留路由備用）=====================
frontendRoutes.get('/coaches-legacy', async (c) => {
  const db = c.env.DB

  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  const coaches = await db.prepare(`
    SELECT cms.id, m.chinese_name, m.english_name, cms.current_stage as coach_level, cms.section_assigned, cms.specialties, cms.year_label, m.id as member_id, sg.name as group_name, sg.slug as group_slug
    FROM coach_member_status cms
    JOIN members m ON m.id = cms.member_id
    LEFT JOIN scout_groups sg ON sg.id = (
      CASE cms.section_assigned
        WHEN '童軍' THEN (SELECT id FROM scout_groups WHERE slug='scout-troop' LIMIT 1)
        WHEN '行義童軍' THEN (SELECT id FROM scout_groups WHERE slug='senior-scout' LIMIT 1)
        WHEN '羅浮童軍' THEN (SELECT id FROM scout_groups WHERE slug='rover-scout' LIMIT 1)
        ELSE NULL
      END
    )
    ORDER BY cms.year_label DESC, cms.current_stage, m.chinese_name
  `).all()

  // 按年度分組
  const byYear: Record<string, any[]> = {}
  coaches.results.forEach((c: any) => {
    const y = c.year_label || '未知年度'
    if (!byYear[y]) byYear[y] = []
    byYear[y].push(c)
  })

  const levelBadge: Record<string, string> = {
    '指導教練': 'bg-purple-100 text-purple-800 border-purple-200',
    '助理教練': 'bg-blue-100 text-blue-800 border-blue-200',
    '見習教練': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    '預備教練': 'bg-teal-100 text-teal-800 border-teal-200',
  }

  const yearBlocks = Object.entries(byYear)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, members]) => {
      const cards = members.map((coach: any) => {
        const badge = levelBadge[coach.coach_level] || 'bg-gray-100 text-gray-700 border-gray-200'
        const specialties = coach.specialties
          ? (typeof coach.specialties === 'string' && coach.specialties.startsWith('[')
              ? JSON.parse(coach.specialties).join('、')
              : coach.specialties)
          : ''
        return `
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
          <div class="w-14 h-14 rounded-full bg-gradient-to-br from-green-100 to-emerald-200 flex items-center justify-center flex-shrink-0 text-2xl border-2 border-green-200">
            ${coach.section_assigned === '童軍' ? '🏕️' : coach.section_assigned === '行義童軍' ? '⛺' : coach.section_assigned === '羅浮童軍' ? '🧭' : '👨‍🏫'}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span class="font-bold text-gray-800 text-base">${coach.chinese_name}</span>
              ${coach.english_name ? `<span class="text-gray-400 text-xs">${coach.english_name}</span>` : ''}
            </div>
            <div class="flex flex-wrap gap-1.5 mb-2">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${badge}">${coach.coach_level || '教練'}</span>
              ${coach.section_assigned && coach.section_assigned !== '未指定' ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">${coach.section_assigned}</span>` : ''}
            </div>
            ${specialties ? `<p class="text-gray-500 text-xs">🎯 專長：${specialties}</p>` : ''}
            ${coach.notes ? `<p class="text-gray-400 text-xs mt-0.5">${coach.notes}</p>` : ''}
          </div>
        </div>`
      }).join('')

      const byLevel: Record<string, number> = {}
      members.forEach((c: any) => {
        byLevel[c.coach_level || '其他'] = (byLevel[c.coach_level || '其他'] || 0) + 1
      })
      const levelSummary = Object.entries(byLevel).map(([l, n]) =>
        `<span class="text-xs text-gray-500">${l} ${n}位</span>`
      ).join(' · ')

      return `
      <div class="mb-10">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-green-900 flex items-center gap-2">
            <span class="w-9 h-9 bg-green-700 text-white rounded-full flex items-center justify-center text-sm font-bold shadow">${year}</span>
            <span>學年度教練團</span>
          </h2>
          <div class="flex items-center gap-3">${levelSummary}</div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${cards}</div>
      </div>`
    }).join('')

  return c.html(`${pageHead('教練團 - 林口康橋童軍團')}
<body class="bg-gray-50">
  ${navBar(settings)}
  <div class="hero-gradient text-white py-14 px-4">
    <div class="max-w-5xl mx-auto">
      <div class="flex items-center gap-2 text-green-300 text-sm mb-4">
        <a href="/" class="hover:text-white transition-colors">首頁</a>
        <span>›</span>
        <span class="text-white">教練團</span>
      </div>
      <div class="flex items-center gap-4">
        <span class="text-5xl">🧢</span>
        <div>
          <h1 class="text-3xl md:text-4xl font-bold">教練團總覽</h1>
          <p class="text-green-200 mt-1">Coach Team · 感謝所有為童軍奉獻的教練</p>
        </div>
      </div>
      <div class="mt-6 flex gap-6 text-center">
        <div>
          <div class="text-3xl font-bold">${coaches.results.length}</div>
          <div class="text-green-300 text-xs mt-0.5">累計教練人次</div>
        </div>
        <div class="w-px bg-green-600"></div>
        <div>
          <div class="text-3xl font-bold">${Object.keys(byYear).length}</div>
          <div class="text-green-300 text-xs mt-0.5">涵蓋學年度</div>
        </div>
      </div>
    </div>
  </div>
  <div class="max-w-5xl mx-auto px-4 py-10">
    ${yearBlocks || '<div class="text-center py-20 text-gray-400"><div class="text-5xl mb-4">🧢</div><p class="text-lg">尚無教練團資料</p></div>'}
  </div>
  ${pageFooter(settings)}
`)
})

// ===================== 統計公開頁 =====================
frontendRoutes.get('/stats', async (c) => {
  const db = c.env.DB

  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  // ── 基礎數據查詢 ──────────────────────────────────────────
  const sectionCounts = await db.prepare(`
    SELECT section, COUNT(*) as count
    FROM members
    WHERE UPPER(membership_status) = 'ACTIVE'
    GROUP BY section
    ORDER BY CASE section
      WHEN '服務員' THEN 1 WHEN '羅浮童軍' THEN 2
      WHEN '行義童軍' THEN 3 WHEN '童軍' THEN 4
      WHEN '幼童軍' THEN 5 ELSE 6 END
  `).all()
  const totalMembers = (sectionCounts.results as any[]).reduce((s: number, r: any) => s + r.count, 0)

  const yearSectionData = await db.prepare(`
    SELECT year_label, section, COUNT(DISTINCT member_id) as count
    FROM member_enrollments
    WHERE is_active = 1
    GROUP BY year_label, section
    ORDER BY year_label ASC, section
  `).all()

  const yearTotals = await db.prepare(`
    SELECT year_label, COUNT(DISTINCT member_id) as count
    FROM member_enrollments
    WHERE is_active = 1
    GROUP BY year_label
    ORDER BY year_label ASC
  `).all()

  const yearRankData = await db.prepare(`
    SELECT pr.year_label, m.section, pr.award_name, COUNT(*) as count
    FROM progress_records pr
    JOIN members m ON m.id = pr.member_id
    WHERE pr.record_type = 'rank' AND pr.year_label IS NOT NULL
    GROUP BY pr.year_label, m.section, pr.award_name
    ORDER BY pr.year_label ASC, m.section, count DESC
  `).all()

  const coachStages = await db.prepare(`
    SELECT current_stage, COUNT(*) as count
    FROM coach_member_status
    GROUP BY current_stage
  `).all()
  const coachStageMap: Record<string, number> = {}
  ;(coachStages.results as any[]).forEach((r: any) => { coachStageMap[r.current_stage] = r.count })
  const totalCoaches = Object.values(coachStageMap).reduce((s, v) => s + v, 0)

  const roverMembers = await db.prepare(`
    SELECT chinese_name, country, university
    FROM members
    WHERE UPPER(membership_status) = 'ACTIVE' AND section = '羅浮童軍'
    ORDER BY country, chinese_name
  `).all()

  // ── 整理資料結構 ──────────────────────────────────────────
  const mainSections = ['童軍','行義童軍','羅浮童軍','服務員']
  const sectionColors: Record<string, string> = {
    '童軍': '#22c55e', '行義童軍': '#3b82f6',
    '羅浮童軍': '#a855f7', '服務員': '#f59e0b'
  }
  const sectionCardColors: Record<string, string> = {
    '童軍': 'from-green-500 to-emerald-600',
    '行義童軍': 'from-blue-500 to-blue-700',
    '羅浮童軍': 'from-purple-500 to-purple-700',
    '服務員': 'from-amber-500 to-amber-700',
  }
  const sectionIcons: Record<string, string> = {
    '童軍': '🏕️', '行義童軍': '⛺', '羅浮童軍': '🧭', '服務員': '🎖️'
  }

  // 年度（由舊到新）
  const yearsAsc = [...new Set((yearTotals.results as any[]).map((r: any) => r.year_label))].sort()
  const latestYear = yearsAsc[yearsAsc.length - 1] || ''

  // 依年度整理組別人數
  const yearSectionMap: Record<string, Record<string, number>> = {}
  ;(yearSectionData.results as any[]).forEach((r: any) => {
    if (!yearSectionMap[r.year_label]) yearSectionMap[r.year_label] = {}
    yearSectionMap[r.year_label][r.section] = r.count
  })

  // 依年度整理總人數 map
  const yearTotalMap: Record<string, number> = {}
  ;(yearTotals.results as any[]).forEach((r: any) => { yearTotalMap[r.year_label] = r.count })

  // 依年度整理晉級 (award_name → year → count)
  const rankYearMap: Record<string, Record<string, number>> = {}
  ;(yearRankData.results as any[]).forEach((r: any) => {
    if (!rankYearMap[r.award_name]) rankYearMap[r.award_name] = {}
    rankYearMap[r.award_name][r.year_label] = (rankYearMap[r.award_name][r.year_label] || 0) + r.count
  })

  // 依年度整理晉級（section 層）
  const yearRankMap: Record<string, Record<string, Record<string, number>>> = {}
  ;(yearRankData.results as any[]).forEach((r: any) => {
    if (!yearRankMap[r.year_label]) yearRankMap[r.year_label] = {}
    if (!yearRankMap[r.year_label][r.section]) yearRankMap[r.year_label][r.section] = {}
    yearRankMap[r.year_label][r.section][r.award_name] = (yearRankMap[r.year_label][r.section][r.award_name] || 0) + r.count
  })

  // 羅浮海外分組
  const roverCountryMap: Record<string, {count: number, members: string[]}> = {}
  ;(roverMembers.results as any[]).forEach((r: any) => {
    const country = (r.country && r.country !== 'null' && r.country.trim()) ? r.country.trim() : '台灣'
    if (!roverCountryMap[country]) roverCountryMap[country] = { count: 0, members: [] }
    roverCountryMap[country].count++
    const uni = (r.university && r.university !== 'null' && r.university.trim()) ? ` (${r.university})` : ''
    roverCountryMap[country].members.push(r.chinese_name + uni)
  })
  const totalRovers = (roverMembers.results as any[]).length
  const roverCountries = Object.keys(roverCountryMap).sort((a,b) => roverCountryMap[b].count - roverCountryMap[a].count)

  // ── Chart.js 資料準備 ──────────────────────────────────────
  // 總人數趨勢 chart data
  const totalChartData = {
    labels: yearsAsc.map(y => y + '年'),
    datasets: [{
      label: '在籍總人數',
      data: yearsAsc.map(y => yearTotalMap[y] || 0),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.12)',
      tension: 0.4, fill: true, pointRadius: 5, pointHoverRadius: 8,
      pointBackgroundColor: '#3b82f6', borderWidth: 3
    }]
  }

  // 階段別趨勢 chart data（堆疊面積圖）
  const sectionChartData = {
    labels: yearsAsc.map(y => y + '年'),
    datasets: mainSections.map(sec => ({
      label: sec,
      data: yearsAsc.map(y => yearSectionMap[y]?.[sec] || 0),
      borderColor: sectionColors[sec] || '#888',
      backgroundColor: (sectionColors[sec] || '#888') + '33',
      tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 7,
      borderWidth: 2.5
    }))
  }

  // 晉級趨勢 chart data
  const highRankDefs = [
    { name: '獅級童軍', color: '#a855f7' },
    { name: '長城童軍', color: '#3b82f6' },
    { name: '國花童軍', color: '#ec4899' },
  ]
  const rankChartData = {
    labels: yearsAsc.map(y => y + '年'),
    datasets: highRankDefs.map(r => ({
      label: r.name,
      data: yearsAsc.map(y => rankYearMap[r.name]?.[y] || 0),
      borderColor: r.color,
      backgroundColor: r.color + '22',
      tension: 0.4, fill: false, pointRadius: 5, pointHoverRadius: 8,
      borderWidth: 2.5, pointBackgroundColor: r.color
    }))
  }

  // ── Tab 1: 當年度概覽 ──────────────────────────────────────
  const currentSections = yearSectionMap[latestYear] || {}
  const currentTotal = Object.values(currentSections).reduce((s, v) => s + v, 0) || totalMembers

  const currentCards = mainSections.map(sec => {
    const cnt = currentSections[sec] || 0
    const pct = currentTotal > 0 ? Math.round(cnt / currentTotal * 100) : 0
    return `
    <div class="bg-gradient-to-br ${sectionCardColors[sec] || 'from-gray-400 to-gray-600'} text-white rounded-2xl p-5 shadow-lg">
      <div class="flex items-center justify-between mb-2">
        <span class="text-2xl">${sectionIcons[sec] || '⚜️'}</span>
        <span class="text-4xl font-bold">${cnt}</span>
      </div>
      <p class="font-semibold opacity-90">${sec}</p>
      <p class="text-xs opacity-70 mt-1">${pct}% 的成員</p>
    </div>`
  }).join('')

  const coachStageOrder = ['預備教練', '見習教練', '助理教練', '指導教練']
  const coachCards = coachStageOrder.map(stage => {
    const cnt = coachStageMap[stage] || 0
    const bgMap: Record<string,string> = { '預備教練': 'bg-gray-100 border-gray-300', '見習教練': 'bg-yellow-50 border-yellow-300', '助理教練': 'bg-blue-50 border-blue-300', '指導教練': 'bg-green-50 border-green-300' }
    const txtMap: Record<string,string> = { '預備教練': 'text-gray-700', '見習教練': 'text-yellow-700', '助理教練': 'text-blue-700', '指導教練': 'text-green-700' }
    return `<div class="flex flex-col items-center justify-center rounded-xl border-2 p-4 ${bgMap[stage]}">
      <span class="text-2xl font-bold ${txtMap[stage]}">${cnt}</span>
      <span class="text-xs font-medium ${txtMap[stage]} mt-1">${stage}</span>
    </div>`
  }).join('')

  // ── Tab 2: 總人數趨勢（含年度詳情卡）──────────────────────
  const yearDetailCards = [...yearsAsc].reverse().map((yr: any) => {
    const secs = yearSectionMap[yr] || {}
    const total = yearTotalMap[yr] || 0
    const yearRanks = yearRankMap[yr] || {}
    const hasRanks = Object.keys(yearRanks).length > 0

    const secTags = Object.entries(secs).filter(([,v]) => v > 0).map(([sec, cnt]) =>
      `<span class="text-xs px-2 py-0.5 rounded-full font-medium" style="background:${sectionColors[sec] || '#888'}22;color:${sectionColors[sec] || '#888'}">${sec}: ${cnt}</span>`
    ).join('')
    const rankTags = hasRanks ? Object.entries(yearRanks).flatMap(([, awards]) =>
      Object.entries(awards).map(([award, cnt]) =>
        `<span class="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">${award}: ${cnt}</span>`
      )
    ).join('') : ''

    return `
    <div class="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div class="px-5 py-3 flex items-center justify-between" style="background:${yr === latestYear ? '#1e3a5f' : '#374151'}">
        <h3 class="font-bold text-white">${yr} 年度</h3>
        <span class="text-xs text-white/80 bg-white/20 px-3 py-1 rounded-full">總計 ${total} 人</span>
      </div>
      <div class="p-4">
        <p class="text-xs font-semibold text-gray-400 mb-2">依階段分類</p>
        <div class="flex flex-wrap gap-1.5 mb-3">${secTags || '<span class="text-xs text-gray-400">無資料</span>'}</div>
        ${hasRanks ? `<p class="text-xs font-semibold text-gray-400 mb-2">晉級紀錄</p><div class="flex flex-wrap gap-1.5">${rankTags}</div>` : ''}
      </div>
    </div>`
  }).join('')

  // ── Tab 4: 晉級趨勢（年度詳情）──────────────────────────
  const rankDetailCards = [...yearsAsc].reverse().filter(yr =>
    Object.keys(yearRankMap[yr] || {}).length > 0
  ).map(yr => {
    const yearRanks = yearRankMap[yr] || {}
    const allAwards: Record<string, number> = {}
    Object.values(yearRanks).forEach(awards => {
      Object.entries(awards).forEach(([award, cnt]) => {
        allAwards[award] = (allAwards[award] || 0) + cnt
      })
    })
    const rankOrder = ['初級童軍','中級童軍','高級童軍','獅級童軍','長城童軍','國花童軍','見習羅浮','授銜羅浮','服務羅浮']
    const rankTags = Object.entries(allAwards).sort((a,b) =>
      (rankOrder.indexOf(a[0]) + 1 || 99) - (rankOrder.indexOf(b[0]) + 1 || 99)
    ).map(([award, cnt]) => {
      const isHigh = ['獅級童軍','長城童軍','國花童軍'].includes(award)
      return `<span class="text-xs px-2 py-0.5 rounded-full ${isHigh ? 'bg-purple-100 text-purple-700 font-semibold' : 'bg-gray-100 text-gray-600'}">${award}: ${cnt}</span>`
    }).join('')
    const highTotal = (rankYearMap['獅級童軍']?.[yr] || 0) + (rankYearMap['長城童軍']?.[yr] || 0) + (rankYearMap['國花童軍']?.[yr] || 0)
    return `
    <div class="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div class="px-5 py-3 flex items-center justify-between" style="background:${yr === latestYear ? '#4c1d95' : '#374151'}">
        <h3 class="font-bold text-white">${yr} 年度晉級</h3>
        ${highTotal > 0 ? `<span class="text-xs text-white/80 bg-purple-400/30 px-2 py-0.5 rounded-full">高級晉 ${highTotal} 人</span>` : ''}
      </div>
      <div class="p-4"><div class="flex flex-wrap gap-1.5">${rankTags}</div></div>
    </div>`
  }).join('') || '<div class="bg-white rounded-2xl p-8 text-center text-gray-400">尚無晉級記錄</div>'

  // ── Tab 5: 羅浮全球分佈 ──────────────────────────────────
  const googleMapsQuery: Record<string, string> = {
    '台灣': 'Taiwan', '中國': 'China', '日本': 'Japan', '韓國': 'South+Korea',
    '美國': 'United+States', '加拿大': 'Canada', '英國': 'United+Kingdom',
    '德國': 'Germany', '法國': 'France', '澳洲': 'Australia', '紐西蘭': 'New+Zealand',
    '新加坡': 'Singapore', '馬來西亞': 'Malaysia', '泰國': 'Thailand',
    '香港': 'Hong+Kong', '義大利': 'Italy', '西班牙': 'Spain',
    '荷蘭': 'Netherlands', '瑞典': 'Sweden', '丹麥': 'Denmark',
    '波蘭': 'Poland', '奧地利': 'Austria', '瑞士': 'Switzerland',
    '比利時': 'Belgium', '印度': 'India', '巴西': 'Brazil',
    '阿根廷': 'Argentina', '墨西哥': 'Mexico', '俄羅斯': 'Russia', '土耳其': 'Turkey',
    '菲律賓': 'Philippines', '越南': 'Vietnam', '印尼': 'Indonesia',
    '以色列': 'Israel', '伊朗': 'Iran', '沙烏地阿拉伯': 'Saudi+Arabia',
    '埃及': 'Egypt', '南非': 'South+Africa'
  }
  const countryFlags: Record<string, string> = {
    '台灣': '🇹🇼', '中國': '🇨🇳', '日本': '🇯🇵', '韓國': '🇰🇷',
    '美國': '🇺🇸', '加拿大': '🇨🇦', '英國': '🇬🇧', '德國': '🇩🇪',
    '法國': '🇫🇷', '澳洲': '🇦🇺', '紐西蘭': '🇳🇿', '新加坡': '🇸🇬',
    '馬來西亞': '🇲🇾', '泰國': '🇹🇭', '香港': '🇭🇰', '義大利': '🇮🇹',
    '西班牙': '🇪🇸', '荷蘭': '🇳🇱', '瑞典': '🇸🇪', '丹麥': '🇩🇰',
    '波蘭': '🇵🇱', '奧地利': '🇦🇹', '瑞士': '🇨🇭', '比利時': '🇧🇪',
    '印度': '🇮🇳', '巴西': '🇧🇷', '阿根廷': '🇦🇷', '墨西哥': '🇲🇽',
    '俄羅斯': '🇷🇺', '土耳其': '🇹🇷', '菲律賓': '🇵🇭', '越南': '🇻🇳',
    '印尼': '🇮🇩', '以色列': '🇮🇱', '伊朗': '🇮🇷', '南非': '🇿🇦',
    '埃及': '🇪🇬'
  }
  const continentColors: Record<string, string> = {
    '台灣': 'from-purple-50 border-purple-200',
    '日本': 'from-red-50 border-red-200', '韓國': 'from-red-50 border-red-200',
    '中國': 'from-red-50 border-red-200', '香港': 'from-red-50 border-red-200',
    '新加坡': 'from-orange-50 border-orange-200', '馬來西亞': 'from-orange-50 border-orange-200',
    '泰國': 'from-orange-50 border-orange-200', '菲律賓': 'from-orange-50 border-orange-200',
    '越南': 'from-orange-50 border-orange-200', '印尼': 'from-orange-50 border-orange-200',
    '印度': 'from-yellow-50 border-yellow-200',
    '美國': 'from-blue-50 border-blue-200', '加拿大': 'from-blue-50 border-blue-200',
    '英國': 'from-indigo-50 border-indigo-200', '德國': 'from-indigo-50 border-indigo-200',
    '法國': 'from-indigo-50 border-indigo-200', '荷蘭': 'from-indigo-50 border-indigo-200',
    '瑞典': 'from-indigo-50 border-indigo-200', '丹麥': 'from-indigo-50 border-indigo-200',
    '波蘭': 'from-indigo-50 border-indigo-200', '奧地利': 'from-indigo-50 border-indigo-200',
    '瑞士': 'from-indigo-50 border-indigo-200', '比利時': 'from-indigo-50 border-indigo-200',
    '義大利': 'from-indigo-50 border-indigo-200', '西班牙': 'from-indigo-50 border-indigo-200',
    '澳洲': 'from-teal-50 border-teal-200', '紐西蘭': 'from-teal-50 border-teal-200',
    '南非': 'from-green-50 border-green-200', '埃及': 'from-amber-50 border-amber-200',
  }

  const roverCountryCards = roverCountries.map(country => {
    const { count, members } = roverCountryMap[country]
    const flag = countryFlags[country] || '🌐'
    const q = googleMapsQuery[country] || encodeURIComponent(country)
    const memberList = members.map(m => `<li class="text-xs text-gray-600">${m}</li>`).join('')
    const colorClass = continentColors[country] || 'from-gray-50 border-gray-200'
    const countColor = count >= 5 ? 'text-purple-700' : count >= 3 ? 'text-blue-600' : 'text-gray-600'
    return `
    <div class="bg-gradient-to-br ${colorClass} border rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
      <div class="p-4">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-2xl">${flag}</span>
            <h3 class="font-bold text-gray-800">${country}</h3>
          </div>
          <span class="text-xl font-bold ${countColor}">${count} 人</span>
        </div>
        <ul class="space-y-0.5 mb-3">${memberList}</ul>
        <a href="https://maps.google.com/maps?q=${q}&z=5" target="_blank" rel="noopener"
           class="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline">
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          在 Google 地圖查看
        </a>
      </div>
    </div>`
  }).join('')

  // ── Google Simple Map SVG 世界分佈圖 ──────────────────────
  // 國家座標（對應 viewBox="0 0 1010 530" 的精確座標）
  const countryCoords: Record<string, [number,number]> = {
        // 東亞
    '台灣': [835, 195], '中國': [780, 160], '日本': [870, 160], '韓國': [840, 155],
    '香港': [815, 195],
    // 東南亞
    '新加坡': [795, 235], '馬來西亞': [785, 225], '泰國': [780, 210],
    '菲律賓': [840, 210], '越南': [800, 205], '印尼': [810, 250],
    // 南亞
    '印度': [720, 200],
    // 中東
    '以色列': [565, 175], '伊朗': [610, 165], '沙烏地阿拉伯': [590, 195], '土耳其': [560, 150],
    // 中亞/俄羅斯
    '俄羅斯': [670, 100],
    // 歐洲
    '英國': [475, 115], '德國': [500, 120], '法國': [485, 130],
    '荷蘭': [490, 115], '瑞典': [510, 95], '丹麥': [500, 105],
    '波蘭': [515, 115], '奧地利': [510, 125], '瑞士': [495, 130],
    '比利時': [485, 120], '義大利': [505, 140], '西班牙': [470, 145],
    // 非洲
    '埃及': [550, 180], '南非': [540, 310],
    // 北美洲
    '美國': [200, 145], '加拿大': [200, 100], '墨西哥': [190, 190],
    // 南美洲
    '巴西': [320, 270], '阿根廷': [300, 330],
    // 大洋洲
    '澳洲': [850, 320], '紐西蘭': [920, 350]
  }

  // 產生 SVG 標記點
  const mapDots = roverCountries.map(country => {
    const coords = countryCoords[country]
    if (!coords) return ''
    const [x, y] = coords
    const cnt = roverCountryMap[country].count
    const r = Math.max(6, Math.min(18, 6 + cnt * 2))
    const color = sectionColors['羅浮童軍']
    const flag = countryFlags[country] || ''
    const members = roverCountryMap[country].members.join('、')
    return `<g class="map-dot-group" data-country="${country}" style="cursor:pointer" onclick="highlightCountry('${country}')">
      <circle cx="${x}" cy="${y}" r="${r}" fill="${color}" fill-opacity="0.8" stroke="white" stroke-width="2"/>
      <circle cx="${x}" cy="${y}" r="${r + 4}" fill="${color}" fill-opacity="0.2"/>
      ${cnt > 1 ? `<text x="${x}" y="${y + 4}" text-anchor="middle" fill="white" font-size="9" font-weight="bold">${cnt}</text>` : ''}
      <title>${flag} ${country}: ${members}</title>
    </g>`
  }).join('')

  return c.html(`${pageHead('童軍統計 - 林口康橋童軍團')}
<body class="bg-gray-50">
  ${navBar(settings)}
  <div class="hero-gradient text-white py-14 px-4">
    <div class="max-w-5xl mx-auto text-center">
      <div class="text-5xl mb-4">📊</div>
      <h1 class="text-3xl md:text-4xl font-bold mb-2">童軍統計總覽</h1>
      <p class="text-green-200">Scout Statistics · 紀錄每一段成長的足跡</p>
    </div>
  </div>

  <!-- 頂部摘要卡 -->
  <div class="max-w-5xl mx-auto px-4 -mt-6">
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div class="bg-white rounded-2xl shadow-md p-4 text-center border border-gray-100">
        <p class="text-3xl font-bold text-green-700">${totalMembers}</p>
        <p class="text-xs text-gray-500 mt-1">在籍總人數</p>
      </div>
      <div class="bg-white rounded-2xl shadow-md p-4 text-center border border-gray-100">
        <p class="text-3xl font-bold text-purple-600">${totalCoaches}</p>
        <p class="text-xs text-gray-500 mt-1">教練團人數</p>
      </div>
      <div class="bg-white rounded-2xl shadow-md p-4 text-center border border-gray-100">
        <p class="text-3xl font-bold text-blue-600">${yearsAsc.length}</p>
        <p class="text-xs text-gray-500 mt-1">記錄年度</p>
      </div>
      <div class="bg-white rounded-2xl shadow-md p-4 text-center border border-gray-100">
        <p class="text-3xl font-bold text-amber-600">${totalRovers}</p>
        <p class="text-xs text-gray-500 mt-1">羅浮童軍</p>
      </div>
    </div>
  </div>

  <!-- Tab 導覽 -->
  <div class="max-w-5xl mx-auto px-4 mb-6">
    <div class="flex gap-1 overflow-x-auto pb-0 border-b border-gray-200" id="stats-tabs">
      <button onclick="switchTab('current')" id="tab-current"
        class="tab-btn active flex-shrink-0 px-5 py-3 text-sm font-medium border-b-2 border-blue-600 text-blue-700 bg-blue-50/50 whitespace-nowrap">
        📋 最新年度資料
      </button>
      <button onclick="switchTab('total')" id="tab-total"
        class="tab-btn flex-shrink-0 px-5 py-3 text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50 whitespace-nowrap">
        📈 總人數趨勢
      </button>
      <button onclick="switchTab('section')" id="tab-section"
        class="tab-btn flex-shrink-0 px-5 py-3 text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50 whitespace-nowrap">
        👥 階段別趨勢
      </button>
      <button onclick="switchTab('rank')" id="tab-rank"
        class="tab-btn flex-shrink-0 px-5 py-3 text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50 whitespace-nowrap">
        ⚜️ 晉級趨勢
      </button>
      <button onclick="switchTab('rover')" id="tab-rover"
        class="tab-btn flex-shrink-0 px-5 py-3 text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50 whitespace-nowrap">
        🌍 羅浮群全球分佈
      </button>
    </div>
  </div>

  <div class="max-w-5xl mx-auto px-4 pb-16">

    <!-- ====== Tab: 最新年度資料 ====== -->
    <div id="pane-current" class="tab-pane">
      <div class="mb-6">
        <h2 class="text-xl font-bold text-gray-800 mb-1">
          ${latestYear ? latestYear + ' 學年度' : '當年度'} 概覽
        </h2>
        <p class="text-sm text-gray-500">目前在籍成員組成與教練團分佈</p>
      </div>
      <h3 class="font-semibold text-gray-700 mb-3">👥 各組在籍人數</h3>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">${currentCards}</div>

      <h3 class="font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <span>🏋️</span> 教練團階段分佈
        <span class="ml-auto text-sm font-normal text-gray-400">共 ${totalCoaches} 位</span>
      </h3>
      ${totalCoaches > 0 ? `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-8">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">${coachCards}</div>
        <div class="mt-2">
          ${coachStageOrder.map(stage => {
            const cnt = coachStageMap[stage] || 0
            const pct = totalCoaches > 0 ? Math.round(cnt / totalCoaches * 100) : 0
            const colorMap: Record<string,string> = { '預備教練': 'bg-gray-400', '見習教練': 'bg-yellow-400', '助理教練': 'bg-blue-400', '指導教練': 'bg-green-500' }
            return `<div class="flex items-center gap-2 mb-1.5">
              <span class="text-xs text-gray-500 w-16 flex-shrink-0">${stage}</span>
              <div class="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div class="${colorMap[stage]} h-full rounded-full transition-all" style="width:${pct}%"></div>
              </div>
              <span class="text-xs text-gray-600 w-8 text-right">${cnt} 位</span>
            </div>`
          }).join('')}
        </div>
      </div>` : `<div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-8 text-center text-gray-400">尚無教練團資料</div>`}
    </div>

    <!-- ====== Tab: 總人數趨勢 ====== -->
    <div id="pane-total" class="tab-pane hidden">
      <div class="mb-6">
        <h2 class="text-xl font-bold text-gray-800 mb-1">📈 歷年總人數趨勢</h2>
        <p class="text-sm text-gray-500">各年度在籍成員人數變化</p>
      </div>
      ${yearsAsc.length >= 2 ? `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <canvas id="chart-total" height="80"></canvas>
      </div>
      <!-- 統計摘要列 -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        ${(() => {
          const vals = yearsAsc.map(y => yearTotalMap[y] || 0)
          const maxVal = Math.max(...vals)
          const minVal = Math.min(...vals)
          const lastVal = vals[vals.length - 1]
          const prevVal = vals[vals.length - 2]
          const growth = prevVal ? ((lastVal - prevVal) / prevVal * 100).toFixed(1) : '0'
          const growthPos = parseFloat(growth) >= 0
          return `
          <div class="bg-blue-50 rounded-xl p-3 text-center">
            <p class="text-2xl font-bold text-blue-700">${lastVal}</p>
            <p class="text-xs text-blue-500 mt-0.5">最新年度</p>
          </div>
          <div class="bg-${growthPos ? 'green' : 'red'}-50 rounded-xl p-3 text-center">
            <p class="text-2xl font-bold text-${growthPos ? 'green' : 'red'}-700">${growthPos ? '+' : ''}${growth}%</p>
            <p class="text-xs text-${growthPos ? 'green' : 'red'}-500 mt-0.5">年成長率</p>
          </div>
          <div class="bg-purple-50 rounded-xl p-3 text-center">
            <p class="text-2xl font-bold text-purple-700">${maxVal}</p>
            <p class="text-xs text-purple-500 mt-0.5">歷史最高</p>
          </div>
          <div class="bg-amber-50 rounded-xl p-3 text-center">
            <p class="text-2xl font-bold text-amber-700">${minVal}</p>
            <p class="text-xs text-amber-500 mt-0.5">歷史最低</p>
          </div>`
        })()}
      </div>` : `<div class="bg-white rounded-2xl p-8 text-center text-gray-400">需要至少兩個年度的資料才能顯示趨勢</div>`}

      <h3 class="font-semibold text-gray-700 mb-3">年度統計詳情</h3>
      <div class="space-y-3">${yearDetailCards}</div>
    </div>

    <!-- ====== Tab: 階段別趨勢 ====== -->
    <div id="pane-section" class="tab-pane hidden">
      <div class="mb-6">
        <h2 class="text-xl font-bold text-gray-800 mb-1">👥 歷年階段別人數趨勢</h2>
        <p class="text-sm text-gray-500">各童軍階段歷年在籍人數堆疊變化</p>
      </div>
      ${yearsAsc.length >= 2 ? `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <canvas id="chart-section" height="90"></canvas>
      </div>` : ''}
      <!-- 各組當前人數橫條 -->
      <div class="grid md:grid-cols-2 gap-4 mb-6">
        ${mainSections.map(sec => {
          const data = yearsAsc.map(y => yearSectionMap[y]?.[sec] || 0)
          const max = Math.max(...data, 1)
          const latestVal = data[data.length - 1] || 0
          const prevVal = data[data.length - 2] || 0
          const change = data.length >= 2 ? latestVal - prevVal : null
          const color = sectionColors[sec] || '#888'
          const bars = yearsAsc.slice().reverse().map(yr => {
            const val = yearSectionMap[yr]?.[sec] || 0
            const pct = Math.max(Math.round(val / max * 100), val > 0 ? 4 : 0)
            const isLatest = yr === latestYear
            return `
            <div class="flex items-center gap-2 mb-1">
              <span class="w-8 text-xs text-right text-gray-400 flex-shrink-0">${yr}</span>
              <div class="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                <div class="h-full rounded flex items-center justify-end pr-2"
                     style="width:${pct}%;background:${color};opacity:${isLatest ? '1' : '0.5'}">
                  ${val > 0 ? `<span class="text-white text-xs font-bold">${val}</span>` : ''}
                </div>
              </div>
            </div>`
          }).join('')
          return `
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-bold text-gray-800 flex items-center gap-2">
                <span class="text-xl">${sectionIcons[sec] || '⚜️'}</span> ${sec}
              </h3>
              <div class="text-right">
                <span class="text-2xl font-bold" style="color:${color}">${latestVal}</span>
                ${change !== null ? `<p class="text-xs ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-500' : 'text-gray-400'}">${change > 0 ? '↑' : change < 0 ? '↓' : '→'} ${Math.abs(change)}</p>` : ''}
              </div>
            </div>
            ${bars || '<p class="text-gray-400 text-sm">尚無資料</p>'}
          </div>`
        }).join('')}
      </div>
    </div>

    <!-- ====== Tab: 晉級趨勢 ====== -->
    <div id="pane-rank" class="tab-pane hidden">
      <div class="mb-6">
        <h2 class="text-xl font-bold text-gray-800 mb-1">⚜️ 歷年晉級趨勢</h2>
        <p class="text-sm text-gray-500">獅級、長城、國花等高級晉級人數</p>
      </div>
      ${yearsAsc.length >= 1 ? `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <canvas id="chart-rank" height="80"></canvas>
      </div>` : ''}
      <!-- 晉級統計摘要 -->
      <div class="grid md:grid-cols-3 gap-4 mb-6">
        ${highRankDefs.map(rank => {
          const data = yearsAsc.map(y => rankYearMap[rank.name]?.[y] || 0)
          const total = data.reduce((s, v) => s + v, 0)
          const latestVal = data[data.length - 1] || 0
          return `
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
            <p class="text-sm font-semibold mb-1" style="color:${rank.color}">${rank.name}</p>
            <p class="text-3xl font-bold" style="color:${rank.color}">${latestVal}</p>
            <p class="text-xs text-gray-400 mt-1">本年度 · 累計 ${total} 人</p>
          </div>`
        }).join('')}
      </div>
      <h3 class="font-semibold text-gray-700 mb-3">各年度晉級詳情</h3>
      <div class="space-y-3">${rankDetailCards}</div>
    </div>

    <!-- ====== Tab: 羅浮群全球分佈 ====== -->
    <div id="pane-rover" class="tab-pane hidden">
      <div class="mb-6">
        <h2 class="text-xl font-bold text-gray-800 mb-1">🌍 羅浮群全球分佈</h2>
        <p class="text-sm text-gray-500">共 ${totalRovers} 位在籍羅浮童軍，分佈於 ${roverCountries.length} 個地區</p>
      </div>

      ${roverCountries.length > 0 ? `
      <!-- SVG 世界地圖 -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
        <div class="p-4 border-b bg-gray-50 flex items-center justify-between flex-wrap gap-2">
          <h3 class="font-semibold text-gray-700 flex items-center gap-2">
            <svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            互動世界地圖 · 點擊標記查看成員
          </h3>
          <div class="flex gap-1.5 flex-wrap" id="map-country-btns">
            ${roverCountries.map(c => {
              const flag = countryFlags[c] || '🌐'
              return `<button onclick="highlightCountry('${c}')"
                class="map-country-btn text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-all flex items-center gap-1"
                data-country="${c}">
                ${flag} ${c}
                <span class="font-semibold text-purple-600 ml-0.5">${roverCountryMap[c].count}</span>
              </button>`
            }).join('')}
          </div>
        </div>
        <!-- SVG 精確世界地圖 -->
        <div class="relative" style="padding-bottom:42.87%;background:#000">
          <svg id="world-svg" viewBox="0 0 1024 439" class="absolute inset-0 w-full h-full" style="background:#000">
            <image href="/static/8Wyfoby3.jpg" x="0" y="0" width="1024" height="439" />
            
            <!-- ===== 標記點（人員位置）===== -->
            ${mapDots}
          </svg>
        </div>
        <!-- 選中國家資訊 -->
        <div id="map-info-panel" class="p-4 border-t bg-gradient-to-r from-purple-50 to-blue-50 hidden">
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span id="info-flag" class="text-3xl"></span>
                <div>
                  <h4 id="info-name" class="font-bold text-gray-800 text-lg"></h4>
                  <p id="info-count" class="text-sm text-purple-600 font-semibold"></p>
                </div>
              </div>
              <ul id="info-members" class="text-sm text-gray-600 space-y-0.5"></ul>
            </div>
            <a id="info-map-link" href="#" target="_blank" rel="noopener"
               class="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline mt-1 flex-shrink-0">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              Google Maps
            </a>
          </div>
        </div>
      </div>
      <!-- 國家卡片列表 -->
      <div class="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        ${roverCountryCards}
      </div>` : `
      <div class="bg-white rounded-2xl p-12 text-center">
        <p class="text-5xl mb-4">🌍</p>
        <p class="text-gray-500 text-lg">尚未設定羅浮童軍所在地資料</p>
        <p class="text-gray-400 text-sm mt-2">請在成員管理中設定國家與大學資訊</p>
      </div>`}
    </div>

  </div>

  ${pageFooter(settings)}

  <!-- Chart.js CDN -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>

  <script>
    // ── 統計資料 ──────────────────────────────────────────
    const TOTAL_CHART_DATA = ${JSON.stringify(totalChartData)};
    const SECTION_CHART_DATA = ${JSON.stringify(sectionChartData)};
    const RANK_CHART_DATA = ${JSON.stringify(rankChartData)};
    const ROVER_COUNTRY_MAP = ${JSON.stringify(roverCountryMap)};
    const COUNTRY_FLAGS = ${JSON.stringify(countryFlags)};
    const GOOGLE_MAPS_QUERY = ${JSON.stringify(googleMapsQuery)};

    let chartInstances = {};

    // ── Tab 切換 ──────────────────────────────────────────
    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('border-blue-600', 'text-blue-700', 'bg-blue-50/50')
        btn.classList.add('border-transparent', 'text-gray-600')
      })
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'))
      const activeBtn = document.getElementById('tab-' + tabId)
      if (activeBtn) {
        activeBtn.classList.add('border-blue-600', 'text-blue-700', 'bg-blue-50/50')
        activeBtn.classList.remove('border-transparent', 'text-gray-600')
      }
      const activePane = document.getElementById('pane-' + tabId)
      if (activePane) activePane.classList.remove('hidden')
      // 延遲初始化 chart，確保 canvas 已顯示
      setTimeout(() => initChart(tabId), 50)
    }

    // ── Chart.js 圖表初始化 ──────────────────────────────
    const CHART_DEFAULT_OPTS = {
      responsive: true,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16, font: { size: 12 } } },
        tooltip: {
          backgroundColor: 'rgba(17,24,39,0.9)',
          titleFont: { size: 13, weight: 'bold' },
          bodyFont: { size: 12 },
          padding: 10,
          cornerRadius: 8
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 }, precision: 0 } }
      },
      animation: { duration: 600 }
    }

    function initChart(tabId) {
      if (tabId === 'total' && !chartInstances.total) {
        const ctx = document.getElementById('chart-total')
        if (!ctx) return
        chartInstances.total = new Chart(ctx, {
          type: 'line',
          data: TOTAL_CHART_DATA,
          options: {
            ...CHART_DEFAULT_OPTS,
            plugins: {
              ...CHART_DEFAULT_OPTS.plugins,
              legend: { display: false },
              tooltip: {
                ...CHART_DEFAULT_OPTS.plugins.tooltip,
                callbacks: {
                  label: ctx => ctx.dataset.label + ': ' + ctx.parsed.y + ' 人'
                }
              }
            },
            scales: {
              ...CHART_DEFAULT_OPTS.scales,
              y: { ...CHART_DEFAULT_OPTS.scales.y, title: { display: true, text: '人數', font: { size: 11 } } }
            }
          }
        })
      }
      if (tabId === 'section' && !chartInstances.section) {
        const ctx = document.getElementById('chart-section')
        if (!ctx) return
        chartInstances.section = new Chart(ctx, {
          type: 'line',
          data: SECTION_CHART_DATA,
          options: {
            ...CHART_DEFAULT_OPTS,
            plugins: {
              ...CHART_DEFAULT_OPTS.plugins,
              tooltip: {
                ...CHART_DEFAULT_OPTS.plugins.tooltip,
                callbacks: {
                  label: ctx => ctx.dataset.label + ': ' + ctx.parsed.y + ' 人'
                }
              }
            },
            scales: {
              ...CHART_DEFAULT_OPTS.scales,
              y: { ...CHART_DEFAULT_OPTS.scales.y, stacked: false, title: { display: true, text: '人數', font: { size: 11 } } }
            }
          }
        })
      }
      if (tabId === 'rank' && !chartInstances.rank) {
        const ctx = document.getElementById('chart-rank')
        if (!ctx) return
        chartInstances.rank = new Chart(ctx, {
          type: 'bar',
          data: RANK_CHART_DATA,
          options: {
            ...CHART_DEFAULT_OPTS,
            plugins: {
              ...CHART_DEFAULT_OPTS.plugins,
              tooltip: {
                ...CHART_DEFAULT_OPTS.plugins.tooltip,
                callbacks: {
                  label: ctx => ctx.dataset.label + ': ' + ctx.parsed.y + ' 人'
                }
              }
            },
            scales: {
              ...CHART_DEFAULT_OPTS.scales,
              x: { ...CHART_DEFAULT_OPTS.scales.x, stacked: false },
              y: { ...CHART_DEFAULT_OPTS.scales.y, title: { display: true, text: '晉級人數', font: { size: 11 } } }
            }
          }
        })
      }
    }

    // ── 地圖互動 ──────────────────────────────────────────
    function highlightCountry(countryName) {
      // 更新按鈕
      document.querySelectorAll('.map-country-btn').forEach(btn => {
        btn.classList.remove('bg-purple-100', 'border-purple-400', 'text-purple-800')
      })
      const activeBtn = document.querySelector('[data-country="' + countryName + '"]')
      if (activeBtn) activeBtn.classList.add('bg-purple-100', 'border-purple-400', 'text-purple-800')

      // 更新 SVG 圓點
      document.querySelectorAll('.map-dot-group circle:first-child').forEach(c => {
        c.setAttribute('stroke-width', '2')
        c.setAttribute('stroke', 'white')
      })
      const activeDot = document.querySelector('[data-country="' + countryName + '"] circle')
      if (activeDot) {
        activeDot.setAttribute('stroke-width', '3')
        activeDot.setAttribute('stroke', '#fbbf24')
      }

      // 顯示資訊面板
      const data = ROVER_COUNTRY_MAP[countryName]
      const panel = document.getElementById('map-info-panel')
      if (data && panel) {
        panel.classList.remove('hidden')
        document.getElementById('info-flag').textContent = COUNTRY_FLAGS[countryName] || '🌐'
        document.getElementById('info-name').textContent = countryName
        document.getElementById('info-count').textContent = data.count + ' 位童軍'
        const membersList = document.getElementById('info-members')
        membersList.innerHTML = data.members.map(m => '<li>• ' + m + '</li>').join('')
        const q = GOOGLE_MAPS_QUERY[countryName] || encodeURIComponent(countryName)
        document.getElementById('info-map-link').href = 'https://maps.google.com/maps?q=' + q + '&z=5'
      }
    }

    // ── URL Hash 支援 ──────────────────────────────────────
    const hash = location.hash.replace('#', '')
    if (['current','total','section','rank','rover'].includes(hash)) {
      switchTab(hash)
    } else {
      // 初始化第一個 tab 的 chart（若需要）
      // current tab 沒有 chart，不需初始化
    }
  </script>
`)
})


// ===================== 出席查詢公開頁 =====================
frontendRoutes.get('/attendance', async (c) => {
  const db = c.env.DB

  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  const sectionFilter = c.req.query('section') || 'all'

  // 出席場次列表
  const sessionsQuery = sectionFilter === 'all'
    ? `SELECT s.*, COUNT(CASE WHEN ar.status='present' THEN 1 END) as present_count, COUNT(ar.id) as total_count
       FROM attendance_sessions s
       LEFT JOIN attendance_records ar ON ar.session_id = s.id
       GROUP BY s.id ORDER BY s.date DESC LIMIT 20`
    : `SELECT s.*, COUNT(CASE WHEN ar.status='present' THEN 1 END) as present_count, COUNT(ar.id) as total_count
       FROM attendance_sessions s
       LEFT JOIN attendance_records ar ON ar.session_id = s.id
       WHERE s.section = ? OR s.section = 'all'
       GROUP BY s.id ORDER BY s.date DESC LIMIT 20`

  const sessions = sectionFilter === 'all'
    ? await db.prepare(sessionsQuery).all()
    : await db.prepare(sessionsQuery).bind(sectionFilter).all()

  // 出席率總計
  const overallStats = await db.prepare(`
    SELECT
      COUNT(DISTINCT s.id) as session_count,
      COUNT(CASE WHEN ar.status='present' THEN 1 END) as total_present,
      COUNT(ar.id) as total_records
    FROM attendance_sessions s
    LEFT JOIN attendance_records ar ON ar.session_id = s.id
  `).first() as any

  const overallRate = overallStats?.total_records > 0
    ? Math.round(overallStats.total_present / overallStats.total_records * 100)
    : 0

  const sectionTabs = [
    { key: 'all', label: '全部' },
    { key: 'junior', label: '童軍' },
    { key: 'senior', label: '行義童軍' },
    { key: 'rover', label: '羅浮童軍' },
  ].map(tab => `
    <a href="/attendance?section=${tab.key}"
      class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sectionFilter === tab.key
        ? 'bg-green-700 text-white shadow'
        : 'bg-white text-gray-600 hover:bg-green-50 border border-gray-200'}">
      ${tab.label}
    </a>
  `).join('')

  const sectionLabel: Record<string, string> = { junior: '童軍', senior: '行義童軍', rover: '羅浮童軍', all: '全體' }

  const sessionRows = (sessions.results as any[]).map((s: any) => {
    const rate = s.total_count > 0 ? Math.round(s.present_count / s.total_count * 100) : 0
    const rateColor = rate >= 80 ? 'text-green-700 bg-green-50 border-green-200'
      : rate >= 60 ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-red-600 bg-red-50 border-red-200'
    const dateStr = s.date ? new Date(s.date).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
    return `
    <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-gray-800 truncate">${s.title}</h3>
          ${s.topic ? `<p class="text-sm text-gray-500 mt-0.5">📋 ${s.topic}</p>` : ''}
          <div class="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
            <span>📅 ${dateStr}</span>
            <span class="bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">${sectionLabel[s.section] || s.section}</span>
          </div>
        </div>
        <div class="flex flex-col items-end flex-shrink-0">
          <span class="text-2xl font-bold ${rateColor.split(' ')[0]}">${rate}%</span>
          <span class="text-xs text-gray-400">${s.present_count}/${s.total_count} 出席</span>
          <span class="mt-1 text-xs border px-2 py-0.5 rounded-full ${rateColor}">
            ${rate >= 80 ? '出席良好' : rate >= 60 ? '尚可' : s.total_count === 0 ? '未記錄' : '出席偏低'}
          </span>
        </div>
      </div>
    </div>`
  }).join('')

  return c.html(`${pageHead('出席記錄 - 林口康橋童軍團')}
<body class="bg-gray-50">
  ${navBar(settings)}
  <div class="hero-gradient text-white py-14 px-4">
    <div class="max-w-5xl mx-auto">
      <div class="flex items-center gap-2 text-green-300 text-sm mb-4">
        <a href="/" class="hover:text-white transition-colors">首頁</a>
        <span>›</span>
        <span class="text-white">出席記錄</span>
      </div>
      <div class="flex items-center gap-4">
        <span class="text-5xl">📅</span>
        <div>
          <h1 class="text-3xl md:text-4xl font-bold">出席記錄查詢</h1>
          <p class="text-green-200 mt-1">Attendance Records · 團集會出席情況</p>
        </div>
      </div>
      <div class="mt-6 flex gap-8 text-center">
        <div>
          <div class="text-3xl font-bold">${overallStats?.session_count || 0}</div>
          <div class="text-green-300 text-xs mt-0.5">累計場次</div>
        </div>
        <div class="w-px bg-green-600"></div>
        <div>
          <div class="text-3xl font-bold">${overallRate}%</div>
          <div class="text-green-300 text-xs mt-0.5">整體出席率</div>
        </div>
        <div class="w-px bg-green-600"></div>
        <div>
          <div class="text-3xl font-bold">${overallStats?.total_present || 0}</div>
          <div class="text-green-300 text-xs mt-0.5">累計出席人次</div>
        </div>
      </div>
    </div>
  </div>
  <div class="max-w-5xl mx-auto px-4 py-10">
    <!-- 篩選標籤 -->
    <div class="flex gap-2 flex-wrap mb-6">
      ${sectionTabs}
    </div>
    <!-- 場次列表 -->
    <div class="grid gap-3">
      ${sessionRows || `<div class="text-center py-20 text-gray-400">
        <div class="text-5xl mb-4">📭</div>
        <p class="text-lg">尚無出席記錄</p>
      </div>`}
    </div>
    ${sessions.results.length >= 20 ? `
    <div class="text-center mt-8 text-gray-400 text-sm">
      顯示最近 20 場 · 更多記錄請洽管理員
    </div>` : ''}
  </div>
  ${pageFooter(settings)}
`)
})

// ===================== 精彩回顧（歷年活動相冊）=====================
frontendRoutes.get('/highlights', async (c) => {
  const db = c.env.DB

  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  // 取得所有精彩回顧相冊（show_in_highlights=1 或 activity_status='completed'，且有圖片的活動）
  const allActivitiesData = await db.prepare(`
    SELECT a.*,
      GROUP_CONCAT(ai.image_url) as image_urls,
      GROUP_CONCAT(ai.caption) as captions,
      GROUP_CONCAT(ai.id) as image_ids,
      COUNT(ai.id) as img_count
    FROM activities a
    LEFT JOIN activity_images ai ON ai.activity_id = a.id
    WHERE a.is_published = 1 AND (a.show_in_highlights = 1 OR a.activity_status = 'completed')
    GROUP BY a.id
    HAVING img_count > 0 OR a.cover_image IS NOT NULL
    ORDER BY a.display_order ASC, a.activity_date DESC
  `).all()
  
  const allActivities = allActivitiesData.results;

  const categoryIcon: Record<string, string> = {
    camping: '⛺', tecc: '🚑', service: '🤝', training: '📚',
    general: '⚜️', highlight: '🌟'
  }
  const categoryLabel: Record<string, string> = {
    camping: '露營', tecc: 'TECC急救', service: '服務',
    training: '訓練', general: '活動', highlight: '精彩回顧'
  }

  // 統計
  const totalAlbums = allActivities.length
  const totalPhotos = (allActivities as any[]).reduce((s: number, a: any) => s + (a.img_count || 0), 0)

  // 相冊卡片
  const albumCards = (allActivities as any[]).map((a: any, idx: number) => {
    const images = a.image_urls ? a.image_urls.split(',').filter(Boolean) : []
    const captions = a.captions ? a.captions.split(',') : []
    const coverImg = a.cover_image || images[0] || ''
    const catClass = a.category || 'general'
    const icon = categoryIcon[a.category] || '⚜️'
    const label = categoryLabel[a.category] || '活動'

    // 圖片縮圖（最多4張）
    const thumbs = images.slice(0, 4).map((url: string, i: number) => `
      <div class="aspect-square overflow-hidden rounded cursor-pointer hover:opacity-90 transition-opacity"
           onclick="openGallery(${a.id}, ${i})">
        <img src="${url}" alt="${captions[i] || a.title}" loading="lazy"
             class="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
             onerror="this.parentElement.style.display='none'">
      </div>
    `).join('')

    const moreCount = images.length > 4 ? images.length - 4 : 0

    return `
    <div class="album-card bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-300 group" id="album-${a.id}" data-cat="${catClass}">
      <!-- 封面大圖 -->
      <div class="relative h-52 overflow-hidden cursor-pointer" onclick="openGallery(${a.id}, 0)">
        ${coverImg
          ? `<img src="${coverImg}" alt="${a.title}" loading="lazy"
               class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
               onerror="this.parentElement.innerHTML='<div class=\\'flex items-center justify-center h-full bg-gradient-to-br from-green-50 to-emerald-100\\'><span class=\\'text-6xl\\'>${icon}</span></div>'">`
          : `<div class="flex items-center justify-center h-full bg-gradient-to-br from-green-50 to-emerald-100"><span class="text-6xl">${icon}</span></div>`
        }
        <!-- 圖片數量 badge -->
        ${images.length > 0 ? `
        <div class="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
          📷 ${images.length} 張
        </div>` : ''}
        <!-- 分類 badge -->
        <div class="absolute top-3 left-3 bg-white/90 text-gray-700 text-xs px-2.5 py-1 rounded-full font-medium backdrop-blur-sm">
          ${icon} ${label}
        </div>
      </div>

      <!-- 資訊區 -->
      <div class="p-4">
        <h3 class="font-bold text-gray-800 text-base mb-1 cursor-pointer hover:text-green-700 transition-colors"
            onclick="openGallery(${a.id}, 0)">${a.title}</h3>
        ${a.title_en ? `<p class="text-gray-400 text-xs mb-2">${a.title_en}</p>` : ''}
        ${a.description ? `<p class="text-gray-500 text-sm line-clamp-2 mb-3">${a.description}</p>` : ''}
        ${a.date_display || a.activity_date ? `
        <p class="text-gray-400 text-xs flex items-center gap-1">
          📅 ${a.date_display || a.activity_date}
        </p>` : ''}

        <!-- 縮圖格 -->
        ${thumbs ? `
        <div class="grid grid-cols-4 gap-1 mt-3">
          ${thumbs}
          ${moreCount > 0 ? `
          <div class="aspect-square rounded bg-gray-100 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
               onclick="openGallery(${a.id}, 4)">
            <span class="text-gray-500 font-bold text-sm">+${moreCount}</span>
          </div>` : ''}
        </div>` : ''}
      </div>
    </div>

    <!-- 相冊 Lightbox 資料 (hidden) -->
    <script>
    window._albums = window._albums || {};
    window._albums[${a.id}] = {
      title: ${JSON.stringify(a.title)},
      images: [${images.map((url: string, i: number) => JSON.stringify({ url, caption: captions[i] || '' })).join(',')}]
    };
    </script>`
  }).join('')

  
  // Category tabs for filtering
  const cats = [
    { id: 'all', name: '全部', icon: '📸' },
    { id: 'camping', name: '露營', icon: '⛺' },
    { id: 'tecc', name: 'TECC急救', icon: '🚑' },
    { id: 'service', name: '服務', icon: '🤝' },
    { id: 'training', name: '訓練', icon: '📚' },
    { id: 'general', name: '一般活動', icon: '⚜️' },
    { id: 'national_day', name: '國慶服務', icon: '🇹🇼' }
  ];
  
  const filterHtml = `
    <div class="flex flex-wrap justify-center gap-2 mb-8">
      ${cats.map(c => `
        <button onclick="filterHighlights('${c.id}')" id="btn-filter-${c.id}" class="px-4 py-2 rounded-full text-sm font-medium transition-colors border ${c.id === 'all' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-500 hover:text-green-600'}">
          ${c.icon} ${c.name}
        </button>
      `).join('')}
    </div>
    
    <script>
      function filterHighlights(cat) {
        document.querySelectorAll('[id^="btn-filter-"]').forEach(btn => {
          btn.className = 'px-4 py-2 rounded-full text-sm font-medium transition-colors border bg-white text-gray-600 border-gray-200 hover:border-green-500 hover:text-green-600';
        });
        const activeBtn = document.getElementById('btn-filter-' + cat);
        if (activeBtn) {
          activeBtn.className = 'px-4 py-2 rounded-full text-sm font-medium transition-colors border bg-green-600 text-white border-green-600';
        }
        
        document.querySelectorAll('.album-card').forEach(card => {
          if (cat === 'all' || card.dataset.cat === cat) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      }
    </script>
  `;

  return c.html(`${pageHead('精彩回顧 - 林口康橋童軍團')}
<body class="bg-gray-50">
  ${navBar(settings)}

  <!-- Hero Banner -->
  <div class="hero-gradient text-white py-14 px-4 relative overflow-hidden">
    <div class="absolute inset-0 opacity-10">
      <div class="absolute inset-0" style="background-image: repeating-linear-gradient(45deg, transparent, transparent 30px, rgba(255,255,255,0.05) 30px, rgba(255,255,255,0.05) 60px)"></div>
    </div>
    <div class="max-w-5xl mx-auto relative">
      <div class="flex items-center gap-2 text-green-300 text-sm mb-4">
        <a href="/" class="hover:text-white transition-colors">首頁</a>
        <span>›</span>
        <span class="text-white">精彩回顧</span>
      </div>
      <div class="text-center">
        <div class="text-5xl mb-4">📸</div>
        <h1 class="text-3xl md:text-4xl font-bold mb-2">歷年精彩回顧</h1>
        <p class="text-green-200">Highlight Gallery · 每一段回憶都是珍貴的童軍足跡</p>
        <div class="flex justify-center gap-10 mt-8">
          <div class="text-center">
            <div class="text-3xl font-bold">${totalAlbums}</div>
            <div class="text-green-300 text-xs mt-1">精彩相冊</div>
          </div>
          <div class="w-px bg-green-600"></div>
          <div class="text-center">
            <div class="text-3xl font-bold">${totalPhotos}</div>
            <div class="text-green-300 text-xs mt-1">珍貴照片</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 篩選器 -->
  <div class="max-w-5xl mx-auto px-4 pt-8 pb-2">
    ${filterHtml}
  </div>

  <!-- 相冊網格 -->
  <div class="max-w-5xl mx-auto px-4 pb-10">
    ${allActivities.length > 0
      ? `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">${albumCards}</div>`
      : `<div class="text-center py-24 text-gray-400">
          <div class="text-6xl mb-4">📭</div>
          <p class="text-xl font-medium">尚無精彩回顧相冊</p>
          <p class="text-sm mt-2">請至後台新增活動並標記為精彩回顧</p>
        </div>`
    }
  </div>

  <!-- Lightbox -->
  <div id="lb-overlay" class="fixed inset-0 bg-black/95 z-[9999] hidden flex-col items-center justify-center">
    <div class="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
      <div>
        <h2 id="lb-title" class="text-white font-bold text-lg"></h2>
        <p id="lb-counter" class="text-gray-400 text-sm"></p>
      </div>
      <button onclick="closeLightbox()" class="text-white/80 hover:text-white text-3xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">×</button>
    </div>
    <div class="flex items-center justify-center w-full flex-1 px-12">
      <button onclick="prevImg()" class="absolute left-3 text-white/70 hover:text-white text-4xl w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors z-10">‹</button>
      <img id="lb-img" src="" alt="" class="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl">
      <button onclick="nextImg()" class="absolute right-3 text-white/70 hover:text-white text-4xl w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors z-10">›</button>
    </div>
    <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent text-center">
      <p id="lb-caption" class="text-gray-300 text-sm"></p>
      <!-- 縮圖列 -->
      <div id="lb-thumbs" class="flex gap-2 justify-center mt-3 overflow-x-auto pb-1"></div>
    </div>
  </div>

  <script>
  let _curAlbumId = null, _curIdx = 0;

  function openGallery(albumId, startIdx) {
    const album = window._albums[albumId];
    if (!album || !album.images || album.images.length === 0) return;
    _curAlbumId = albumId;
    _curIdx = startIdx || 0;
    document.getElementById('lb-title').textContent = album.title;
    renderLbThumbs();
    showImg();
    const overlay = document.getElementById('lb-overlay');
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    const overlay = document.getElementById('lb-overlay');
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
    document.body.style.overflow = '';
  }

  function showImg() {
    const album = window._albums[_curAlbumId];
    if (!album) return;
    const item = album.images[_curIdx];
    document.getElementById('lb-img').src = item.url;
    document.getElementById('lb-caption').textContent = item.caption || '';
    document.getElementById('lb-counter').textContent = (_curIdx + 1) + ' / ' + album.images.length;
    // 更新縮圖高亮
    document.querySelectorAll('#lb-thumbs img').forEach((el, i) => {
      el.classList.toggle('ring-2', i === _curIdx);
      el.classList.toggle('ring-white', i === _curIdx);
      el.classList.toggle('opacity-60', i !== _curIdx);
    });
  }

  function renderLbThumbs() {
    const album = window._albums[_curAlbumId];
    if (!album) return;
    const container = document.getElementById('lb-thumbs');
    container.innerHTML = album.images.map((item, i) =>
      '<img src="' + item.url + '" alt="" class="w-12 h-12 object-cover rounded cursor-pointer opacity-60 hover:opacity-100 transition-opacity" onclick="jumpImg(' + i + ')">'
    ).join('');
  }

  function jumpImg(idx) { _curIdx = idx; showImg(); }
  function prevImg() {
    const album = window._albums[_curAlbumId];
    if (!album) return;
    _curIdx = (_curIdx - 1 + album.images.length) % album.images.length;
    showImg();
  }
  function nextImg() {
    const album = window._albums[_curAlbumId];
    if (!album) return;
    _curIdx = (_curIdx + 1) % album.images.length;
    showImg();
  }

  // 鍵盤控制
  document.addEventListener('keydown', function(e) {
    const overlay = document.getElementById('lb-overlay');
    if (overlay.classList.contains('hidden')) return;
    if (e.key === 'ArrowLeft') prevImg();
    if (e.key === 'ArrowRight') nextImg();
    if (e.key === 'Escape') closeLightbox();
  });

  // 點擊背景關閉
  document.getElementById('lb-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeLightbox();
  });
  </script>

  ${pageFooter(settings)}
`)
})

// ===================== 精彩回顧 - 單一活動相冊頁 =====================
frontendRoutes.get('/highlights/:id', async (c) => {
  const db = c.env.DB
  const activityId = c.req.param('id')

  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  const activity = await db.prepare(`
    SELECT * FROM activities WHERE id = ? AND is_published = 1
  `).bind(activityId).first() as any

  if (!activity) return c.notFound()

  const images = await db.prepare(`
    SELECT * FROM activity_images WHERE activity_id = ? ORDER BY display_order ASC
  `).bind(activityId).all()

  const categoryLabel: Record<string, string> = {
    camping: '露營', tecc: 'TECC急救', service: '服務',
    training: '訓練', general: '活動', highlight: '精彩回顧'
  }

  const photoGrid = (images.results as any[]).map((img: any, idx: number) => `
    <div class="group relative aspect-[4/3] overflow-hidden rounded-xl cursor-pointer bg-gray-100 shadow-sm hover:shadow-lg transition-all duration-300"
         onclick="openPhoto(${idx})">
      <img src="${img.image_url}" alt="${img.caption || ''}" loading="lazy"
           class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
           onerror="this.parentElement.classList.add('bg-gray-200')">
      ${img.caption ? `
      <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
        <p class="text-white text-xs">${img.caption}</p>
      </div>` : ''}
    </div>
  `).join('')

  const photosJson = JSON.stringify((images.results as any[]).map((img: any) => ({
    url: img.image_url, caption: img.caption || ''
  })))

  return c.html(`${pageHead(`${activity.title} - 精彩回顧 - 林口康橋童軍團`)}
<body class="bg-gray-50">
  ${navBar(settings)}
  <div class="hero-gradient text-white py-12 px-4">
    <div class="max-w-5xl mx-auto">
      <div class="flex items-center gap-2 text-green-300 text-sm mb-4 flex-wrap">
        <a href="/" class="hover:text-white transition-colors">首頁</a>
        <span>›</span>
        <a href="/highlights" class="hover:text-white transition-colors">精彩回顧</a>
        <span>›</span>
        <span class="text-white">${activity.title}</span>
      </div>
      <h1 class="text-2xl md:text-3xl font-bold">${activity.title}</h1>
      ${activity.title_en ? `<p class="text-green-200 mt-1 text-sm">${activity.title_en}</p>` : ''}
      <div class="flex items-center gap-4 mt-3 text-sm text-green-200 flex-wrap">
        ${activity.date_display || activity.activity_date ? `<span>📅 ${activity.date_display || activity.activity_date}</span>` : ''}
        <span>📷 ${images.results.length} 張照片</span>
        <span class="bg-white/20 px-2 py-0.5 rounded-full text-xs">${categoryLabel[activity.category] || '活動'}</span>
      </div>
    </div>
  </div>

  <div class="max-w-5xl mx-auto px-4 py-8">
    ${activity.description ? `
    <div class="bg-white rounded-xl border border-gray-100 p-5 mb-8 shadow-sm">
      <p class="text-gray-600 leading-relaxed">${activity.description}</p>
    </div>` : ''}

    ${images.results.length > 0
      ? `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">${photoGrid}</div>`
      : `<div class="text-center py-20 text-gray-400"><div class="text-5xl mb-4">📭</div><p>尚無照片</p></div>`
    }

    <div class="mt-8 text-center">
      <a href="/highlights" class="inline-flex items-center gap-2 text-green-700 hover:text-green-900 font-medium transition-colors">
        ← 返回精彩回顧
      </a>
    </div>
  </div>

  <!-- Lightbox -->
  <div id="lb-overlay" class="fixed inset-0 bg-black/95 z-[9999] hidden flex-col items-center justify-center">
    <div class="absolute top-0 left-0 right-0 flex items-center justify-between p-4">
      <p id="lb-counter" class="text-gray-400 text-sm"></p>
      <button onclick="closeLb()" class="text-white/80 hover:text-white text-3xl">×</button>
    </div>
    <div class="flex items-center justify-center w-full flex-1 px-12 relative">
      <button onclick="prev()" class="absolute left-3 text-white/70 hover:text-white text-5xl w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 z-10">‹</button>
      <img id="lb-img" src="" class="max-h-[80vh] max-w-full object-contain rounded-lg">
      <button onclick="next()" class="absolute right-3 text-white/70 hover:text-white text-5xl w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 z-10">›</button>
    </div>
    <p id="lb-cap" class="text-gray-300 text-sm pb-4 px-4 text-center"></p>
  </div>

  <script>
  const _photos = ${photosJson};
  let _cur = 0;
  function openPhoto(idx) {
    _cur = idx;
    document.getElementById('lb-img').src = _photos[idx].url;
    document.getElementById('lb-cap').textContent = _photos[idx].caption;
    document.getElementById('lb-counter').textContent = (idx+1) + ' / ' + _photos.length;
    const o = document.getElementById('lb-overlay');
    o.classList.remove('hidden'); o.classList.add('flex');
    document.body.style.overflow='hidden';
  }
  function closeLb() {
    const o = document.getElementById('lb-overlay');
    o.classList.add('hidden'); o.classList.remove('flex');
    document.body.style.overflow='';
  }
  function prev() { _cur = (_cur-1+_photos.length)%_photos.length; openPhoto(_cur); }
  function next() { _cur = (_cur+1)%_photos.length; openPhoto(_cur); }
  document.addEventListener('keydown', e => {
    if (document.getElementById('lb-overlay').classList.contains('hidden')) return;
    if (e.key==='ArrowLeft') prev();
    if (e.key==='ArrowRight') next();
    if (e.key==='Escape') closeLb();
  });
  document.getElementById('lb-overlay').addEventListener('click', e => { if(e.target===document.getElementById('lb-overlay')) closeLb(); });
  </script>

  ${pageFooter(settings)}
`)
})

// ===================== 相關網頁 =====================
frontendRoutes.get('/links', async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  const links = await db.prepare(`SELECT * FROM site_links WHERE is_active=1 ORDER BY display_order ASC, id ASC`).all()

  const byCategory: Record<string, any[]> = {}
  links.results.forEach((l: any) => {
    const cat = l.category || '其他'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(l)
  })

  const categoryBlocks = Object.entries(byCategory).map(([cat, items]) => `
    <div class="mb-10">
      <h3 class="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2 pb-2 border-b border-gray-200">
        <span class="w-2 h-6 bg-green-600 rounded-full inline-block"></span>
        ${cat}
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${items.map((l: any) => `
          <a href="${l.url}" target="_blank" rel="noopener noreferrer"
             class="flex items-start gap-4 bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-green-200 transition-all group">
            <span class="text-3xl flex-shrink-0 mt-0.5">${l.icon_emoji || '🔗'}</span>
            <div class="flex-1 min-w-0">
              <div class="font-bold text-gray-800 group-hover:text-green-700 transition-colors leading-tight">${l.title}</div>
              ${l.description ? `<p class="text-gray-500 text-sm mt-1 leading-snug">${l.description}</p>` : ''}
              <p class="text-green-600 text-xs mt-2 truncate">${l.url}</p>
            </div>
            <span class="text-gray-300 group-hover:text-green-400 transition-colors flex-shrink-0 mt-1">→</span>
          </a>
        `).join('')}
      </div>
    </div>
  `).join('')

  const groups = await db.prepare(`SELECT * FROM scout_groups WHERE is_active=1 ORDER BY display_order ASC`).all()

  return c.html(`${pageHead('相關網頁 - 林口康橋童軍團')}
<body class="bg-gray-50">
  ${navBar(settings, groups.results)}
  <div class="hero-gradient text-white py-14 px-4">
    <div class="max-w-4xl mx-auto">
      <div class="flex items-center gap-2 text-green-300 text-sm mb-4 flex-wrap">
        <a href="/" class="hover:text-white transition-colors">首頁</a>
        <span>›</span>
        <span class="text-white">相關網頁</span>
      </div>
      <div class="flex items-center gap-4">
        <span class="text-4xl">🔗</span>
        <div>
          <h1 class="text-2xl md:text-3xl font-bold">相關網頁</h1>
          <p class="text-green-200 mt-1">Scout Related Links · 國內外童軍相關網站</p>
        </div>
      </div>
    </div>
  </div>
  <div class="max-w-5xl mx-auto px-4 py-10">
    ${links.results.length === 0
      ? `<div class="text-center py-20 text-gray-400">
          <div class="text-5xl mb-4">🔗</div>
          <p class="text-lg">尚無相關連結</p>
          <p class="text-sm mt-1">請至後台管理介面新增</p>
        </div>`
      : categoryBlocks
    }
  </div>
  ${pageFooter(settings)}
`)
})

// ===================== 分組首頁（學期列表）=====================
frontendRoutes.get('/group/:slug', async (c) => {
  const db = c.env.DB
  const slug = c.req.param('slug')

  const group = await db.prepare(`SELECT * FROM scout_groups WHERE slug=? AND is_active=1`).bind(slug).first() as any
  if (!group) return c.notFound()

  const semesters = await db.prepare(`
    SELECT gs.*, COUNT(si.id) as image_count
    FROM group_semesters gs
    LEFT JOIN semester_images si ON si.semester_id = gs.id
    WHERE gs.group_id = ? AND gs.is_published = 1
    GROUP BY gs.id
    ORDER BY gs.display_order ASC, gs.semester DESC
  `).bind(group.id).all()

  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  return c.html(renderGroupPage(group, semesters.results, settings))
})

// ===================== 分組子頁面路由（必須在 :semester 路由之前）=====================

// 組織架構頁（純職稱/說明，不含人名）
frontendRoutes.get('/group/:slug/org', async (c) => {
  const db = c.env.DB
  const slug = c.req.param('slug')
  const group = await db.prepare(`SELECT * FROM scout_groups WHERE slug=? AND is_active=1`).bind(slug).first() as any
  if (!group) return c.notFound()
  const org = await db.prepare(`SELECT * FROM group_org_chart WHERE group_id=?`).bind(group.id).first() as any
  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })
  return c.html(renderSubPage(group, 'org', { org }, settings))
})

// 現任幹部頁
frontendRoutes.get('/group/:slug/cadres', async (c) => {
  const db = c.env.DB
  const slug = c.req.param('slug')
  const group = await db.prepare(`SELECT * FROM scout_groups WHERE slug=? AND is_active=1`).bind(slug).first() as any
  if (!group) return c.notFound()
  const cadres = await db.prepare(`SELECT * FROM group_cadres WHERE group_id=? AND is_current=1 ORDER BY display_order`).bind(group.id).all()
  // 同時載入組織架構（含 PLC/EC 資料）
  const orgChart = await db.prepare(`SELECT * FROM group_org_chart WHERE group_id=?`).bind(group.id).first() as any
  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })
  return c.html(renderCadresPage(group, cadres.results, orgChart, settings))
})

// 歷屆幹部頁
frontendRoutes.get('/group/:slug/past-cadres', async (c) => {
  const db = c.env.DB
  const slug = c.req.param('slug')
  const group = await db.prepare(`SELECT * FROM scout_groups WHERE slug=? AND is_active=1`).bind(slug).first() as any
  if (!group) return c.notFound()
  const cadres = await db.prepare(`SELECT * FROM group_cadres WHERE group_id=? AND is_current=0 ORDER BY year_label DESC, display_order`).bind(group.id).all()
  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })
  return c.html(renderSubPage(group, 'past-cadres', cadres.results, settings))
})

// 歷屆名單頁
frontendRoutes.get('/group/:slug/alumni', async (c) => {
  const db = c.env.DB
  const slug = c.req.param('slug')
  const group = await db.prepare(`SELECT * FROM scout_groups WHERE slug=? AND is_active=1`).bind(slug).first() as any
  if (!group) return c.notFound()
  const alumni = await db.prepare(`SELECT * FROM group_alumni WHERE group_id=? ORDER BY year_label DESC, display_order`).bind(group.id).all()
  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })
  return c.html(renderSubPage(group, 'alumni', alumni.results, settings))
})

// 教練團頁（含服務員 + 指導教練兩區塊）
frontendRoutes.get('/group/:slug/coaches-list', async (c) => {
  const db = c.env.DB
  const slug = c.req.param('slug')
  const group = await db.prepare(`SELECT * FROM scout_groups WHERE slug=? AND is_active=1`).bind(slug).first() as any
  if (!group) return c.notFound()

  // 服務員：從成員名冊中取得 section='服務員' 的有效成員
  const leaders = await db.prepare(`
    SELECT m.id, m.chinese_name, m.english_name, m.role_name, m.rank_level, m.unit_name, m.troop
    FROM members m
    WHERE m.section = '服務員' AND UPPER(m.membership_status) = 'ACTIVE'
    ORDER BY
      CASE m.role_name
        WHEN '團長' THEN 1
        WHEN '副團長' THEN 2
        WHEN '群長' THEN 3
        WHEN '副群長' THEN 4
        ELSE 5
      END,
      m.chinese_name ASC
  `).all()

  // 指導教練：從教練團資料取得 coach_level='指導教練' 的人員
  const instructors = await db.prepare(`
    SELECT cms.id, m.chinese_name, m.english_name, cms.current_stage as coach_level, cms.section_assigned, cms.specialties, cms.year_label, m.id as member_id 
    FROM coach_member_status cms 
    JOIN members m ON m.id = cms.member_id
    WHERE cms.current_stage = '指導教練'
    ORDER BY m.chinese_name ASC
  `).all()

  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })
  return c.html(renderCoachesList(group, leaders.results, instructors.results, settings))
})

// ===================== 學期相片頁 =====================
frontendRoutes.get('/group/:slug/:semester', async (c) => {
  const db = c.env.DB
  const slug = c.req.param('slug')
  const semesterParam = c.req.param('semester')

  const group = await db.prepare(`SELECT * FROM scout_groups WHERE slug=? AND is_active=1`).bind(slug).first() as any
  if (!group) return c.notFound()

  const semester = await db.prepare(`
    SELECT * FROM group_semesters WHERE group_id=? AND semester=? AND is_published=1
  `).bind(group.id, semesterParam).first() as any
  if (!semester) return c.notFound()

  const images = await db.prepare(`
    SELECT * FROM semester_images WHERE semester_id=? ORDER BY display_order ASC
  `).bind(semester.id).all()

  // 取上一筆、下一筆學期（for 翻頁）
  const allSemesters = await db.prepare(`
    SELECT semester FROM group_semesters WHERE group_id=? AND is_published=1 ORDER BY display_order ASC, semester DESC
  `).bind(group.id).all()
  const semList = allSemesters.results.map((s: any) => s.semester)
  const idx = semList.indexOf(semesterParam)
  const prevSem = idx > 0 ? semList[idx - 1] : null
  const nextSem = idx < semList.length - 1 ? semList[idx + 1] : null

  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  return c.html(renderSemesterPage(group, semester, images.results, settings, prevSem, nextSem))
})

// =================== HTML 渲染函式 ===================

function navBar(settings: Record<string, string>, groups: any[] = []) {
  return `
  <nav class="bg-[#1a472a] text-white shadow-lg sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-4 py-3">
      <div class="flex items-center justify-between">
        <a href="/" class="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <span class="text-2xl">⚜️</span>
          <div>
            <div class="font-bold text-base leading-tight">林口康橋圓桌武士童軍團</div>
            <div class="text-xs text-green-200">KCISLK Excalibur Knights Scout Groups</div>
          </div>
        </a>
        
        <!-- 桌面版選單 -->
        <div class="hidden lg:flex items-center gap-4 text-sm">
          <div class="relative group">
            <a href="/#about" class="hover:text-amber-300 transition-colors flex items-center gap-1 py-2">關於我們 ▾</a>
            <div class="absolute left-0 mt-0 w-32 bg-white rounded-md shadow-lg py-1 hidden group-hover:block text-gray-800 border border-gray-100">
              <a href="/about/scout" class="block px-4 py-2 hover:bg-green-50 hover:text-green-700 transition-colors">認識童軍</a>
              <a href="/about/leaders" class="block px-4 py-2 hover:bg-green-50 hover:text-green-700 transition-colors">服務員介紹</a>
            </div>
          </div>
          <a href="/activities" class="hover:text-amber-300 transition-colors">📅 活動報名</a>
          <a href="/honor" class="hover:text-amber-300 transition-colors">🏅 榮譽榜</a>
          <a href="/highlights" class="hover:text-amber-300 transition-colors">📸 精彩回顧</a>
          <a href="/stats" class="hover:text-amber-300 transition-colors">📊 統計資料</a>
          <a href="/links" class="hover:text-amber-300 transition-colors">🔗 相關網頁</a>
          <div class="flex gap-2 ml-2">
            <a href="/member" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">👤 會員入口</a>
            <a id="nav-admin-btn" href="/admin" class="hidden bg-amber-500 hover:bg-amber-400 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">⚙ 後台管理</a>
          </div>
        </div>

        <!-- 手機版選單按鈕與主要入口 (隱藏於桌面版) -->
        <div class="flex lg:hidden items-center gap-2">
          <a href="/member" class="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors">會員入口</a>
          <a id="nav-admin-btn-mobile" href="/admin" class="hidden bg-amber-500 hover:bg-amber-400 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors">後台</a>
          <button id="mobile-menu-btn" class="p-2 ml-1 text-white hover:bg-[#2d6a4f] rounded-lg transition-colors focus:outline-none">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
        </div>
      </div>
      
      <!-- 手機版下拉選單 (預設隱藏) -->
      <div id="mobile-menu" class="hidden lg:hidden mt-3 pb-2 border-t border-[#2d6a4f] pt-3">
        <div class="flex flex-col space-y-3 text-sm">
          <div class="px-2 font-bold text-amber-300">關於我們</div>
          <a href="/about/scout" class="hover:text-amber-300 transition-colors pl-6">認識童軍</a>
          <a href="/about/leaders" class="hover:text-amber-300 transition-colors pl-6">服務員介紹</a>
          <a href="/activities" class="hover:text-amber-300 transition-colors px-2">📅 活動報名</a>
          <a href="/honor" class="hover:text-amber-300 transition-colors px-2">🏅 榮譽榜</a>
          <a href="/highlights" class="hover:text-amber-300 transition-colors px-2">📸 精彩回顧</a>
          <a href="/stats" class="hover:text-amber-300 transition-colors px-2">📊 統計資料</a>
          <a href="/links" class="hover:text-amber-300 transition-colors px-2">🔗 相關網頁</a>
        </div>
      </div>
    </div>
  </nav>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      // 手機版漢堡選單
      const btn = document.getElementById('mobile-menu-btn');
      const menu = document.getElementById('mobile-menu');
      if (btn && menu) {
        btn.addEventListener('click', () => menu.classList.toggle('hidden'));
      }
      // 判斷是否有管理員 session，有才顯示「後台管理」按鈕
      fetch('/api/auth/check-admin', { credentials: 'same-origin' })
        .then(r => r.json())
        .then(data => {
          if (data.isAdmin) {
            const d = document.getElementById('nav-admin-btn');
            const m = document.getElementById('nav-admin-btn-mobile');
            if (d) d.classList.remove('hidden');
            if (m) m.classList.remove('hidden');
          }
        })
        .catch(() => {});
    });
  </script>`
}

function pageHead(title: string) {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap');
    body { font-family: 'Noto Sans TC', sans-serif; }
    .hero-gradient { background: linear-gradient(135deg, #1a472a 0%, #2d6a4f 40%, #1b4332 100%); }
    .lightbox-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.92); z-index:9999; align-items:center; justify-content:center; flex-direction:column; }
    .lightbox-overlay.active { display:flex; }
  </style>
</head>`
}

function pageFooter(settings: Record<string, string>) {
  return `
  <footer class="bg-[#1a472a] text-white py-8 mt-12">
    <div class="max-w-6xl mx-auto px-4 text-center">
      <div class="text-2xl mb-2">⚜️</div>
      <p class="font-bold">${settings.site_title || 'KCISLK 林口康橋圓桌武士童軍團'}</p>
      <p class="text-green-300 text-sm mt-1">${settings.site_subtitle || 'KCISLK Excalibur Knights Scout Groups'}</p>
      <p class="text-green-400 text-xs mt-3">一日童軍，終生童軍 · Once a Scout, Always a Scout</p>
    </div>
  </footer>
</body></html>`
}

// ===================== 分組首頁 =====================
function renderGroupPage(group: any, semesters: any[], settings: Record<string, string>) {
  const groupIcon: Record<string, string> = {
    'scout-troop': '🏕️',
    'senior-scout': '⛺',
    'rover-scout': '🧭',
    'cub-scout': '🐺',
  }
  const icon = groupIcon[group.slug] || '⚜️'

  // 子頁面按鈕（仿原始網站風格）
  const subPageDefs: Record<string, { label: string; path: string; icon: string }[]> = {
    'scout-troop': [
      { label: '童軍團組織', path: 'org', icon: '🏛️' },
      { label: '現任幹部', path: 'cadres', icon: '⭐' },
      { label: '歷屆幹部', path: 'past-cadres', icon: '📜' },
      { label: '歷屆名單', path: 'alumni', icon: '👥' },
    ],
    'senior-scout': [
      { label: '行義團組織架構', path: 'org', icon: '🏛️' },
      { label: '教練團', path: 'coaches-list', icon: '🧢' },
      { label: '行義團現任幹部', path: 'cadres', icon: '⭐' },
      { label: '行義團歷屆幹部', path: 'past-cadres', icon: '📜' },
      { label: '行義團歷屆名單', path: 'alumni', icon: '👥' },
    ],
    'rover-scout': [
      { label: '羅浮群組織', path: 'org', icon: '🏛️' },
      { label: '現任幹部', path: 'cadres', icon: '⭐' },
      { label: '歷屆幹部', path: 'past-cadres', icon: '📜' },
      { label: '歷屆名單', path: 'alumni', icon: '👥' },
    ],
  }
  const subPages = subPageDefs[group.slug] || [
    { label: group.name + '組織', path: 'org', icon: '🏛️' },
    { label: '現任幹部', path: 'cadres', icon: '⭐' },
    { label: '歷屆幹部', path: 'past-cadres', icon: '📜' },
    { label: '歷屆名單', path: 'alumni', icon: '👥' },
  ]
  const subPageButtons = subPages.map(p => `
    <a href="/group/${group.slug}/${p.path}"
      class="flex items-center justify-center gap-3 w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-bold text-lg py-4 px-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
      <span class="text-2xl">${p.icon}</span>
      <span>${p.label}</span>
    </a>
  `).join('')

  const semCards = semesters.length === 0
    ? `<div class="col-span-full text-center py-16 text-gray-400">
        <div class="text-5xl mb-4">📂</div>
        <p>尚無學期資料，請至後台新增。</p>
      </div>`
    : semesters.map((s: any) => {
        const coverHtml = s.cover_image
          ? `<div class="aspect-video bg-gray-100 overflow-hidden">
              <img src="${s.cover_image}" alt="${s.title || s.semester}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.parentElement.innerHTML='<div class=\\'flex items-center justify-center h-full bg-gradient-to-br from-green-50 to-green-100\\'>\\n<span class=\\'text-4xl\\'>📸</span></div>'">
             </div>`
          : `<div class="aspect-video bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
              <span class="text-4xl">📸</span>
             </div>`
        return `
          <a href="/group/${group.slug}/${s.semester}" class="group bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            ${coverHtml}
            <div class="p-4">
              <h3 class="font-bold text-gray-800 text-lg">${s.semester}</h3>
              ${s.title ? `<p class="text-gray-500 text-sm mt-0.5">${s.title}</p>` : ''}
              ${s.description ? `<p class="text-gray-400 text-xs mt-2 line-clamp-2">${s.description}</p>` : ''}
              <div class="mt-3 flex items-center justify-between">
                <span class="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">${s.image_count} 張相片</span>
                <span class="text-green-700 text-sm font-medium group-hover:text-amber-600 transition-colors">查看 →</span>
              </div>
            </div>
          </a>`
      }).join('')

  return `${pageHead(`${group.name} - 林口康橋童軍團`)}
<body class="bg-gray-50">
  ${navBar(settings)}

  <!-- 分組 Hero -->
  <div class="hero-gradient text-white py-14 px-4">
    <div class="max-w-4xl mx-auto">
      <div class="flex items-center gap-2 text-green-300 text-sm mb-4">
        <a href="/" class="hover:text-white transition-colors">首頁</a>
        <span>›</span>
        <span>${group.name}</span>
      </div>
      <div class="flex items-center gap-4">
        <span class="text-5xl">${icon}</span>
        <div>
          <h1 class="text-3xl md:text-4xl font-bold">${group.name}</h1>
          ${group.name_en ? `<p class="text-green-200 text-lg mt-1">${group.name_en}</p>` : ''}
          ${group.grade_range ? `<p class="text-green-300 text-sm mt-1">${group.grade_range}</p>` : ''}
        </div>
      </div>
      ${group.description ? `<p class="mt-4 text-green-100 max-w-2xl">${group.description}</p>` : ''}
    </div>
  </div>

  <div class="max-w-3xl mx-auto px-4 py-10">
    <!-- 子頁面按鈕（仿原始網站）-->
    ${subPageButtons ? `
    <div class="mb-10 space-y-3">
      ${subPageButtons}
    </div>
    <hr class="border-gray-200 mb-10">
    ` : ''}

    <!-- 學期列表 -->
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
        <i class="fas fa-folder-open text-amber-500"></i> 學期相片集
      </h2>
      <span class="text-sm text-gray-400">${semesters.length} 個學期</span>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      ${semCards}
    </div>
  </div>

  ${pageFooter(settings)}
`
}

// ===================== 學期相片頁 =====================
function renderSemesterPage(group: any, semester: any, images: any[], settings: Record<string, string>, prevSem: string | null, nextSem: string | null) {
  const photoGrid = images.length === 0
    ? `<div class="text-center py-20 text-gray-400">
        <div class="text-6xl mb-4">📷</div>
        <p class="text-lg">本學期尚無相片</p>
        <p class="text-sm mt-1">請至後台新增圖片</p>
       </div>`
    : `
      <div class="columns-2 sm:columns-3 md:columns-4 gap-3 space-y-3">
        ${images.map((img: any, i: number) => `
          <div class="break-inside-avoid cursor-pointer overflow-hidden rounded-lg shadow-sm hover:shadow-md transition-shadow"
               onclick="openLightbox(${i})">
            <img
              src="${img.image_url}"
              alt="${img.caption || `相片 ${i + 1}`}"
              class="w-full hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onerror="this.parentElement.style.display='none'">
            ${img.caption ? `<div class="bg-white px-2 py-1.5 text-xs text-gray-600">${img.caption}</div>` : ''}
          </div>
        `).join('')}
      </div>
      <!-- Lightbox -->
      <div class="lightbox-overlay" id="lightbox" onclick="closeLightbox()">
        <button onclick="event.stopPropagation();navLightbox(-1)" class="absolute left-4 top-1/2 -translate-y-1/2 text-white text-4xl hover:text-amber-400 transition-colors px-2">‹</button>
        <button onclick="event.stopPropagation();navLightbox(1)"  class="absolute right-4 top-1/2 -translate-y-1/2 text-white text-4xl hover:text-amber-400 transition-colors px-2">›</button>
        <button onclick="closeLightbox()" class="absolute top-4 right-4 text-white text-2xl hover:text-amber-400 w-10 h-10 flex items-center justify-center rounded-full bg-black/30">✕</button>
        <img id="lightbox-img" src="" class="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl">
        <p id="lightbox-caption" class="text-gray-300 text-sm mt-3"></p>
        <p id="lightbox-counter" class="text-gray-500 text-xs mt-1"></p>
      </div>
      <script>
        const _imgs = ${JSON.stringify(images.map((img: any) => ({ url: img.image_url, caption: img.caption || '' })))};
        let _cur = 0;
        function openLightbox(i) {
          _cur = i; showLightbox();
          document.getElementById('lightbox').classList.add('active');
        }
        function closeLightbox() { document.getElementById('lightbox').classList.remove('active'); }
        function navLightbox(dir) { _cur = (_cur + dir + _imgs.length) % _imgs.length; showLightbox(); }
        function showLightbox() {
          document.getElementById('lightbox-img').src = _imgs[_cur].url;
          document.getElementById('lightbox-caption').textContent = _imgs[_cur].caption;
          document.getElementById('lightbox-counter').textContent = (_cur+1) + ' / ' + _imgs.length;
        }
        document.addEventListener('keydown', e => {
          const lb = document.getElementById('lightbox');
          if (!lb.classList.contains('active')) return;
          if (e.key === 'ArrowLeft') navLightbox(-1);
          if (e.key === 'ArrowRight') navLightbox(1);
          if (e.key === 'Escape') closeLightbox();
        });
      </script>`

  const prevBtn = prevSem
    ? `<a href="/group/${group.slug}/${prevSem}" class="flex items-center gap-2 text-green-700 hover:text-green-900 bg-white border border-green-200 hover:border-green-400 px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-sm hover:shadow">‹ ${prevSem}</a>`
    : `<span></span>`
  const nextBtn = nextSem
    ? `<a href="/group/${group.slug}/${nextSem}" class="flex items-center gap-2 text-green-700 hover:text-green-900 bg-white border border-green-200 hover:border-green-400 px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-sm hover:shadow">${nextSem} ›</a>`
    : `<span></span>`

  return `${pageHead(`${semester.title || semester.semester} - ${group.name} - 林口康橋童軍團`)}
<body class="bg-gray-50">
  ${navBar(settings)}

  <!-- 學期 Hero -->
  <div class="hero-gradient text-white py-12 px-4">
    <div class="max-w-5xl mx-auto">
      <div class="flex items-center gap-2 text-green-300 text-sm mb-4 flex-wrap">
        <a href="/" class="hover:text-white transition-colors">首頁</a>
        <span>›</span>
        <a href="/group/${group.slug}" class="hover:text-white transition-colors">${group.name}</a>
        <span>›</span>
        <span class="text-white">${semester.semester}</span>
      </div>
      <h1 class="text-2xl md:text-3xl font-bold">${semester.title || semester.semester}</h1>
      ${semester.description ? `<p class="text-green-200 mt-2 max-w-2xl">${semester.description}</p>` : ''}
      <p class="text-green-300 text-sm mt-2">${images.length} 張相片</p>
    </div>
  </div>

  <!-- 相片 Grid -->
  <div class="max-w-6xl mx-auto px-4 py-8">
    ${photoGrid}

    <!-- 上下學期翻頁 -->
    <div class="flex justify-between items-center mt-10 pt-6 border-t border-gray-200">
      ${prevBtn}
      <a href="/group/${group.slug}" class="text-gray-500 hover:text-gray-700 text-sm">↑ 返回 ${group.name}</a>
      ${nextBtn}
    </div>
  </div>

  ${pageFooter(settings)}
`
}

// ===================== 首頁 =====================
function renderHomePage(activities: any[], groups: any[], settings: Record<string, string>, announcements: any[], highlights: any[] = []) {
  const categoryLabel: Record<string, string> = {
    general: '一般活動',
    tecc: 'TECC 急救訓練',
    camping: '大露營',
    training: '訓練課程',
    service: '服務活動',
    national_day: '國慶服務活動',
  }
  const categoryColor: Record<string, string> = {
    general: 'bg-blue-100 text-blue-800',
    tecc: 'bg-red-100 text-red-800',
    camping: 'bg-green-100 text-green-800',
    training: 'bg-yellow-100 text-yellow-800',
    service: 'bg-purple-100 text-purple-800',
    national_day: 'bg-indigo-100 text-indigo-800',
  }

  const activitiesHtml = activities.map((act: any) => {
    const imgs = act.images ? act.images.split(',').filter((x: string) => x && !x.includes('placeholder')) : []
    const imgHtml = imgs.length > 0
      ? `<img src="${imgs[0]}" alt="${act.title}" class="w-full h-48 object-cover rounded-lg mb-3" onerror="this.style.display='none'">`
      : ''
    const youtubeHtml = act.youtube_url
      ? `<div class="mt-3 rounded-lg overflow-hidden"><iframe width="100%" height="200" src="https://www.youtube.com/embed/${act.youtube_url}" frameborder="0" allowfullscreen class="rounded-lg"></iframe></div>`
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

  // 分組卡片：可點擊進入分組頁面
  const groupIcon: Record<string, string> = {
    'scout-troop': '🏕️',
    'senior-scout': '⛺',
    'rover-scout': '🧭',
    'cub-scout': '🐺',
  }
  const groupsHtml = groups.map((g: any) => {
    const icon = groupIcon[g.slug] || '⚜️'
    const inner = `
      <div class="text-3xl mb-3">${icon}</div>
      <h3 class="text-lg font-bold text-gray-800">${g.name}</h3>
      <p class="text-amber-600 font-medium text-sm">${g.name_en || ''}</p>
      ${g.grade_range ? `<p class="text-gray-500 text-sm mt-1">${g.grade_range}</p>` : ''}
      ${g.description ? `<p class="text-gray-600 text-sm mt-2">${g.description}</p>` : ''}
      ${g.slug ? `<div class="mt-4"><span class="inline-block bg-green-700 text-white text-xs px-3 py-1.5 rounded-full group-hover:bg-amber-500 transition-colors">查看相片集 →</span></div>` : ''}`

    return g.slug
      ? `<a href="/group/${g.slug}" class="group bg-white rounded-xl shadow-md p-5 text-center hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-t-4 border-amber-500 block">${inner}</a>`
      : `<div class="bg-white rounded-xl shadow-md p-5 text-center border-t-4 border-amber-500">${inner}</div>`
  }).join('')

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

  return `${pageHead(settings.site_title || 'KCISLK 童軍團')}
<body class="bg-gray-50">
  ${navBar(settings, groups)}

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

    <!-- 關於我們（移至最上方，讓訪客第一眼認識童軍團） -->
    <section id="about" class="mb-14">
      <h2 class="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
        <i class="fas fa-info-circle text-[#1a472a]"></i> 關於我們
      </h2>
      <p class="text-gray-500 mb-6">About Us</p>
      <div class="bg-white rounded-xl shadow-md p-8">
        <p class="text-gray-700 leading-relaxed mb-4">${settings.about_text_zh || ''}</p>
        <p class="text-gray-500 leading-relaxed text-sm italic">${settings.about_text_en || ''}</p>
        <div class="mt-6 flex flex-wrap gap-4">
          ${settings.facebook_url ? `
            <a href="${settings.facebook_url}" target="_blank" class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg transition-colors">
              <i class="fab fa-facebook"></i> 追蹤我們的 Facebook
            </a>
          ` : ''}
          ${settings.instagram_url ? `
            <a href="${settings.instagram_url}" target="_blank" class="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:from-pink-600 hover:via-red-600 hover:to-yellow-600 text-white px-5 py-2.5 rounded-lg transition-colors">
              <i class="fab fa-instagram"></i> 追蹤我們的 Instagram
            </a>
          ` : ''}
        </div>
      </div>
    </section>

    <!-- 童軍分組（可點擊） -->
    <section id="groups" class="mb-14">
      <h2 class="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
        <span class="text-[#1a472a]">⚜️</span> 童軍分組
      </h2>
      <p class="text-gray-500 mb-6">點擊進入各分組的相片集</p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        ${groupsHtml || '<p class="text-gray-500 col-span-3">尚無分組資料</p>'}
      </div>
    </section>


    ${announcementsHtml}

    <!-- 活動記錄 -->
    <section id="activities" class="mb-14">
      <h2 class="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
        <i class="fas fa-campground text-[#1a472a]"></i> 活動報名
      </h2>
      <p class="text-gray-500 mb-6">Activities & Events</p>
      ${activities.length === 0
        ? '<div class="text-center py-16 text-gray-400"><div class="text-5xl mb-4">📋</div><p>尚無活動記錄，請至後台新增活動。</p></div>'
        : `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${activitiesHtml}</div>`
      }
    </section>





    <!-- 精彩回顧相冊入口（仿原站） -->
    ${highlights.length > 0 ? `
    <section id="highlights" class="mb-14">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span class="text-[#1a472a]">📸</span> 精彩回顧
          </h2>
          <p class="text-gray-500 mt-1">Highlight Gallery · 歷年珍貴記憶</p>
        </div>
        <a href="/highlights" class="text-green-700 hover:text-green-900 text-sm font-medium flex items-center gap-1 hover:underline transition-colors">
          查看全部 →
        </a>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        ${highlights.slice(0, 6).map((a: any) => {
          const imgs = a.images ? a.images.split(',').filter(Boolean) : []
          const cover = a.cover_image || imgs[0] || ''
          return `
          <a href="/highlights/${a.id}" class="group relative block aspect-[4/3] overflow-hidden rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 bg-gray-200">
            ${cover
              ? `<img src="${cover}" alt="${a.title}" loading="lazy"
                   class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                   onerror="this.parentElement.style.background='#d1fae5'">`
              : `<div class="w-full h-full bg-gradient-to-br from-green-100 to-emerald-200 flex items-center justify-center text-4xl">📸</div>`
            }
            <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent"></div>
            <div class="absolute bottom-0 left-0 right-0 p-3">
              <p class="text-white font-bold text-sm leading-tight">${a.title}</p>
              ${a.date_display ? `<p class="text-gray-300 text-xs mt-0.5">${a.date_display}</p>` : ''}
            </div>
          </a>`
        }).join('')}
      </div>
      <div class="text-center mt-6">
        <a href="/highlights" class="inline-flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white px-6 py-2.5 rounded-full font-medium transition-colors shadow-md hover:shadow-lg">
          📸 查看所有精彩回顧
        </a>
      </div>
    </section>` : ''}
  </div>

  <footer class="bg-[#1a472a] text-white py-8 mt-8">
    <div class="max-w-6xl mx-auto px-4 text-center">
      <div class="text-2xl mb-2">⚜️</div>
      <p class="font-bold">${settings.site_title || 'KCISLK 林口康橋圓桌武士童軍團'}</p>
      <p class="text-green-300 text-sm mt-1">${settings.site_subtitle || 'KCISLK Excalibur Knights Scout Groups'}</p>
      <p class="text-green-400 text-xs mt-3">一日童軍，終生童軍 · Once a Scout, Always a Scout</p>
    </div>
  </footer>
</body></html>`
}

// ===================== 子頁面通用渲染（組織/幹部/名單）=====================
function renderSubPage(group: any, pageType: string, data: any, settings: Record<string, string>) {
  const groupIcon: Record<string, string> = {
    'scout-troop': '🏕️',
    'senior-scout': '⛺',
    'rover-scout': '🧭',
    'cub-scout': '🐺',
  }
  const icon = groupIcon[group.slug] || '⚜️'

  const pageTitleMap: Record<string, string> = {
    'org': '組織架構',
    'cadres': '現任幹部',
    'past-cadres': '歷屆幹部',
    'alumni': '歷屆名單',
  }
  const pageTitle = pageTitleMap[pageType] || pageType

  const subNavDefs: Record<string, { label: string; path: string }[]> = {
    'scout-troop': [
      { label: '童軍團組織', path: 'org' },
      { label: '現任幹部', path: 'cadres' },
      { label: '歷屆幹部', path: 'past-cadres' },
      { label: '歷屆名單', path: 'alumni' },
    ],
    'senior-scout': [
      { label: '行義團組織架構', path: 'org' },
      { label: '教練團', path: 'coaches-list' },
      { label: '行義團現任幹部', path: 'cadres' },
      { label: '行義團歷屆幹部', path: 'past-cadres' },
      { label: '行義團歷屆名單', path: 'alumni' },
    ],
    'rover-scout': [
      { label: '羅浮群組織', path: 'org' },
      { label: '現任幹部', path: 'cadres' },
      { label: '歷屆幹部', path: 'past-cadres' },
      { label: '歷屆名單', path: 'alumni' },
    ],
  }
  const subNav = subNavDefs[group.slug] || []
  const subNavHtml = subNav.map(n => {
    const isActive = n.path === pageType
    return `<a href="/group/${group.slug}/${n.path}"
      class="${isActive
        ? 'bg-green-700 text-white font-bold'
        : 'bg-white text-green-800 hover:bg-green-50'} border border-green-200 px-4 py-2 rounded-lg text-sm transition-colors">${n.label}</a>`
  }).join('')

  let contentHtml = ''

  if (pageType === 'org') {
    // data 格式：{ org }（純職稱頁，不含人名）
    const orgPageData = data as any
    const org = orgPageData?.org || orgPageData

    // 解析 org JSON
    let orgData: any = {}
    if (org?.content) {
      try { orgData = JSON.parse(org.content) } catch {}
    }
    const orgIntro: string         = orgData.intro || ''
    const orgGroupLeaders: any[]   = orgData.groupLeaders || []
    const orgUnitLeaders: any[]    = orgData.unitLeaders || orgData.leaders || []
    const orgPatrols: any[]        = orgData.patrols || []
    const orgComms: any[]          = orgData.committees || []

    // ── 純職稱卡片（無人名）──
    const roleTitleCard = (role: string, desc: string, icon: string, colorText: string, borderClass: string, bgClass: string) =>
      `<div class="rounded-2xl border-2 ${borderClass} ${bgClass} shadow-sm p-5 text-center hover:shadow-md transition-shadow min-w-[140px] max-w-[220px]">
        <div class="text-3xl mb-2">${icon}</div>
        <div class="font-bold ${colorText} text-base mb-1">${role}</div>
        ${desc ? `<p class="text-xs text-gray-500 leading-relaxed mt-1">${desc}</p>` : ''}
      </div>`

    // 第1層卡片
    let layer1Html = ''
    if (orgGroupLeaders.length > 0) {
      layer1Html = `<div class="flex flex-wrap justify-center gap-4">${orgGroupLeaders.map((l: any) => roleTitleCard(l.role || '', l.desc || '', '🏛️', 'text-purple-800', 'border-purple-300', 'bg-purple-50')).join('')}</div>`
    } else {
      layer1Html = `<div class="flex justify-center"><div class="rounded-2xl border-2 border-purple-200 bg-purple-50 shadow-sm p-5 text-center">
        <div class="text-3xl mb-2">🏛️</div>
        <div class="font-bold text-purple-800 text-base">團長 / 副團長</div>
        <p class="text-xs text-gray-400 mt-1">全團最高領導</p>
      </div></div>`
    }

    // 第2層卡片
    let layer2Html = ''
    if (orgUnitLeaders.length > 0) {
      layer2Html = `<div class="flex flex-wrap justify-center gap-4">${orgUnitLeaders.map((l: any) => roleTitleCard(l.role || '', l.desc || '', '🌿', 'text-green-800', 'border-green-300', 'bg-green-50')).join('')}</div>`
    }

    // 第3層 PLC 小隊卡片（純職稱/說明，不含人名）
    const patrolCardsHtml = orgPatrols.length > 0
      ? orgPatrols.map((p: any) => `
        <div class="bg-white rounded-2xl border-2 border-teal-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div class="h-20 overflow-hidden bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
            ${(p.photo_url || p.image_url)
              ? `<img src="${p.photo_url || p.image_url}" alt="${p.name}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<span class=\\'text-3xl\\'>🏕️</span>'">`
              : `<span class="text-3xl">🏕️</span>`}
          </div>
          <div class="p-3 text-center">
            <div class="font-bold text-gray-800 text-sm mb-1">${p.name || ''}</div>
            ${p.desc ? `<p class="text-xs text-gray-500">${p.desc}</p>` : ''}
          </div>
        </div>`).join('')
      : ''

    // 第4層 EC 委員會卡片（純職稱/說明，不含人名）
    const committeeCardsHtml = orgComms.length > 0
      ? orgComms.map((c: any) => `
        <div class="bg-white rounded-2xl border-2 border-blue-200 shadow-sm p-4 text-center hover:shadow-md transition-shadow">
          <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-xl mx-auto mb-2">⚙️</div>
          <div class="font-bold text-gray-800 text-sm mb-1">${c.name || ''}</div>
          ${c.desc ? `<p class="text-xs text-gray-500 leading-relaxed mb-2">${c.desc}</p>` : ''}
          ${c.roles && c.roles.length ? `<div class="flex flex-wrap justify-center gap-1 mt-2">${c.roles.map((r: string) => `<span class="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">${r}</span>`).join('')}</div>` : ''}
        </div>`).join('')
      : ''

    const hasContent = orgGroupLeaders.length > 0 || orgUnitLeaders.length > 0 ||
      patrolCardsHtml || committeeCardsHtml || orgIntro || org?.image_url

    contentHtml = `
      <!-- 整體說明 -->
      ${orgIntro ? `<div class="bg-white rounded-xl shadow-md p-6 mb-6 border-l-4 border-green-400">
        <p class="text-gray-700 leading-relaxed">${orgIntro.replace(/\n/g,'<br>')}</p>
      </div>` : ''}

      <!-- 組織架構圖片（若有） -->
      ${org?.image_url ? `<div class="mb-8 text-center">
        <img src="${org.image_url}" alt="組織架構圖" class="max-w-full mx-auto rounded-xl shadow-md">
      </div>` : ''}

      <!-- ── 四層架構圖 ── -->
      <div class="bg-white rounded-2xl shadow-md p-6 sm:p-8 mb-8">
        <h2 class="text-xl font-bold text-gray-800 mb-8 text-center flex items-center justify-center gap-2">
          <span>🏛️</span> 組織架構
        </h2>

        <!-- 第1層：全團領導職位 -->
        <div class="mb-4">
          <div class="text-center text-xs font-semibold text-purple-500 uppercase tracking-widest mb-4">第1層 · 全團領導 · Group Leaders</div>
          ${layer1Html}
        </div>

        <!-- 連接線 -->
        <div class="flex justify-center my-4"><div class="w-px h-8 bg-gray-300"></div></div>

        <!-- 第2層：聯隊領導職位 -->
        ${layer2Html ? `
        <div class="mb-4">
          <div class="text-center text-xs font-semibold text-green-600 uppercase tracking-widest mb-4">第2層 · 聯隊領導 · Unit Leaders</div>
          ${layer2Html}
        </div>
        <div class="flex justify-center gap-24 sm:gap-40 my-4">
          <div class="w-px h-8 bg-gray-300"></div>
          <div class="w-px h-8 bg-gray-300"></div>
        </div>
        ` : '<div class="flex justify-center gap-24 sm:gap-40 my-4"><div class="w-px h-8 bg-gray-300"></div><div class="w-px h-8 bg-gray-300"></div></div>'}

        <!-- 第3/4層標題：PLC + EC 並排 -->
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-teal-50 border-2 border-teal-200 rounded-xl p-3 text-center">
            <div class="font-bold text-teal-800 text-sm">第3層 · 小隊長議會 PLC</div>
            <div class="text-xs text-teal-500 mt-0.5">Patrol Leaders' Council</div>
          </div>
          <div class="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 text-center">
            <div class="font-bold text-blue-800 text-sm">第4層 · 執行委員會 EC</div>
            <div class="text-xs text-blue-400 mt-0.5">Executive Committee</div>
          </div>
        </div>
      </div>

      <!-- PLC 小隊區塊 -->
      ${patrolCardsHtml ? `
      <div class="mb-8">
        <div class="flex items-center mb-5">
          <div class="flex-1 h-px bg-teal-200"></div>
          <div class="text-center px-4">
            <h3 class="text-lg font-bold text-teal-800">⚔️ PLC 小隊長議會</h3>
            <p class="text-xs text-teal-500 mt-0.5">Patrol Leaders Council</p>
          </div>
          <div class="flex-1 h-px bg-teal-200"></div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          ${patrolCardsHtml}
        </div>
      </div>` : ''}

      <!-- EC 委員會區塊 -->
      ${committeeCardsHtml ? `
      <div class="mb-8">
        <div class="flex items-center mb-5">
          <div class="flex-1 h-px bg-blue-200"></div>
          <div class="text-center px-4">
            <h3 class="text-lg font-bold text-blue-800">⚙️ 執行委員會 EC</h3>
            <p class="text-xs text-blue-400 mt-0.5">Executive Committee</p>
          </div>
          <div class="flex-1 h-px bg-blue-200"></div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          ${committeeCardsHtml}
        </div>
      </div>` : ''}

      ${!hasContent ? `
      <div class="text-center py-20 text-gray-400">
        <div class="text-5xl mb-4">🏛️</div>
        <p class="text-lg">組織架構資料設定中</p>
        <p class="text-sm mt-1 text-gray-300">請至後台「組織架構設定」新增職稱</p>
      </div>` : ''}
    `

  } else if (pageType === 'cadres' || pageType === 'past-cadres') {
    const cadres = data as any[]
    if (!cadres || cadres.length === 0) {
      contentHtml = `<div class="text-center py-20 text-gray-400">
        <div class="text-5xl mb-4">⭐</div>
        <p class="text-lg">尚無${pageType === 'cadres' ? '現任' : '歷屆'}幹部資料</p>
      </div>`
    } else if (pageType === 'cadres') {
      const cards = cadres.map((c: any) => `
        <div class="bg-white rounded-xl shadow-sm border border-green-100 p-5 flex items-start gap-4">
          ${c.photo_url
            ? `<img src="${c.photo_url}" alt="${c.chinese_name}" class="w-16 h-16 rounded-full object-cover flex-shrink-0 border-2 border-green-200" onerror="this.style.display='none'">`
            : `<div class="w-16 h-16 rounded-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center flex-shrink-0 text-2xl">⭐</div>`
          }
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-gray-800 text-lg">${c.chinese_name}</span>
              ${c.english_name ? `<span class="text-gray-400 text-sm">${c.english_name}</span>` : ''}
            </div>
            <span class="inline-block mt-1 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">${c.role}</span>
            ${c.notes ? `<p class="text-gray-500 text-sm mt-2">${c.notes}</p>` : ''}
          </div>
        </div>
      `).join('')
      contentHtml = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${cards}</div>`
    } else {
      const byYear: Record<string, any[]> = {}
      cadres.forEach((c: any) => {
        if (!byYear[c.year_label]) byYear[c.year_label] = []
        byYear[c.year_label].push(c)
      })
      const yearBlocks = Object.entries(byYear).sort((a, b) => b[0].localeCompare(a[0])).map(([year, members]) => {
        const memberCards = members.map((c: any) => `
          <div class="bg-white rounded-lg border border-gray-100 p-3 flex items-center gap-3">
            ${c.photo_url
              ? `<img src="${c.photo_url}" alt="${c.chinese_name}" class="w-10 h-10 rounded-full object-cover flex-shrink-0" onerror="this.style.display='none'">`
              : `<div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">👤</div>`
            }
            <div>
              <div class="font-medium text-gray-800 text-sm">${c.chinese_name}</div>
              <div class="text-xs text-green-600">${c.role}</div>
            </div>
          </div>
        `).join('')
        return `
          <div class="mb-6">
            <h3 class="text-lg font-bold text-green-800 mb-3 flex items-center gap-2">
              <span class="w-8 h-8 bg-green-700 text-white rounded-full flex items-center justify-center text-sm font-bold">${year.slice(-2)}</span>
              第 ${parseInt(year) - 107} 屆 (第 ${parseInt(year) - 107} 屆 (民國 ${year} 學年度))
            </h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">${memberCards}</div>
          </div>`
      }).join('')
      contentHtml = yearBlocks
    }

  } else if (pageType === 'alumni') {
    const alumni = data as any[]
    if (!alumni || alumni.length === 0) {
      contentHtml = `<div class="text-center py-20 text-gray-400">
        <div class="text-5xl mb-4">👥</div>
        <p class="text-lg">尚無歷屆名單資料</p>
      </div>`
    } else {
      const byYear: Record<string, any[]> = {}
      alumni.forEach((a: any) => {
        if (!byYear[a.year_label]) byYear[a.year_label] = []
        byYear[a.year_label].push(a)
      })
      const yearBlocks = Object.entries(byYear).sort((a, b) => b[0].localeCompare(a[0])).map(([year, members]) => {
        const byUnit: Record<string, any[]> = {}
        members.forEach((m: any) => {
          const unit = m.unit_name || '未分隊'
          if (!byUnit[unit]) byUnit[unit] = []
          byUnit[unit].push(m)
        })
        const unitBlocks = Object.entries(byUnit).map(([unit, unitMembers]) => {
          const chips = unitMembers.map((m: any) => `
            <div class="inline-flex items-center gap-1.5 bg-white border border-green-100 rounded-lg px-3 py-1.5">
              <span class="font-medium text-gray-800 text-sm">${m.member_name}</span>
              ${m.role_name ? `<span class="text-xs text-green-600">${m.role_name}</span>` : ''}
              ${m.rank_level ? `<span class="text-xs text-gray-400">${m.rank_level}</span>` : ''}
            </div>
          `).join('')
          return `
            <div class="mb-3">
              <h4 class="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1">
                <span class="text-green-500">▸</span> ${unit}
              </h4>
              <div class="flex flex-wrap gap-2">${chips}</div>
            </div>`
        }).join('')
        return `
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
            <h3 class="text-lg font-bold text-green-800 mb-4 flex items-center gap-2 pb-3 border-b border-green-100">
              <span class="w-8 h-8 bg-green-700 text-white rounded-full flex items-center justify-center text-sm font-bold">${year.slice(-2)}</span>
              民國 ${year} 學年度
              <span class="text-sm font-normal text-gray-400 ml-auto">${members.length} 位成員</span>
            </h3>
            ${unitBlocks}
          </div>`
      }).join('')
      contentHtml = yearBlocks
    }
  }

  return `${pageHead(`${pageTitle} - ${group.name} - 林口康橋童軍團`)}
<body class="bg-gray-50">
  ${navBar(settings)}
  <div class="hero-gradient text-white py-12 px-4">
    <div class="max-w-4xl mx-auto">
      <div class="flex items-center gap-2 text-green-300 text-sm mb-4 flex-wrap">
        <a href="/" class="hover:text-white transition-colors">首頁</a>
        <span>›</span>
        <a href="/group/${group.slug}" class="hover:text-white transition-colors">${group.name}</a>
        <span>›</span>
        <span class="text-white">${pageTitle}</span>
      </div>
      <div class="flex items-center gap-4">
        <span class="text-4xl">${icon}</span>
        <div>
          <h1 class="text-2xl md:text-3xl font-bold">${group.name} · ${pageTitle}</h1>
          ${group.name_en ? `<p class="text-green-200 mt-1">${group.name_en}</p>` : ''}
        </div>
      </div>
    </div>
  </div>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <div class="flex flex-wrap gap-2 mb-8">
      <a href="/group/${group.slug}" class="bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 px-4 py-2 rounded-lg text-sm transition-colors">← 相片集</a>
      ${subNavHtml}
    </div>
    ${contentHtml}
  </div>
  ${pageFooter(settings)}
`
}

// ===================== 現任幹部頁（PLC + EC 排版）=====================
function renderCadresPage(group: any, cadres: any[], orgChart: any, settings: Record<string, string>) {
  // 解析 org chart JSON（職稱架構定義）
  let orgGroupLeaders: any[] = []  // 第1層定義
  let orgUnitLeaders: any[]  = []  // 第2層定義
  let patrols: any[]         = []  // 第3層小隊定義
  let committees: any[]      = []  // 第4層委員會定義
  if (orgChart?.content) {
    try {
      const parsed = JSON.parse(orgChart.content)
      orgGroupLeaders = parsed.groupLeaders || []
      orgUnitLeaders  = parsed.unitLeaders || parsed.leaders || []
      patrols         = parsed.patrols || []
      committees      = parsed.committees || []
    } catch {}
  }

  // 從 org JSON 建立職稱集合（與後台 cadres 頁同步邏輯）
  const glRoles = orgGroupLeaders.map((l: any) => l.role).filter(Boolean) as string[]
  const ulRoles = orgUnitLeaders.map((l: any) => l.role).filter(Boolean) as string[]
  const fallbackGLRoles = ['童軍團長','團長','副團長','群長','副群長','隊長','副隊長']
  const fallbackULRoles = ['聯隊長','副聯隊長']
  const effectiveGLRoles = glRoles.length > 0 ? glRoles : fallbackGLRoles
  const effectiveULRoles = ulRoles.length > 0 ? ulRoles : fallbackULRoles

  // EC role map：從 org committees 的 roles 陣列建立，fallback 到預設
  const effectiveEcRoleMap: Record<string, string> = {}
  committees.forEach((comm: any) => {
    if (comm.roles && comm.roles.length) {
      comm.roles.forEach((r: string) => { if (r) effectiveEcRoleMap[r] = comm.name })
    }
  })
  const fallbackEcRoleMap: Record<string, string> = {
    '展演組長':'展演組','副展演長':'展演組','展演長':'展演組',
    '活動組長':'活動組','副活動長':'活動組','活動長':'活動組',
    '行政組長':'行政組','副行政長':'行政組','行政長':'行政組',
    '器材組長':'器材組','副器材長':'器材組','器材長':'器材組',
    '公關組長':'公關組','副公關長':'公關組','公關長':'公關組',
    '攝影組長':'攝影組','副攝影長':'攝影組','攝影長':'攝影組',
  }
  const ecRoleMap = Object.keys(effectiveEcRoleMap).length > 0 ? effectiveEcRoleMap : fallbackEcRoleMap

  // 學年度
  const yearLabel = cadres.length > 0 ? (cadres[0].year_label || '') : ''
  const schoolTitle = yearLabel ? `民國 ${yearLabel} 學年度` : ''

  // Sub nav
  const subNavItems: any[] = ({
    '1': [
      { label: '現任幹部', path: 'cadres' },
      { label: '歷屆幹部', path: 'past-cadres' },
      { label: '歷屆名單', path: 'alumni' },
      { label: '組織架構', path: 'org' },
    ],
    '2': [
      { label: '行義團現任幹部', path: 'cadres' },
      { label: '行義團歷屆幹部', path: 'past-cadres' },
      { label: '歷屆名單', path: 'alumni' },
      { label: '組織架構', path: 'org' },
    ],
    '3': [
      { label: '現任幹部', path: 'cadres' },
      { label: '歷屆幹部', path: 'past-cadres' },
      { label: '歷屆名單', path: 'alumni' },
      { label: '組織架構', path: 'org' },
    ],
  } as Record<string, any[]>)[String(group.id)] || []

  const subNavHtml = subNavItems.length > 0 ? `
  <div class="bg-white border-b sticky top-0 z-30 shadow-sm">
    <div class="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto py-2">
      ${subNavItems.map((item: any) => `
        <a href="/group/${group.slug}/${item.path}"
           class="whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${item.path === 'cadres' ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-100'}">
          ${item.label}
        </a>`).join('')}
    </div>
  </div>` : ''

  // 輔助：幹部人物卡片（圓形照片 + 姓名 + 職稱）
  const personCard = (c: any, size: 'lg'|'md'|'sm' = 'md') => {
    const sizeMap = {
      lg: { wrap: 'w-28 h-28', emoji: 'text-5xl', nameSize: 'text-base' },
      md: { wrap: 'w-20 h-20', emoji: 'text-3xl', nameSize: 'text-sm' },
      sm: { wrap: 'w-16 h-16', emoji: 'text-2xl', nameSize: 'text-xs' },
    }[size]
    return `
    <div class="flex flex-col items-center gap-1.5 text-center">
      <div class="${sizeMap.wrap} rounded-full overflow-hidden bg-green-50 border-2 border-green-300 flex items-center justify-center shadow-md flex-shrink-0">
        ${c.photo_url
          ? `<img src="${c.photo_url}" alt="${c.chinese_name}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<span class=\\'${sizeMap.emoji}\\'>⭐</span>'">`
          : `<span class="${sizeMap.emoji}">⭐</span>`}
      </div>
      <div>
        <div class="inline-block text-xs font-semibold text-green-800 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full mb-0.5">${c.role}</div>
        <div class="font-bold text-gray-800 ${sizeMap.nameSize}">${c.chinese_name}</div>
        ${c.english_name && c.english_name !== 'null' ? `<div class="text-gray-400 text-xs">${c.english_name}</div>` : ''}
      </div>
    </div>`
  }

  // ─────────────────────────────────────────
  // 第1層：全團領導
  // ─────────────────────────────────────────
  const groupLeaderCadres = cadres.filter((c: any) => effectiveGLRoles.includes(c.role))
  const groupLeaderHtml = groupLeaderCadres.length > 0 ? `
  <div class="mb-2">
    <div class="text-center text-xs font-semibold text-purple-500 uppercase tracking-widest mb-4">全團領導 · Group Leaders</div>
    <div class="flex flex-wrap justify-center gap-6 sm:gap-10 mb-4">
      ${groupLeaderCadres.map((c: any) => personCard(c, 'lg')).join('')}
    </div>
  </div>` : (orgGroupLeaders.length > 0 ? `
  <div class="mb-2">
    <div class="text-center text-xs font-semibold text-purple-500 uppercase tracking-widest mb-4">全團領導 · Group Leaders</div>
    <div class="flex flex-wrap justify-center gap-6 sm:gap-10 mb-4">
      ${orgGroupLeaders.map((l: any) => `
      <div class="flex flex-col items-center gap-1.5 text-center">
        <div class="w-28 h-28 rounded-full overflow-hidden bg-purple-50 border-2 border-purple-200 flex items-center justify-center shadow-md">
          <span class="text-5xl">⭐</span>
        </div>
        <div>
          <div class="inline-block text-xs font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full mb-0.5">${l.role}</div>
          <div class="font-bold text-gray-400 text-base">（待填入）</div>
        </div>
      </div>`).join('')}
    </div>
  </div>` : '')

  // ─────────────────────────────────────────
  // 第2層：聯隊領導
  // ─────────────────────────────────────────
  const unitLeaderCadres = cadres.filter((c: any) => effectiveULRoles.includes(c.role))
  const unitLeaderHtml = unitLeaderCadres.length > 0 ? `
  <div class="mb-2">
    <div class="text-center text-xs font-semibold text-green-600 uppercase tracking-widest mb-4">聯隊領導 · Unit Leaders</div>
    <div class="flex flex-wrap justify-center gap-6 sm:gap-10 mb-4">
      ${unitLeaderCadres.map((c: any) => personCard(c, 'lg')).join('')}
    </div>
  </div>` : (orgUnitLeaders.length > 0 ? `
  <div class="mb-2">
    <div class="text-center text-xs font-semibold text-green-600 uppercase tracking-widest mb-4">聯隊領導 · Unit Leaders</div>
    <div class="flex flex-wrap justify-center gap-6 sm:gap-10 mb-4">
      ${orgUnitLeaders.map((l: any) => `
      <div class="flex flex-col items-center gap-1.5 text-center">
        <div class="w-28 h-28 rounded-full overflow-hidden bg-green-50 border-2 border-green-300 flex items-center justify-center shadow-md">
          <span class="text-5xl">⭐</span>
        </div>
        <div>
          <div class="inline-block text-xs font-semibold text-green-800 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full mb-0.5">${l.role}</div>
          <div class="font-bold text-gray-400 text-base">（待填入）</div>
        </div>
      </div>`).join('')}
    </div>
  </div>` : '')

  // ─────────────────────────────────────────
  // PLC 區塊（第3層）—— 小隊卡片從 org patrols + group_cadres 合併顯示
  // ─────────────────────────────────────────
  const patrolCadres = cadres.filter((c: any) => ['小隊長','副小隊長'].includes(c.role))
  const patrolCardsHtml = (() => {
    if (patrols.length > 0) {
      return `
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
        ${patrols.map((patrol: any) => {
          const members = patrolCadres.filter((c: any) => c.notes === patrol.name)
          const photo = patrol.photo_url || patrol.image_url || ''
          return `
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
            <div class="h-36 overflow-hidden bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
              ${photo
                ? `<img src="${photo}" alt="${patrol.name}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<span class=\\'text-6xl\\'>🏕️</span>'">`
                : `<span class="text-6xl">🏕️</span>`}
            </div>
            <div class="p-4 text-center">
              <h4 class="font-bold text-gray-800 text-sm mb-2">${patrol.name || ''}</h4>
              ${patrol.desc ? `<p class="text-xs text-gray-400 mb-2">${patrol.desc}</p>` : ''}
              <div class="space-y-1">
                ${members.length > 0 ? members.map((c: any) => `
                <div class="flex items-center justify-center gap-1.5 text-xs">
                  <span class="bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">${c.role}</span>
                  <span class="font-medium text-gray-700">${c.chinese_name}</span>
                </div>`).join('') : '<div class="text-xs text-gray-300">尚無成員</div>'}
              </div>
            </div>
          </div>`
        }).join('')}
      </div>`
    }
    // 無 org 設定但有小隊幹部，按 notes 分組
    if (patrolCadres.length > 0) {
      const byUnit: Record<string, any[]> = {}
      patrolCadres.forEach((c: any) => {
        const key = c.notes || '未分配小隊'
        if (!byUnit[key]) byUnit[key] = []
        byUnit[key].push(c)
      })
      return `
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
        ${Object.entries(byUnit).map(([unitName, members]) => `
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
            <div class="h-36 bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
              <span class="text-6xl">🏕️</span>
            </div>
            <div class="p-4 text-center">
              <h4 class="font-bold text-gray-800 text-sm mb-3">${unitName}</h4>
              ${members.map((m: any) => `
              <div class="flex items-center justify-center gap-1.5 text-xs mb-1.5">
                <span class="bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">${m.role}</span>
                <span class="font-medium text-gray-700">${m.chinese_name}</span>
              </div>`).join('')}
            </div>
          </div>`).join('')}
      </div>`
    }
    return ''
  })()

  const hasPLC = !!(groupLeaderHtml || unitLeaderHtml || patrolCardsHtml)

  // ─────────────────────────────────────────
  // EC 執行委員會 區塊
  // ─────────────────────────────────────────
  const ecCadres = cadres.filter((c: any) => ecRoleMap[c.role] || (committees.length > 0 && committees.some((oc: any) => oc.name && c.notes === oc.name)))
  const ecGroups: Record<string, any[]> = {}
  ecCadres.forEach((c: any) => {
    const k = ecRoleMap[c.role] || c.notes || '其他'
    if (!ecGroups[k]) ecGroups[k] = []
    ecGroups[k].push(c)
  })

  const ecCardsHtml = (() => {
    if (committees.length > 0) {
      return `
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
        ${committees.map((comm: any) => {
          const photo = comm.photo_url || comm.image_url || ''
          const members = ecGroups[comm.name] || []
          return `
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
            <div class="h-32 overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
              ${photo
                ? `<img src="${photo}" alt="${comm.name}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<span class=\\'text-5xl\\'>⚙️</span>'">`
                : `<span class="text-5xl">⚙️</span>`}
            </div>
            <div class="p-4 text-center">
              <h4 class="font-bold text-gray-800 text-sm mb-3">${comm.name || ''}</h4>
              ${comm.desc ? `<p class="text-xs text-gray-400 mb-2">${comm.desc}</p>` : ''}
              <div class="space-y-1.5">
                ${members.length > 0 ? members.map((c: any) => `
                <div class="flex items-center justify-center gap-1.5 text-xs">
                  <span class="bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">${c.role}</span>
                  <span class="font-medium text-gray-700">${c.chinese_name}</span>
                </div>`).join('') : '<div class="text-xs text-gray-300">尚無成員</div>'}
              </div>
            </div>
          </div>`
        }).join('')}
      </div>`
    }
    // 無 org 設定但有 EC 幹部，從 ecRoleMap 分組
    if (Object.keys(ecGroups).length > 0) {
      return `
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
        ${Object.entries(ecGroups).map(([groupName, members]) => `
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
            <div class="h-32 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
              <span class="text-5xl">⚙️</span>
            </div>
            <div class="p-4 text-center">
              <h4 class="font-bold text-gray-800 text-sm mb-3">${groupName}</h4>
              ${members.map((m: any) => `
              <div class="flex items-center justify-center gap-1.5 text-xs mb-1.5">
                <span class="bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">${m.role}</span>
                <span class="font-medium text-gray-700">${m.chinese_name}</span>
              </div>`).join('')}
            </div>
          </div>`).join('')}
      </div>`
    }
    return ''
  })()

  const hasEC = ecCardsHtml !== ''

  // ─────────────────────────────────────────
  // 剩餘幹部（服務員等未分類）
  // ─────────────────────────────────────────
  const usedRoles = new Set([
    ...effectiveGLRoles, ...effectiveULRoles,
    '小隊長', '副小隊長',
    ...Object.keys(ecRoleMap)
  ])
  const remainingCadres = cadres.filter((c: any) =>
    !usedRoles.has(c.role) && !ecCadres.includes(c)
  )

  const remainingHtml = remainingCadres.length > 0 ? `
  <div class="mb-10">
    <div class="flex items-center mb-6">
      <div class="flex-1 h-px bg-green-200"></div>
      <h3 class="text-lg font-bold text-green-800 px-5 flex items-center gap-2">
        <span>🎖️</span> 服務員 / 其他幹部
      </h3>
      <div class="flex-1 h-px bg-green-200"></div>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      ${remainingCadres.map((c: any) => `
        <div class="bg-white rounded-2xl border border-green-100 shadow-sm p-4 flex flex-col items-center text-center hover:shadow-md transition-all duration-200">
          <div class="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-green-100 to-teal-100 flex items-center justify-center mb-3 border-2 border-green-200 shadow-sm">
            ${c.photo_url
              ? `<img src="${c.photo_url}" alt="${c.chinese_name}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<span class=\\'text-xl\\'>⭐</span>'">`
              : `<span class="text-xl">⭐</span>`}
          </div>
          <div class="text-xs font-semibold text-green-800 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full mb-1">${c.role}</div>
          <p class="font-bold text-gray-800 text-sm">${c.chinese_name}</p>
          ${c.english_name && c.english_name !== 'null' ? `<p class="text-xs text-gray-400 mt-0.5">${c.english_name}</p>` : ''}
        </div>`).join('')}
    </div>
  </div>` : ''

  const isEmpty = cadres.length === 0

  // ─────────────────────────────────────────
  // 幹部組織架構圖（最上方摘要圖）
  // ─────────────────────────────────────────
  const orgChartHtml = (groupLeaderHtml || unitLeaderHtml) ? `
  <div class="bg-white rounded-2xl shadow-md p-6 sm:p-8 mb-10">
    <h2 class="text-xl font-bold text-gray-800 mb-8 text-center flex items-center justify-center gap-2">
      <span>🏛️</span> 幹部組織
    </h2>

    <!-- 第1層 -->
    ${groupLeaderHtml || ''}

    <!-- 連接線 -->
    ${(groupLeaderHtml && unitLeaderHtml) ? '<div class="flex justify-center my-4"><div class="w-px h-8 bg-gray-300"></div></div>' : ''}

    <!-- 第2層 -->
    ${unitLeaderHtml || ''}

    <!-- 連接線到 PLC + EC -->
    ${unitLeaderHtml ? `
    <div class="flex justify-center gap-24 sm:gap-40 my-4">
      <div class="w-px h-8 bg-gray-300"></div>
      <div class="w-px h-8 bg-gray-300"></div>
    </div>
    <!-- 第3/4層標題 -->
    <div class="grid grid-cols-2 gap-4">
      <div class="bg-teal-50 border-2 border-teal-200 rounded-xl p-3 text-center">
        <div class="font-bold text-teal-800 text-sm">PLC 小隊長議會</div>
        <div class="text-xs text-teal-500 mt-0.5">Patrol Leaders' Council</div>
      </div>
      <div class="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 text-center">
        <div class="font-bold text-blue-800 text-sm">執行委員會 EC</div>
        <div class="text-xs text-blue-400 mt-0.5">Executive Committee</div>
      </div>
    </div>` : ''}
  </div>` : ''

  const contentHtml = `
    ${isEmpty ? `
    <div class="text-center py-20 text-gray-400">
      <div class="text-6xl mb-4">⭐</div>
      <p class="text-lg font-medium">尚無現任幹部資料</p>
      <p class="text-sm mt-2">請至後台新增幹部或組織架構資料</p>
    </div>` : ''}

    ${orgChartHtml}

    ${hasPLC ? `
    <div class="mb-12">
      <!-- PLC 標題 -->
      <div class="flex items-center mb-8">
        <div class="flex-1 h-px bg-teal-200"></div>
        <div class="text-center px-6">
          <h3 class="text-xl font-bold text-teal-800">⚔️ PLC 小隊長議會</h3>
          <p class="text-xs text-teal-500 mt-0.5">Patrol Leaders Council</p>
        </div>
        <div class="flex-1 h-px bg-teal-200"></div>
      </div>
      ${patrolCardsHtml || '<div class="text-center text-gray-300 py-4 text-sm">尚無小隊資料</div>'}
    </div>` : ''}

    ${hasEC ? `
    <div class="mb-12">
      <!-- EC 標題 -->
      <div class="flex items-center mb-8">
        <div class="flex-1 h-px bg-blue-200"></div>
        <div class="text-center px-6">
          <h3 class="text-xl font-bold text-blue-800">⚙️ 執行委員會 EC</h3>
          <p class="text-xs text-blue-400 mt-0.5">Executive Committee</p>
        </div>
        <div class="flex-1 h-px bg-blue-200"></div>
      </div>
      ${ecCardsHtml}
    </div>` : ''}

    ${remainingHtml}
  `

  const breadcrumb = `
    <div class="flex items-center gap-2 text-green-300 text-sm mb-4 flex-wrap">
      <a href="/" class="hover:text-white transition-colors">首頁</a>
      <span>›</span>
      <a href="/group/${group.slug}" class="hover:text-white transition-colors">${group.name}</a>
      <span>›</span>
      <span class="text-white">現任幹部</span>
    </div>`

  return `${pageHead(`現任幹部 - ${group.name} - 林口康橋童軍團`)}
<body class="bg-gray-50">
  ${navBar(settings)}
  <div class="hero-gradient text-white py-12 px-4">
    <div class="max-w-5xl mx-auto">
      ${breadcrumb}
      <div class="flex items-center gap-4">
        <span class="text-4xl">⭐</span>
        <div>
          <h1 class="text-2xl md:text-3xl font-bold">${group.name} · 現任幹部名單</h1>
          ${schoolTitle ? `<p class="text-green-200 mt-1">${schoolTitle}</p>` : ''}
        </div>
      </div>
    </div>
  </div>
  ${subNavHtml}
  <div class="max-w-5xl mx-auto px-4 py-10">
    ${contentHtml}
  </div>
  ${pageFooter(settings)}
</body></html>`
}

// ===================== 教練團頁（行義團）=====================
function renderCoachesList(group: any, leaders: any[], instructors: any[], settings: Record<string, string>) {
  const subNavHtml = `
    <a href="/group/${group.slug}" class="bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 px-4 py-2 rounded-lg text-sm transition-colors">← 相片集</a>
    <a href="/group/${group.slug}/org" class="bg-white text-green-800 hover:bg-green-50 border border-green-200 px-4 py-2 rounded-lg text-sm transition-colors">${group.name}組織架構</a>
    <a href="/group/${group.slug}/coaches-list" class="bg-green-700 text-white font-bold border border-green-700 px-4 py-2 rounded-lg text-sm">教練團</a>
    <a href="/group/${group.slug}/cadres" class="bg-white text-green-800 hover:bg-green-50 border border-green-200 px-4 py-2 rounded-lg text-sm transition-colors">${group.name}現任幹部</a>
    <a href="/group/${group.slug}/past-cadres" class="bg-white text-green-800 hover:bg-green-50 border border-green-200 px-4 py-2 rounded-lg text-sm transition-colors">${group.name}歷屆幹部</a>
    <a href="/group/${group.slug}/alumni" class="bg-white text-green-800 hover:bg-green-50 border border-green-200 px-4 py-2 rounded-lg text-sm transition-colors">${group.name}歷屆名單</a>
  `

  // ===== 服務員區塊 =====
  const roleOrder: Record<string, number> = { '團長': 1, '副團長': 2, '群長': 3, '副群長': 4 }
  const leaderRoleBadge: Record<string, string> = {
    '團長': 'bg-amber-100 text-amber-800 border border-amber-200',
    '副團長': 'bg-orange-100 text-orange-800 border border-orange-200',
    '群長': 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    '副群長': 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  }

  const leaderCards = leaders.length === 0
    ? `<p class="text-gray-400 text-sm py-4">尚無服務員資料，請至後台「服務員管理」新增。</p>`
    : leaders.map((m: any) => {
        const roleName = m.role_name || '服務員'
        const badge = leaderRoleBadge[roleName] || 'bg-gray-100 text-gray-600 border border-gray-200'
        return `
          <div class="bg-white rounded-xl shadow-sm border border-amber-100 p-5 flex items-center gap-4">
            <div class="w-16 h-16 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center flex-shrink-0 text-2xl">🎖️</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-bold text-gray-800 text-base">${m.chinese_name}</span>
                ${m.english_name ? `<span class="text-gray-400 text-xs">${m.english_name}</span>` : ''}
              </div>
              <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge}">${roleName}</span>
                ${m.rank_level ? `<span class="text-gray-400 text-xs">${m.rank_level}</span>` : ''}
              </div>
              ${m.unit_name || m.troop ? `<p class="text-gray-400 text-xs mt-1">${m.unit_name || m.troop}</p>` : ''}
            </div>
          </div>
        `
      }).join('')

  // ===== 指導教練區塊 =====
  const instructorCards = instructors.length === 0
    ? `<p class="text-gray-400 text-sm py-4">尚無指導教練資料，請至後台「教練團」新增。</p>`
    : instructors.map((c: any) => `
        <div class="bg-white rounded-xl shadow-sm border border-purple-100 p-5 flex items-center gap-4">
          ${c.photo_url
            ? `<img src="${c.photo_url}" alt="${c.chinese_name}" class="w-16 h-16 rounded-full object-cover flex-shrink-0 border-2 border-purple-200" onerror="this.style.display='none'">`
            : `<div class="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center flex-shrink-0 text-2xl">🏫</div>`
          }
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-gray-800 text-base">${c.chinese_name}</span>
              ${c.english_name ? `<span class="text-gray-400 text-xs">${c.english_name}</span>` : ''}
            </div>
            <div class="flex items-center gap-2 mt-1.5 flex-wrap">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">指導教練</span>
              ${c.section_assigned && c.section_assigned !== '未指定' ? `<span class="text-gray-400 text-xs">${c.section_assigned}</span>` : ''}
            </div>
            ${c.specialties ? `<p class="text-gray-500 text-xs mt-1">專長：${c.specialties}</p>` : ''}
            ${c.notes ? `<p class="text-gray-400 text-xs mt-0.5">${c.notes}</p>` : ''}
          </div>
        </div>
      `).join('')

  return `${pageHead(`教練團 - ${group.name} - 林口康橋童軍團`)}
<body class="bg-gray-50">
  ${navBar(settings)}
  <div class="hero-gradient text-white py-12 px-4">
    <div class="max-w-4xl mx-auto">
      <div class="flex items-center gap-2 text-green-300 text-sm mb-4 flex-wrap">
        <a href="/" class="hover:text-white transition-colors">首頁</a>
        <span>›</span>
        <a href="/group/${group.slug}" class="hover:text-white transition-colors">${group.name}</a>
        <span>›</span>
        <span class="text-white">教練團</span>
      </div>
      <div class="flex items-center gap-4">
        <span class="text-4xl">⛺</span>
        <div>
          <h1 class="text-2xl md:text-3xl font-bold">${group.name} · 教練團</h1>
          ${group.name_en ? `<p class="text-green-200 mt-1">${group.name_en}</p>` : ''}
        </div>
      </div>
    </div>
  </div>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <div class="flex flex-wrap gap-2 mb-8">
      ${subNavHtml}
    </div>

    <!-- 服務員區塊 -->
    <section class="mb-12">
      <div class="flex items-center gap-3 mb-5">
        <div class="w-1 h-8 bg-amber-500 rounded-full"></div>
        <div>
          <h2 class="text-xl font-bold text-gray-800">🎖️ 服務員</h2>
          <p class="text-gray-400 text-sm">Scout Leaders · 帶領學員成長的夥伴</p>
        </div>
        <span class="ml-auto text-sm text-amber-600 font-medium bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">${leaders.length} 位</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${leaderCards}
      </div>
    </section>

    <!-- 指導教練區塊 -->
    <section class="mb-12">
      <div class="flex items-center gap-3 mb-5">
        <div class="w-1 h-8 bg-purple-500 rounded-full"></div>
        <div>
          <h2 class="text-xl font-bold text-gray-800">🏫 指導教練</h2>
          <p class="text-gray-400 text-sm">Instructor Coaches · 提供專業指導與訓練</p>
        </div>
        <span class="ml-auto text-sm text-purple-600 font-medium bg-purple-50 border border-purple-200 px-3 py-1 rounded-full">${instructors.length} 位</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        ${instructorCards}
      </div>
    </section>
  </div>
  ${pageFooter(settings)}
`
}


// ===================== 認識童軍 / 服務員介紹 =====================
frontendRoutes.get('/about/scout', async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })
  
  return c.html(`${pageHead('認識童軍 - 林口康橋童軍團')}
<body class="bg-gray-50 font-sans">
  ${navBar(settings)}
  <div class="max-w-4xl mx-auto px-4 py-10 min-h-[60vh]">
    <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">認識童軍</h1>
    <div class="bg-white rounded-xl shadow-md p-8 prose max-w-none text-gray-700 leading-relaxed">
      ${settings.about_scout_content || '<p class="text-gray-500 text-center">內容建置中...</p>'}
    </div>
  </div>
  ${pageFooter(settings)}
</body></html>`)
})

frontendRoutes.get('/about/leaders', async (c) => {
  const db = c.env.DB
  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })
  
  return c.html(`${pageHead('服務員介紹 - 林口康橋童軍團')}
<body class="bg-gray-50 font-sans">
  ${navBar(settings)}
  <div class="max-w-4xl mx-auto px-4 py-10 min-h-[60vh]">
    <h1 class="text-3xl font-bold text-gray-800 mb-6 text-center">服務員介紹</h1>
    <div class="bg-white rounded-xl shadow-md p-8 prose max-w-none text-gray-700 leading-relaxed">
      ${settings.about_leaders_content || '<p class="text-gray-500 text-center">內容建置中...</p>'}
    </div>
  </div>
  ${pageFooter(settings)}
</body></html>`)
})

