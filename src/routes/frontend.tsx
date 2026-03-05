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
    WHERE a.is_published = 1 AND (a.show_in_highlights = 0 OR a.show_in_highlights IS NULL)
    GROUP BY a.id
    ORDER BY a.display_order ASC, a.activity_date DESC
    LIMIT 6
  `).all()

  const highlights = await db.prepare(`
    SELECT a.*, GROUP_CONCAT(ai.image_url) as images
    FROM activities a
    LEFT JOIN activity_images ai ON ai.activity_id = a.id
    WHERE a.is_published = 1 AND a.show_in_highlights = 1
    GROUP BY a.id
    ORDER BY a.display_order ASC, a.activity_date DESC
    LIMIT 6
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

  const html = renderHomePage(activities.results, groups.results, settings, announcements.results, highlights.results)
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

  // 取得公告的榮譽小隊記錄（最新20筆）
  const honorPatrolRecords = await db.prepare(`
    SELECT hp.*, ats.title as session_title, ats.date as session_date
    FROM honor_patrol_records hp
    JOIN attendance_sessions ats ON ats.id = hp.session_id
    WHERE hp.announced = 1
    ORDER BY hp.announced_at DESC
    LIMIT 20
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
        ${m.year_label ? '<span class="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded">' + m.year_label + '年</span>' : ''}
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
        ${m.year_label ? '<span class="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">' + m.year_label + '年</span>' : ''}
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

  // 榮譽小隊公告卡片
  const honorPatrolCards = (honorPatrolRecords.results as any[]).map((h: any) => {
    const sectionLabel: Record<string,string> = {junior:'童軍',senior:'行義童軍',rover:'羅浮童軍',all:'全體'}
    return `
      <div class="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-300 rounded-xl p-5">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-2xl">🏆</span>
          <div>
            <div class="font-bold text-amber-900 text-lg">${h.patrol_name}</div>
            <div class="text-xs text-amber-600">${sectionLabel[h.section] || h.section}${h.year_label ? ' · ' + h.year_label + '學年' : ''}</div>
          </div>
        </div>
        ${h.reason ? '<p class="text-sm text-gray-600 mt-1">' + h.reason + '</p>' : ''}
        <div class="text-xs text-gray-400 mt-2">場次：${h.session_title} · ${h.session_date}</div>
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
    ${honorPatrolCards ? `
      <h2 class="text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
        <span class="text-amber-600">🏆</span> 榮譽小隊公告
      </h2>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        ${honorPatrolCards}
      </div>
    ` : ''}
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
    ` : (!honorPatrolCards ? '<div class="text-center py-20 text-gray-400">尚無榮譽記錄</div>' : '')}
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

// ===================== 精彩回顧（歷年活動相冊）=====================
frontendRoutes.get('/highlights', async (c) => {
  const db = c.env.DB

  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })

  // 取得所有精彩回顧相冊（show_in_highlights=1 或 有圖片的活動）
  const activities = await db.prepare(`
    SELECT a.*,
      GROUP_CONCAT(ai.image_url) as image_urls,
      GROUP_CONCAT(ai.caption) as captions,
      GROUP_CONCAT(ai.id) as image_ids,
      COUNT(ai.id) as img_count
    FROM activities a
    LEFT JOIN activity_images ai ON ai.activity_id = a.id
    WHERE a.is_published = 1 AND a.show_in_highlights = 1
    GROUP BY a.id
    ORDER BY a.display_order ASC, a.activity_date DESC
  `).all()

  // 若無「精彩回顧」活動，則取所有有圖片的活動
  const allActivities = activities.results.length > 0
    ? activities.results
    : (await db.prepare(`
        SELECT a.*,
          GROUP_CONCAT(ai.image_url) as image_urls,
          GROUP_CONCAT(ai.caption) as captions,
          GROUP_CONCAT(ai.id) as image_ids,
          COUNT(ai.id) as img_count
        FROM activities a
        LEFT JOIN activity_images ai ON ai.activity_id = a.id
        WHERE a.is_published = 1
        GROUP BY a.id
        HAVING img_count > 0
        ORDER BY a.display_order ASC, a.activity_date DESC
      `).all()).results

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
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-300 group" id="album-${a.id}">
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

  <!-- 相冊網格 -->
  <div class="max-w-5xl mx-auto px-4 py-10">
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
  // 同時載入現任幹部，讓前台組織架構能連動幹部管理資料
  const cadres = await db.prepare(`SELECT * FROM group_cadres WHERE group_id=? AND is_current=1 ORDER BY display_order`).bind(group.id).all()
  const settingsRows = await db.prepare(`SELECT key, value FROM site_settings`).all()
  const settings: Record<string, string> = {}
  settingsRows.results.forEach((row: any) => { settings[row.key] = row.value })
  return c.html(renderSubPage(group, 'org', { org, cadres: cadres.results }, settings))
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
        <a href="/highlights" class="hover:text-amber-300 transition-colors hidden md:inline">📸 精彩回顧</a>
        <a href="/honor" class="hover:text-amber-300 transition-colors hidden md:inline">🏅 榮譽榜</a>
        <a href="/coaches" class="hover:text-amber-300 transition-colors hidden md:inline">🧢 教練團</a>
        <a href="/stats" class="hover:text-amber-300 transition-colors hidden md:inline">📊 統計</a>
        <a href="/attendance" class="hover:text-amber-300 transition-colors hidden md:inline">📅 出席</a>
        <a href="/#about" class="hover:text-amber-300 transition-colors hidden md:inline">關於我們</a>
        <a href="/member" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">👤 會員入口</a>
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
function renderHomePage(activities: any[], groups: any[], settings: Record<string, string>, announcements: any[], highlights: any[] = []) {
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
    // data 現在是 { org, cadres } 的格式
    const orgPageData = data as any
    const org = orgPageData?.org || orgPageData  // 相容舊格式
    const allCadres: any[] = orgPageData?.cadres || []

    // 解析 org JSON（職位說明、PLC/EC 設定）
    let orgData: any = {}
    if (org?.content) {
      try { orgData = JSON.parse(org.content) } catch {}
    }
    const orgIntro: string   = orgData.intro || ''
    const orgPatrols: any[]  = orgData.patrols || []
    const orgComms: any[]    = orgData.committees || []
    // 後台 org 頁設定的職位說明（用職稱作 key 查描述）
    const orgGroupLeadersDesc: any[] = orgData.groupLeaders || []
    const orgUnitLeadersDesc: any[]  = orgData.unitLeaders || orgData.leaders || []

    // ── 從幹部名冊建立層級（與後台幹部管理頁一致）──
    const groupLeaderRoles = ['童軍團長','團長','副團長','群長','副群長','隊長','副隊長']
    const unitLeaderRoles  = ['聯隊長','副聯隊長']
    const patrolRoles      = ['小隊長','副小隊長']
    const ecRoleMap: Record<string, string> = {
      '展演組長':'展演組','副展演長':'展演組','展演長':'展演組',
      '活動組長':'活動組','副活動長':'活動組','活動長':'活動組',
      '行政組長':'行政組','副行政長':'行政組','行政長':'行政組',
      '器材組長':'器材組','副器材長':'器材組','器材長':'器材組',
      '公關組長':'公關組','副公關長':'公關組','公關長':'公關組',
      '攝影組長':'攝影組','副攝影長':'攝影組','攝影長':'攝影組',
    }

    // 過濾各層幹部（從 group_cadres 資料）
    const groupLeaderCadres = allCadres.filter((c: any) => groupLeaderRoles.includes(c.role))
    const unitLeaderCadres  = allCadres.filter((c: any) => unitLeaderRoles.includes(c.role))
    const patrolCadres      = allCadres.filter((c: any) => patrolRoles.includes(c.role))
    const ecCadres          = allCadres.filter((c: any) => ecRoleMap[c.role])

    // 建立職位說明對照表（从 org JSON）
    const descByRole: Record<string, string> = {}
    orgGroupLeadersDesc.forEach((l: any) => { if (l.role && l.desc) descByRole[l.role] = l.desc })
    orgUnitLeadersDesc.forEach((l: any) => { if (l.role && l.desc) descByRole[l.role] = l.desc })

    // ── 輔助：職位卡片（有姓名）──
    const cadreRoleCard = (c: any, colorClass: string, bgClass: string) => {
      const desc = descByRole[c.role] || ''
      return `<div class="rounded-2xl border-2 ${colorClass} ${bgClass} shadow-sm p-4 text-center hover:shadow-md transition-shadow min-w-[130px] max-w-[180px]">
        ${c.photo_url ? `<img src="${c.photo_url}" alt="${c.chinese_name}" class="w-14 h-14 rounded-full object-cover mx-auto mb-2 border-2 ${colorClass}" onerror="this.style.display='none'">` : `<div class="w-14 h-14 rounded-full mx-auto mb-2 flex items-center justify-center text-2xl ${bgClass} border-2 ${colorClass}">👤</div>`}
        <div class="text-xs font-semibold opacity-70 mb-0.5">${c.role}</div>
        <div class="font-bold text-gray-800 text-sm">${c.chinese_name}</div>
        ${c.english_name && c.english_name !== 'null' ? `<div class="text-xs text-gray-400 mt-0.5">${c.english_name}</div>` : ''}
        ${desc ? `<p class="text-xs text-gray-500 mt-1 leading-relaxed">${desc}</p>` : ''}
      </div>`
    }

    // ── 輔助：純職稱卡片（無幹部時，從 org JSON 設定顯示）──
    const roleDescCard = (role: string, desc: string, colorText: string, borderClass: string, bgClass: string) =>
      `<div class="rounded-2xl border-2 ${borderClass} ${bgClass} shadow-sm p-4 text-center hover:shadow-md transition-shadow min-w-[130px] max-w-[200px]">
        <div class="font-bold ${colorText} text-base mb-1">${role}</div>
        ${desc ? `<p class="text-xs text-gray-500 leading-relaxed">${desc}</p>` : ''}
      </div>`

    // ── 第1層：先看幹部，無幹部則看 org JSON 設定 ──
    let layer1Html = ''
    if (groupLeaderCadres.length > 0) {
      layer1Html = `<div class="flex flex-wrap justify-center gap-4">${groupLeaderCadres.map(c => cadreRoleCard(c, 'border-purple-300', 'bg-purple-50')).join('')}</div>`
    } else if (orgGroupLeadersDesc.length > 0) {
      layer1Html = `<div class="flex flex-wrap justify-center gap-4">${orgGroupLeadersDesc.map((l: any) => roleDescCard(l.role, l.desc || '', 'text-purple-800', 'border-purple-200', 'bg-purple-50')).join('')}</div>`
    } else {
      layer1Html = `<div class="flex justify-center"><div class="rounded-2xl border-2 border-purple-200 bg-purple-50 shadow-sm p-4 text-center">
        <div class="font-bold text-purple-800">團長 / 副團長</div>
        <p class="text-xs text-gray-400 mt-1">全團最高領導</p>
      </div></div>`
    }

    // ── 第2層：先看幹部，無幹部則看 org JSON 設定 ──
    let layer2Html = ''
    if (unitLeaderCadres.length > 0) {
      layer2Html = `<div class="flex flex-wrap justify-center gap-4">${unitLeaderCadres.map(c => cadreRoleCard(c, 'border-green-300', 'bg-green-50')).join('')}</div>`
    } else if (orgUnitLeadersDesc.length > 0) {
      layer2Html = `<div class="flex flex-wrap justify-center gap-4">${orgUnitLeadersDesc.map((l: any) => roleDescCard(l.role, l.desc || '', 'text-green-800', 'border-green-300', 'bg-green-50')).join('')}</div>`
    }

    // ── 小隊（PLC）卡片 ──
    // 優先用 org JSON 的小隊設定（含說明/隊徽），然後疊加幹部姓名
    const patrolsByUnit: Record<string, any[]> = {}
    patrolCadres.forEach((c: any) => {
      const k = c.notes || '未分配小隊'
      if (!patrolsByUnit[k]) patrolsByUnit[k] = []
      patrolsByUnit[k].push(c)
    })

    const buildPatrolCards = () => {
      if (orgPatrols.length > 0) {
        // 使用 org JSON 的小隊設定
        return orgPatrols.map((p: any) => {
          const members = patrolsByUnit[p.name] || []
          return `<div class="bg-white rounded-2xl border-2 border-teal-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div class="h-20 overflow-hidden bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
              ${(p.photo_url || p.image_url)
                ? `<img src="${p.photo_url || p.image_url}" alt="${p.name}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<span class=\\'text-3xl\\'>🏕️</span>'">`
                : `<span class="text-3xl">🏕️</span>`}
            </div>
            <div class="p-3 text-center">
              <div class="font-bold text-gray-800 text-sm mb-1">${p.name || ''}</div>
              ${p.desc ? `<p class="text-xs text-gray-500 mb-2">${p.desc}</p>` : ''}
              ${members.length > 0 ? members.map((m: any) => `<div class="text-xs text-teal-700 font-medium">${m.role} ${m.chinese_name}</div>`).join('') : ''}
            </div>
          </div>`
        }).join('')
      } else if (Object.keys(patrolsByUnit).length > 0) {
        // 無 org 設定但有幹部，按單位分組
        return Object.entries(patrolsByUnit).map(([unit, members]) => {
          return `<div class="bg-white rounded-2xl border-2 border-teal-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div class="h-16 bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
              <span class="text-2xl">🏕️</span>
            </div>
            <div class="p-3 text-center">
              <div class="font-bold text-gray-800 text-sm mb-1">${unit}</div>
              ${members.map((m: any) => `<div class="text-xs text-teal-700 font-medium">${m.role} ${m.chinese_name}</div>`).join('')}
            </div>
          </div>`
        }).join('')
      }
      return ''
    }
    const patrolCardsHtml = buildPatrolCards()

    // ── EC 委員會卡片 ──
    const ecGroups: Record<string, any[]> = {}
    ecCadres.forEach((c: any) => {
      const k = ecRoleMap[c.role]
      if (!ecGroups[k]) ecGroups[k] = []
      ecGroups[k].push(c)
    })

    const buildCommitteeCards = () => {
      // 合併 org JSON 的委員會設定與幹部
      const allCommNames = new Set([...Object.keys(ecGroups), ...orgComms.map((c: any) => c.name)])
      return Array.from(allCommNames).map(name => {
        const orgComm = orgComms.find((c: any) => c.name === name)
        const members = ecGroups[name] || []
        return `<div class="bg-white rounded-2xl border-2 border-blue-200 shadow-sm p-4 text-center hover:shadow-md transition-shadow">
          <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-xl mx-auto mb-2">⚙️</div>
          <div class="font-bold text-gray-800 text-sm mb-1">${name}</div>
          ${orgComm?.desc ? `<p class="text-xs text-gray-500 leading-relaxed mb-2">${orgComm.desc}</p>` : ''}
          ${members.length > 0 ? `<div class="space-y-0.5 mt-1">${members.map((m: any) => `<div class="text-xs text-blue-700 font-medium">${m.role} ${m.chinese_name}</div>`).join('')}</div>` : ''}
          ${orgComm?.roles && orgComm.roles.length ? `<div class="flex flex-wrap justify-center gap-1 mt-2">${orgComm.roles.map((r: string) => `<span class="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">${r}</span>`).join('')}</div>` : ''}
        </div>`
      }).join('')
    }
    const committeeCardsHtml = buildCommitteeCards()

    const hasContent = groupLeaderCadres.length > 0 || unitLeaderCadres.length > 0 ||
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

      <!-- ── 三層架構圖 ── -->
      <div class="bg-white rounded-2xl shadow-md p-6 sm:p-8 mb-8">
        <h2 class="text-xl font-bold text-gray-800 mb-8 text-center flex items-center justify-center gap-2">
          <span>🏛️</span> 組織架構
        </h2>

        <!-- 第1層：團長/副團長 -->
        <div class="mb-3">
          <div class="text-center text-xs font-semibold text-purple-500 uppercase tracking-widest mb-3">全團領導 · Group Leaders</div>
          ${layer1Html}
        </div>

        <!-- 連接線 -->
        <div class="flex justify-center my-3"><div class="w-px h-8 bg-gray-300"></div></div>

        <!-- 第2層：聯隊長/副聯隊長 -->
        ${layer2Html ? `
        <div class="mb-3">
          <div class="text-center text-xs font-semibold text-green-600 uppercase tracking-widest mb-3">聯隊領導 · Unit Leaders</div>
          ${layer2Html}
        </div>
        <!-- 連接線到 PLC + EC -->
        <div class="flex justify-center gap-24 sm:gap-40 my-3">
          <div class="w-px h-8 bg-gray-300"></div>
          <div class="w-px h-8 bg-gray-300"></div>
        </div>
        ` : '<div class="flex justify-center gap-24 sm:gap-40 my-3"><div class="w-px h-8 bg-gray-300"></div><div class="w-px h-8 bg-gray-300"></div></div>'}

        <!-- 第3層標題：PLC + EC 並排 -->
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-green-50 border-2 border-green-200 rounded-xl p-3 text-center">
            <div class="font-bold text-green-800 text-sm">小隊長議會 PLC</div>
            <div class="text-xs text-green-500 mt-0.5">Patrol Leaders' Council</div>
          </div>
          <div class="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 text-center">
            <div class="font-bold text-blue-800 text-sm">執行委員會 EC</div>
            <div class="text-xs text-blue-400 mt-0.5">Executive Committee</div>
          </div>
        </div>
      </div>

      <!-- PLC 小隊區塊 -->
      ${patrolCardsHtml ? `
      <div class="mb-8">
        <div class="flex items-center mb-5">
          <div class="flex-1 h-px bg-green-200"></div>
          <div class="text-center px-4">
            <h3 class="text-lg font-bold text-green-800">PLC 小隊長議會</h3>
            <p class="text-xs text-green-500 mt-0.5">Patrol Leaders Council</p>
          </div>
          <div class="flex-1 h-px bg-green-200"></div>
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
            <h3 class="text-lg font-bold text-blue-800">執行委員會 EC</h3>
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
        <p class="text-sm mt-1 text-gray-300">請至後台管理介面新增幹部資料</p>
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

// ===================== 現任幹部頁（PLC + EC 排版）=====================
function renderCadresPage(group: any, cadres: any[], orgChart: any, settings: Record<string, string>) {
  // 解析 org chart JSON
  let leaders: any[] = []
  let patrols: any[] = []
  let committees: any[] = []
  if (orgChart?.content) {
    try {
      const parsed = JSON.parse(orgChart.content)
      leaders = parsed.leaders || []
      patrols = parsed.patrols || []
      committees = parsed.committees || []
    } catch {}
  }

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

  // 輔助：從幹部名單找特定職位
  const findCadre = (role: string) => cadres.find((c: any) => c.role === role)
  const findCadresByRole = (roles: string[]) => cadres.filter((c: any) => roles.includes(c.role))

  // 渲染一個人物卡片（photo圓形，姓名＋職銜）
  const personCard = (name: string, role: string, engName: string, photo: string, size: 'lg'|'md'|'sm' = 'md') => {
    const sizes = {
      lg: { wrap: 'w-28 h-28', emoji: 'text-5xl', nameSize: 'text-base', roleSize: 'text-xs' },
      md: { wrap: 'w-20 h-20', emoji: 'text-3xl', nameSize: 'text-sm', roleSize: 'text-xs' },
      sm: { wrap: 'w-16 h-16', emoji: 'text-2xl', nameSize: 'text-xs', roleSize: 'text-xs' },
    }[size]
    const displayName = name || '（待填入）'
    return `
    <div class="flex flex-col items-center gap-1.5 text-center">
      <div class="${sizes.wrap} rounded-full overflow-hidden bg-green-50 border-2 border-green-300 flex items-center justify-center shadow-md flex-shrink-0">
        ${photo
          ? `<img src="${photo}" alt="${displayName}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<span class=\\'${sizes.emoji}\\'>⭐</span>'">`
          : `<span class="${sizes.emoji}">⭐</span>`}
      </div>
      <div>
        <div class="inline-block text-xs font-semibold text-green-800 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full mb-0.5">${role}</div>
        <div class="font-bold text-gray-800 ${sizes.nameSize}">${displayName}</div>
        ${engName ? `<div class="text-gray-400 text-xs">${engName}</div>` : ''}
      </div>
    </div>`
  }

  // ─────────────────────────────────────────
  // PLC 區塊
  // ─────────────────────────────────────────

  // PLC 主席（聯隊長 / 副聯隊長）
  // 優先從 org chart leaders 取，其次從 cadres
  const plcHeadItems: any[] = (() => {
    if (leaders.length > 0) return leaders
    return findCadresByRole(['聯隊長','副聯隊長','隊長','副隊長','群長','副群長'])
      .map((c: any) => ({ role: c.role, name: c.chinese_name, english_name: c.english_name, photo_url: c.photo_url || '' }))
  })()

  const plcHeadHtml = plcHeadItems.length > 0 ? `
  <div class="flex flex-wrap justify-center gap-10 mb-8">
    ${plcHeadItems.map((p: any) => personCard(
      p.name || p.chinese_name || '',
      p.role || '',
      p.english_name || '',
      p.photo_url || '',
      'lg'
    )).join('')}
  </div>` : ''

  // 各小隊卡片（PLC patrols）
  const patrolCardsHtml = (() => {
    // 優先用 org chart patrols
    if (patrols.length > 0) {
      return `
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
        ${patrols.map((patrol: any) => {
          const leaderName = patrol.leaderName || patrol.leader || ''
          const subName = patrol.subLeaderName || patrol.vice_leader || ''
          const leaderRole = patrol.leaderRole || '小隊長'
          const subRole = patrol.subLeaderRole || '副小隊長'
          const photo = patrol.photo_url || patrol.image_url || ''
          const members: any[] = patrol.members || []
          return `
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
            <!-- 小隊圖片 / 隊徽 -->
            <div class="h-36 overflow-hidden bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
              ${photo
                ? `<img src="${photo}" alt="${patrol.name}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<span class=\\'text-6xl\\'>🏕️</span>'">`
                : `<span class="text-6xl">🏕️</span>`}
            </div>
            <!-- 小隊資訊 -->
            <div class="p-4 text-center">
              <h4 class="font-bold text-gray-800 text-sm mb-3">${patrol.name || ''}</h4>
              <div class="space-y-1.5">
                ${leaderName ? `
                <div class="flex items-center justify-center gap-1.5 text-xs">
                  <span class="bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">${leaderRole}</span>
                  <span class="font-medium text-gray-700">${leaderName}</span>
                </div>` : ''}
                ${subName ? `
                <div class="flex items-center justify-center gap-1.5 text-xs">
                  <span class="bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-200">${subRole}</span>
                  <span class="text-gray-600">${subName}</span>
                </div>` : ''}
                ${members.filter((m: any) => m.name).map((m: any) => `
                <div class="flex items-center justify-center gap-1.5 text-xs">
                  ${m.role ? `<span class="text-gray-400">${m.role}：</span>` : ''}
                  <span class="text-gray-600">${m.name}</span>
                </div>`).join('')}
              </div>
            </div>
          </div>`
        }).join('')}
      </div>`
    }

    // 否則從幹部職位中推斷小隊（群組小隊長/副小隊長）
    const patrolLeaders = findCadresByRole(['小隊長','副小隊長','副隊長'])
    if (patrolLeaders.length === 0) return ''
    const byUnit: Record<string, any[]> = {}
    patrolLeaders.forEach((c: any) => {
      const key = c.notes || c.unit_name || '未分配小隊'
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
  })()

  const hasPLC = plcHeadHtml || patrolCardsHtml

  // ─────────────────────────────────────────
  // EC 執行委員會 區塊
  // ─────────────────────────────────────────
  const ecCardsHtml = (() => {
    if (committees.length > 0) {
      return `
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
        ${committees.map((comm: any) => {
          const photo = comm.photo_url || comm.image_url || ''
          const leaderName = comm.leaderName || comm.leader || ''
          const leaderRole = comm.leaderRole || '組長'
          const members: any[] = comm.members || []
          return `
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
            <div class="h-32 overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
              ${photo
                ? `<img src="${photo}" alt="${comm.name}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<span class=\\'text-5xl\\'>⚙️</span>'">`
                : `<span class="text-5xl">⚙️</span>`}
            </div>
            <div class="p-4 text-center">
              <h4 class="font-bold text-gray-800 text-sm mb-3">${comm.name || ''}</h4>
              <div class="space-y-1.5">
                ${leaderName ? `
                <div class="flex items-center justify-center gap-1.5 text-xs">
                  <span class="bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">${leaderRole}</span>
                  <span class="font-medium text-gray-700">${leaderName}</span>
                </div>` : ''}
                ${members.filter((m: any) => m.name).map((m: any) => `
                <div class="flex items-center justify-center gap-1.5 text-xs">
                  ${m.role ? `<span class="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200">${m.role}</span>` : ''}
                  <span class="text-gray-600">${m.name}</span>
                </div>`).join('')}
              </div>
            </div>
          </div>`
        }).join('')}
      </div>`
    }

    // 否則從幹部推斷 EC 組
    const ecRoleMap: Record<string, string> = {
      '展演組長': '展演組', '副展演長': '展演組',
      '活動組長': '活動組', '副活動長': '活動組',
      '行政組長': '行政組', '副行政長': '行政組', '行政長': '行政組',
      '器材組長': '器材組', '副器材長': '器材組', '器材長': '器材組',
      '公關組長': '公關組', '副公關長': '公關組',
    }
    const ecGroups: Record<string, any[]> = {}
    cadres.filter((c: any) => ecRoleMap[c.role]).forEach((c: any) => {
      const key = ecRoleMap[c.role]
      if (!ecGroups[key]) ecGroups[key] = []
      ecGroups[key].push(c)
    })
    if (Object.keys(ecGroups).length === 0) return ''
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
  })()

  const hasEC = ecCardsHtml !== ''

  // ─────────────────────────────────────────
  // 剩餘幹部（服務員等未分類）
  // ─────────────────────────────────────────
  // 已在 PLC/EC 中使用的職位
  const plcRoles = new Set(plcHeadItems.map((p: any) => p.role).filter(Boolean))
  const patrolRoles = new Set(['小隊長','副小隊長','副隊長'])
  const ecRoleNames = new Set(Object.values({
    '展演組長': '展演組', '副展演長': '展演組',
    '活動組長': '活動組', '副活動長': '活動組',
    '行政組長': '行政組', '副行政長': '行政組', '行政長': '行政組',
    '器材組長': '器材組', '副器材長': '器材組', '器材長': '器材組',
    '公關組長': '公關組', '副公關長': '公關組',
  }))
  const usedInEc = new Set(['展演組長','副展演長','活動組長','副活動長','行政組長','副行政長','行政長','器材組長','副器材長','器材長','公關組長','副公關長'])

  const remainingCadres = cadres.filter((c: any) => {
    if (plcRoles.has(c.role)) return false
    if (patrolRoles.has(c.role)) return false
    if (usedInEc.has(c.role)) return false
    return true
  })

  const remainingHtml = remainingCadres.length > 0 ? `
  <div class="mb-10">
    <div class="flex items-center mb-6">
      <div class="flex-1 h-px bg-green-200"></div>
      <h3 class="text-lg font-bold text-green-800 px-5 flex items-center gap-2">
        <span>🎖️</span> 服務員 / 行政幹部
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

  const isEmpty = !hasPLC && !hasEC && remainingCadres.length === 0

  const contentHtml = `
    ${remainingHtml}

    ${hasPLC ? `
    <div class="mb-12">
      <!-- PLC 標題 -->
      <div class="flex items-center mb-8">
        <div class="flex-1 h-px bg-green-200"></div>
        <div class="text-center px-6">
          <h3 class="text-xl font-bold text-green-800">PLC 小隊長議會</h3>
          <p class="text-xs text-green-500 mt-0.5">Patrol Leaders Council</p>
        </div>
        <div class="flex-1 h-px bg-green-200"></div>
      </div>
      <!-- PLC 主席 -->
      ${plcHeadHtml}
      <!-- 各小隊 -->
      ${patrolCardsHtml}
    </div>` : ''}

    ${hasEC ? `
    <div class="mb-12">
      <!-- EC 標題 -->
      <div class="flex items-center mb-8">
        <div class="flex-1 h-px bg-blue-200"></div>
        <div class="text-center px-6">
          <h3 class="text-xl font-bold text-blue-800">執行委員會 EC</h3>
          <p class="text-xs text-blue-400 mt-0.5">Executive Committee</p>
        </div>
        <div class="flex-1 h-px bg-blue-200"></div>
      </div>
      ${ecCardsHtml}
    </div>` : ''}

    ${isEmpty ? `
    <div class="text-center py-20 text-gray-400">
      <div class="text-6xl mb-4">⭐</div>
      <p class="text-lg font-medium">尚無現任幹部資料</p>
      <p class="text-sm mt-2">請至後台新增幹部或組織架構資料</p>
    </div>` : ''}`

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
