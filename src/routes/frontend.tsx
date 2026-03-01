import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

export const frontendRoutes = new Hono<{ Bindings: Bindings }>()

// ===================== 首頁 =====================
frontendRoutes.get('/', async (c) => {
  const db = c.env.DB

  const activities = await db.prepare(`
    SELECT a.*, GROUP_CONCAT(ai.image_url) as images
    FROM activities a
    LEFT JOIN activity_images ai ON ai.activity_id = a.id
    WHERE a.is_published = 1
    GROUP BY a.id
    ORDER BY a.display_order ASC, a.activity_date DESC
    LIMIT 20
  `).all()

  const groups = await db.prepare(`
    SELECT * FROM scout_groups WHERE is_active = 1 ORDER BY display_order ASC
  `).all()

  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  const announcements = await db.prepare(`
    SELECT * FROM announcements WHERE is_active = 1 ORDER BY created_at DESC LIMIT 5
  `).all()

  const html = renderHomePage(activities.results, groups.results, settings, announcements.results)
  return c.html(html)
})

// ===================== 榮譽榜（公開）=====================
frontendRoutes.get('/honor', async (c) => {
  const db = c.env.DB

  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  // 取得所有進程記錄，按類型分組
  const rankRecords = await db.prepare(`
    SELECT pr.*, m.chinese_name, m.section
    FROM progress_records pr
    JOIN members m ON m.id = pr.member_id
    WHERE pr.record_type = 'rank'
    ORDER BY pr.year_label DESC, pr.award_name, m.chinese_name
  `).all()

  const awardRecords = await db.prepare(`
    SELECT pr.*, m.chinese_name, m.section
    FROM progress_records pr
    JOIN members m ON m.id = pr.member_id
    WHERE pr.record_type IN ('achievement', 'award')
    ORDER BY pr.year_label DESC, pr.award_name, m.chinese_name
  `).all()

  // 按獎項名稱分組
  const grouped: Record<string, any[]> = {}
  rankRecords.results.forEach((r: any) => {
    if (!grouped[r.award_name]) grouped[r.award_name] = []
    grouped[r.award_name].push(r)
  })

  const awardGrouped: Record<string, any[]> = {}
  awardRecords.results.forEach((r: any) => {
    if (!awardGrouped[r.award_name]) awardGrouped[r.award_name] = []
    awardGrouped[r.award_name].push(r)
  })

  const rankOrder = ['初級童軍','中級童軍','高級童軍','獅級童軍','長城童軍','國花童軍','見習羅浮','授銜羅浮','服務羅浮']
  const rankCards = rankOrder.filter(r => grouped[r]?.length > 0).map(rankName => {
    const members = grouped[rankName]
    const memberChips = members.map(m => `
      <div class="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-green-100">
        <span class="text-green-700 font-medium text-sm">${m.chinese_name}</span>
        <span class="text-xs text-gray-400">${m.section}</span>
        ${m.year_label ? `<span class="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded">${m.year_label}年</span>` : ''}
      </div>
    `).join('')
    return `
      <div class="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
        <h3 class="font-bold text-green-800 text-lg mb-3 flex items-center gap-2">
          🏅 ${rankName}
          <span class="text-sm font-normal text-green-600 bg-white px-2 py-0.5 rounded-full">${members.length} 位</span>
        </h3>
        <div class="flex flex-wrap gap-2">${memberChips}</div>
      </div>
    `
  }).join('')

  const awardCards = Object.entries(awardGrouped).map(([awardName, members]) => {
    const memberChips = members.map((m: any) => `
      <div class="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-amber-100">
        <span class="text-amber-700 font-medium text-sm">${m.chinese_name}</span>
        <span class="text-xs text-gray-400">${m.section}</span>
        ${m.year_label ? `<span class="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">${m.year_label}年</span>` : ''}
      </div>
    `).join('')
    return `
      <div class="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-5">
        <h3 class="font-bold text-amber-800 text-lg mb-3 flex items-center gap-2">
          🌟 ${awardName}
          <span class="text-sm font-normal text-amber-600 bg-white px-2 py-0.5 rounded-full">${(members as any[]).length} 位</span>
        </h3>
        <div class="flex flex-wrap gap-2">${memberChips}</div>
      </div>
    `
  }).join('')

  return c.html(`${pageHead('榮譽榜 - 林口康橋童軍團')}
<body class="bg-gray-50">
  ${navBar(settings)}
  <div class="hero-gradient text-white py-14 px-4">
    <div class="max-w-5xl mx-auto text-center">
      <h1 class="text-3xl md:text-4xl font-bold mb-3">🏅 童軍榮譽榜</h1>
      <p class="text-green-200">Honor Roll · 記錄每一位童軍的成長與成就</p>
    </div>
  </div>
  <div class="max-w-5xl mx-auto px-4 py-10">
    ${rankCards || awardCards ? `
      <h2 class="text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
        <span class="text-green-700">📈</span> 晉級記錄
      </h2>
      <div class="grid md:grid-cols-2 gap-4 mb-10">
        ${rankCards || '<p class="text-gray-400 col-span-2 py-4">尚無晉級記錄</p>'}
      </div>
      ${awardCards ? `
        <h2 class="text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
          <span class="text-amber-600">🌟</span> 榮譽與成就
        </h2>
        <div class="grid md:grid-cols-2 gap-4">
          ${awardCards}
        </div>
      ` : ''}
    ` : '<div class="text-center py-20 text-gray-400">尚無榮譽記錄</div>'}
  </div>
  <footer class="bg-[#1a472a] text-white py-8 mt-8">
    <div class="max-w-6xl mx-auto px-4 text-center">
      <div class="text-2xl mb-2">⚜️</div>
      <p class="font-bold">${settings.site_title || 'KCISLK 林口康橋圓桌武士童軍團'}</p>
      <a href="/" class="text-green-300 hover:text-white text-sm mt-2 inline-block">← 返回首頁</a>
    </div>
  </footer>
</body></html>`)
})

// ===================== 教練團總覽頁（公開）=====================
frontendRoutes.get('/coaches', async (c) => {
  const db = c.env.DB

  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  const coaches = await db.prepare(`
    SELECT cm.*, sg.name as group_name, sg.slug as group_slug
    FROM coach_members cm
    LEFT JOIN scout_groups sg ON sg.id = (
      CASE cm.section_assigned
        WHEN '童軍' THEN (SELECT id FROM scout_groups WHERE slug='scout-troop' LIMIT 1)
        WHEN '行義童軍' THEN (SELECT id FROM scout_groups WHERE slug='senior-scout' LIMIT 1)
        WHEN '羅浮童軍' THEN (SELECT id FROM scout_groups WHERE slug='rover-scout' LIMIT 1)
        ELSE NULL
      END
    )
    ORDER BY cm.year_label DESC, cm.coach_level, cm.chinese_name
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

  // 各組人數
  const sectionCounts = await db.prepare(`
    SELECT section, COUNT(*) as count
    FROM members
    WHERE membership_status = 'ACTIVE'
    GROUP BY section
    ORDER BY count DESC
  `).all()

  const totalMembers = (sectionCounts.results as any[]).reduce((sum: number, r: any) => sum + r.count, 0)

  // 各組晉級統計
  const rankStats = await db.prepare(`
    SELECT m.section, pr.award_name, COUNT(*) as count
    FROM progress_records pr
    JOIN members m ON m.id = pr.member_id
    WHERE pr.record_type = 'rank'
    GROUP BY m.section, pr.award_name
    ORDER BY m.section, count DESC
  `).all()

  // 近期進程記錄（最新 15 筆）
  const recentProgress = await db.prepare(`
    SELECT pr.*, m.chinese_name, m.section
    FROM progress_records pr
    JOIN members m ON m.id = pr.member_id
    ORDER BY pr.awarded_at DESC
    LIMIT 15
  `).all()

  // 出席場次統計（最近 6 場）
  const recentSessions = await db.prepare(`
    SELECT
      s.id, s.title, s.date, s.section,
      COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present_count,
      COUNT(ar.id) as total_count
    FROM attendance_sessions s
    LEFT JOIN attendance_records ar ON ar.session_id = s.id
    GROUP BY s.id
    ORDER BY s.date DESC
    LIMIT 6
  `).all()

  // 教練人數
  const coachCount = await db.prepare(`SELECT COUNT(*) as count FROM coach_members`).first() as any

  const sectionIcons: Record<string, string> = {
    '童軍': '🏕️', '行義童軍': '⛺', '羅浮童軍': '🧭',
    '服務員': '🎖️', '幼童軍': '🌱', '稚齡童軍': '🌟'
  }
  const sectionColors: Record<string, string> = {
    '童軍': 'from-green-500 to-emerald-600',
    '行義童軍': 'from-blue-500 to-blue-700',
    '羅浮童軍': 'from-purple-500 to-purple-700',
    '服務員': 'from-amber-500 to-amber-700',
    '幼童軍': 'from-pink-400 to-rose-500',
    '稚齡童軍': 'from-yellow-400 to-orange-400',
  }

  const memberCards = (sectionCounts.results as any[]).map((row: any) => `
    <div class="bg-gradient-to-br ${sectionColors[row.section] || 'from-gray-400 to-gray-600'} text-white rounded-2xl p-6 shadow-lg">
      <div class="flex items-center justify-between mb-3">
        <span class="text-3xl">${sectionIcons[row.section] || '⚜️'}</span>
        <span class="text-4xl font-bold">${row.count}</span>
      </div>
      <p class="font-semibold text-base opacity-90">${row.section}</p>
      <p class="text-xs opacity-70 mt-0.5">${Math.round(row.count / totalMembers * 100)}% 的成員</p>
    </div>
  `).join('')

  // 出席率圖表資料
  const sessionBars = (recentSessions.results as any[]).reverse().map((s: any) => {
    const rate = s.total_count > 0 ? Math.round(s.present_count / s.total_count * 100) : 0
    const barColor = rate >= 80 ? 'bg-green-500' : rate >= 60 ? 'bg-amber-500' : 'bg-red-400'
    const sectionLabel: Record<string, string> = { junior: '童軍', senior: '行義', rover: '羅浮', all: '全體' }
    return `
    <div class="flex flex-col items-center gap-1">
      <span class="text-xs font-bold text-gray-700">${rate}%</span>
      <div class="w-10 ${barColor} rounded-t-md transition-all" style="height:${Math.max(rate * 1.2, 8)}px"></div>
      <div class="text-center">
        <div class="text-xs text-gray-500 w-12 truncate" title="${s.title}">${s.title.substring(0,4)}</div>
        <div class="text-xs text-gray-400">${sectionLabel[s.section] || s.section}</div>
      </div>
    </div>`
  }).join('')

  // 晉級統計
  const rankGrouped: Record<string, Record<string, number>> = {}
  ;(rankStats.results as any[]).forEach((r: any) => {
    if (!rankGrouped[r.section]) rankGrouped[r.section] = {}
    rankGrouped[r.section][r.award_name] = r.count
  })

  const rankTable = Object.entries(rankGrouped).map(([section, awards]) => {
    const rows = Object.entries(awards).map(([award, cnt]) =>
      `<tr class="border-b border-gray-50 last:border-0">
        <td class="py-2 pr-4 text-sm text-gray-700">${award}</td>
        <td class="py-2 text-sm font-bold text-green-700 text-right">${cnt} 位</td>
      </tr>`
    ).join('')
    return `
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 class="font-bold text-gray-800 mb-3 flex items-center gap-2">
        ${sectionIcons[section] || '⚜️'} ${section}
      </h3>
      <table class="w-full">${rows}</table>
    </div>`
  }).join('')

  // 近期進程
  const progressList = (recentProgress.results as any[]).map((p: any) => {
    const typeLabel: Record<string, string> = { rank: '晉級', badge: '徽章', achievement: '成就', award: '獎項' }
    const typeBg: Record<string, string> = { rank: 'bg-green-100 text-green-700', badge: 'bg-blue-100 text-blue-700', achievement: 'bg-amber-100 text-amber-700', award: 'bg-purple-100 text-purple-700' }
    return `
    <div class="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeBg[p.record_type] || 'bg-gray-100 text-gray-600'} flex-shrink-0">
        ${typeLabel[p.record_type] || p.record_type}
      </span>
      <div class="flex-1 min-w-0">
        <span class="font-medium text-gray-800 text-sm">${p.chinese_name}</span>
        <span class="text-gray-400 text-xs ml-1">${p.section}</span>
        <span class="text-gray-600 text-sm ml-2">${p.award_name}</span>
      </div>
      <span class="text-gray-400 text-xs flex-shrink-0">${p.year_label || ''}</span>
    </div>`
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
  <div class="max-w-5xl mx-auto px-4 py-10">

    <!-- 成員總數 -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8 flex items-center justify-between flex-wrap gap-4">
      <div>
        <p class="text-gray-500 text-sm">在籍成員總數</p>
        <p class="text-5xl font-bold text-green-700">${totalMembers}</p>
        <p class="text-gray-400 text-sm mt-1">Active Members</p>
      </div>
      <div class="text-center">
        <p class="text-gray-500 text-sm">教練團人數</p>
        <p class="text-4xl font-bold text-blue-700">${coachCount?.count || 0}</p>
        <p class="text-gray-400 text-sm mt-1">Coaches</p>
      </div>
      <div class="text-center">
        <p class="text-gray-500 text-sm">近期出席場次</p>
        <p class="text-4xl font-bold text-amber-600">${recentSessions.results.length}</p>
        <p class="text-gray-400 text-sm mt-1">Recent Sessions</p>
      </div>
    </div>

    <!-- 各組人數卡片 -->
    <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
      <span class="text-green-600">👥</span> 各組在籍人數
    </h2>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
      ${memberCards || '<p class="text-gray-400 col-span-3">尚無成員資料</p>'}
    </div>

    <!-- 出席率長條圖 -->
    ${recentSessions.results.length > 0 ? `
    <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
      <span class="text-blue-600">📅</span> 近期出席率
    </h2>
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-10">
      <div class="flex items-end gap-4 justify-center min-h-[140px]">
        ${sessionBars}
      </div>
      <div class="flex items-center gap-4 mt-4 justify-center text-xs text-gray-500">
        <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-green-500 inline-block"></span>≥80%</span>
        <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-amber-500 inline-block"></span>60–79%</span>
        <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-red-400 inline-block"></span>&lt;60%</span>
      </div>
    </div>` : ''}

    <!-- 晉級統計 -->
    ${rankTable ? `
    <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
      <span class="text-amber-600">🏅</span> 晉級統計
    </h2>
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
      ${rankTable}
    </div>` : ''}

    <!-- 近期進程 -->
    ${progressList ? `
    <h2 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
      <span class="text-purple-600">📈</span> 近期進程記錄
    </h2>
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      ${progressList}
    </div>` : ''}

  </div>
  ${pageFooter(settings)}
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

// 組織架構頁
frontendRoutes.get('/group/:slug/org', async (c) => {
  const db = c.env.DB
  const slug = c.req.param('slug')
  const group = await db.prepare(`SELECT * FROM scout_groups WHERE slug=? AND is_active=1`).bind(slug).first() as any
  if (!group) return c.notFound()
  const org = await db.prepare(`SELECT * FROM group_org_chart WHERE group_id=?`).bind(group.id).first() as any
  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })
  return c.html(renderSubPage(group, 'org', org, settings))
})

// 現任幹部頁
frontendRoutes.get('/group/:slug/cadres', async (c) => {
  const db = c.env.DB
  const slug = c.req.param('slug')
  const group = await db.prepare(`SELECT * FROM scout_groups WHERE slug=? AND is_active=1`).bind(slug).first() as any
  if (!group) return c.notFound()
  const cadres = await db.prepare(`SELECT * FROM group_cadres WHERE group_id=? AND is_current=1 ORDER BY display_order`).bind(group.id).all()
  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })
  return c.html(renderSubPage(group, 'cadres', cadres.results, settings))
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

// 教練團頁（行義團專用）
frontendRoutes.get('/group/:slug/coaches-list', async (c) => {
  const db = c.env.DB
  const slug = c.req.param('slug')
  const group = await db.prepare(`SELECT * FROM scout_groups WHERE slug=? AND is_active=1`).bind(slug).first() as any
  if (!group) return c.notFound()
  const coaches = await db.prepare(`
    SELECT * FROM coach_members WHERE section_assigned=? OR section_assigned IS NULL ORDER BY year_label DESC, chinese_name ASC
  `).bind(group.name).all()
  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })
  return c.html(renderCoachesList(group, coaches.results, settings))
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
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <a href="/" class="flex items-center gap-3 hover:opacity-90 transition-opacity">
        <span class="text-2xl">⚜️</span>
        <div>
          <div class="font-bold text-base leading-tight">林口康橋圓桌武士童軍團</div>
          <div class="text-xs text-green-200">KCISLK Excalibur Knights Scout Groups</div>
        </div>
      </a>
      <div class="flex items-center gap-4 text-sm">
        <a href="/#groups" class="hover:text-amber-300 transition-colors hidden md:inline">分組</a>
        <a href="/#activities" class="hover:text-amber-300 transition-colors hidden md:inline">活動</a>
        <a href="/honor" class="hover:text-amber-300 transition-colors hidden md:inline">🏅 榮譽榜</a>
        <a href="/coaches" class="hover:text-amber-300 transition-colors hidden md:inline">🧢 教練團</a>
        <a href="/stats" class="hover:text-amber-300 transition-colors hidden md:inline">📊 統計</a>
        <a href="/attendance" class="hover:text-amber-300 transition-colors hidden md:inline">📅 出席</a>
        <a href="/#about" class="hover:text-amber-300 transition-colors hidden md:inline">關於我們</a>
        <a href="/admin" class="bg-amber-500 hover:bg-amber-400 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">⚙ 後台管理</a>
      </div>
    </div>
  </nav>`
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
  const subPages = subPageDefs[group.slug] || []
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
    ${announcementsHtml}

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
    </section>
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
    const org = data as any
    if (!org) {
      contentHtml = `<div class="text-center py-20 text-gray-400">
        <div class="text-5xl mb-4">🏛️</div>
        <p class="text-lg">尚無組織架構資料</p>
        <p class="text-sm mt-1 text-gray-300">請至後台管理介面新增</p>
      </div>`
    } else {
      contentHtml = `
        <div class="bg-white rounded-xl shadow-md p-8">
          ${org.image_url ? `
            <div class="mb-6 text-center">
              <img src="${org.image_url}" alt="組織架構圖" class="max-w-full mx-auto rounded-lg shadow-md">
            </div>
          ` : ''}
          ${org.content ? `
            <div class="prose max-w-none text-gray-700 leading-relaxed">
              ${org.content}
            </div>
          ` : '<p class="text-gray-400 text-center py-8">尚無說明內容</p>'}
        </div>`
    }

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
              民國 ${year} 學年度
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

// ===================== 教練團頁（行義團）=====================
function renderCoachesList(group: any, coaches: any[], settings: Record<string, string>) {
  const subNavHtml = `
    <a href="/group/${group.slug}" class="bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 px-4 py-2 rounded-lg text-sm transition-colors">← 相片集</a>
    <a href="/group/${group.slug}/org" class="bg-white text-green-800 hover:bg-green-50 border border-green-200 px-4 py-2 rounded-lg text-sm transition-colors">行義團組織架構</a>
    <a href="/group/${group.slug}/coaches-list" class="bg-green-700 text-white font-bold border border-green-700 px-4 py-2 rounded-lg text-sm">教練團</a>
    <a href="/group/${group.slug}/cadres" class="bg-white text-green-800 hover:bg-green-50 border border-green-200 px-4 py-2 rounded-lg text-sm transition-colors">行義團現任幹部</a>
    <a href="/group/${group.slug}/past-cadres" class="bg-white text-green-800 hover:bg-green-50 border border-green-200 px-4 py-2 rounded-lg text-sm transition-colors">行義團歷屆幹部</a>
    <a href="/group/${group.slug}/alumni" class="bg-white text-green-800 hover:bg-green-50 border border-green-200 px-4 py-2 rounded-lg text-sm transition-colors">行義團歷屆名單</a>
  `
  let contentHtml = ''
  if (!coaches || coaches.length === 0) {
    contentHtml = `<div class="text-center py-20 text-gray-400">
      <div class="text-5xl mb-4">🧢</div>
      <p class="text-lg">尚無教練團資料</p>
      <p class="text-sm mt-1 text-gray-300">請至後台管理介面新增</p>
    </div>`
  } else {
    const byYear: Record<string, any[]> = {}
    coaches.forEach((c: any) => {
      const y = c.year_label || '未知年度'
      if (!byYear[y]) byYear[y] = []
      byYear[y].push(c)
    })
    const yearBlocks = Object.entries(byYear).sort((a, b) => b[0].localeCompare(a[0])).map(([year, members]) => {
      const cards = members.map((c: any) => `
        <div class="bg-white rounded-xl shadow-sm border border-blue-100 p-5 flex items-start gap-4">
          ${c.photo_url
            ? `<img src="${c.photo_url}" alt="${c.chinese_name}" class="w-16 h-16 rounded-full object-cover flex-shrink-0 border-2 border-blue-200" onerror="this.style.display='none'">`
            : `<div class="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0 text-2xl">🧢</div>`
          }
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-gray-800 text-lg">${c.chinese_name}</span>
              ${c.english_name ? `<span class="text-gray-400 text-sm">${c.english_name}</span>` : ''}
            </div>
            <span class="inline-block mt-1 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full">${c.coach_level || '教練'}</span>
            ${c.specialties ? `<p class="text-gray-500 text-sm mt-1">專長：${c.specialties}</p>` : ''}
            ${c.notes ? `<p class="text-gray-400 text-xs mt-1">${c.notes}</p>` : ''}
          </div>
        </div>
      `).join('')
      return `
        <div class="mb-8">
          <h3 class="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
            <span class="w-8 h-8 bg-blue-700 text-white rounded-full flex items-center justify-center text-sm font-bold">${year.slice(-2)}</span>
            民國 ${year} 學年度教練團
            <span class="text-sm font-normal text-gray-400 ml-auto">${members.length} 位教練</span>
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${cards}</div>
        </div>`
    }).join('')
    contentHtml = yearBlocks
  }

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
    ${contentHtml}
  </div>
  ${pageFooter(settings)}
`
}
