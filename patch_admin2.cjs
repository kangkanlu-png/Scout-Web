const fs = require('fs');
let file = fs.readFileSync('src/routes/admin.tsx', 'utf8');

const s1 = `<a href="/admin/stats" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm \${title.includes('統計') ? 'bg-green-700' : ''}">
          <span>📊</span> 統計報表
        </a>`;
const r1 = `<a href="/admin/stats" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm \${title.includes('統計') ? 'bg-green-700' : ''}">
          <span>📊</span> 統計報表
        </a>
        <a href="/admin/rover-map" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-700 transition-colors text-sm \${title.includes('羅浮分佈') ? 'bg-green-700' : ''}">
          <span>🌍</span> 羅浮分佈圖
        </a>`;
file = file.replace(s1, r1);

const s2 = `const yearRankData = await db.prepare(\`
    SELECT pr.year_label, pr.award_name, COUNT(*) as count
    FROM progress_records pr
    WHERE pr.record_type = 'rank' AND pr.year_label IS NOT NULL
    GROUP BY pr.year_label, pr.award_name
    ORDER BY pr.year_label ASC
  \`).all()`;
const r2 = `const yearRankData = await db.prepare(\`
    SELECT pr.year_label, m.section, pr.award_name, COUNT(*) as count
    FROM progress_records pr
    JOIN members m ON m.id = pr.member_id
    WHERE pr.record_type = 'rank' AND pr.year_label IS NOT NULL
    GROUP BY pr.year_label, m.section, pr.award_name
    ORDER BY pr.year_label ASC, m.section, count DESC
  \`).all()`;
file = file.replace(s2, r2);

const s3 = "const coachTotal = await db.prepare(`SELECT COUNT(*) as c FROM coach_members`).first() as any";
const r3 = "const coachTotal = await db.prepare(`SELECT COUNT(*) as c FROM coach_member_status`).first() as any";
file = file.replace(s3, r3);

const s4 = `  const rankYearMap: Record<string, Record<string, number>> = {}
  ;(yearRankData.results as any[]).forEach((r: any) => {
    if (!rankYearMap[r.award_name]) rankYearMap[r.award_name] = {}
    rankYearMap[r.award_name][r.year_label] = (rankYearMap[r.award_name][r.year_label] || 0) + r.count
  })`;
const r4 = `  const rankYearMap: Record<string, Record<string, number>> = {}
  ;(yearRankData.results as any[]).forEach((r: any) => {
    if (!rankYearMap[r.award_name]) rankYearMap[r.award_name] = {}
    rankYearMap[r.award_name][r.year_label] = (rankYearMap[r.award_name][r.year_label] || 0) + r.count
  })

  // 依年度整理晉級（section 層）
  const yearRankMap: Record<string, Record<string, Record<string, number>>> = {}
  ;(yearRankData.results as any[]).forEach((r: any) => {
    if (!yearRankMap[r.year_label]) yearRankMap[r.year_label] = {}
    if (!yearRankMap[r.year_label][r.section]) yearRankMap[r.year_label][r.section] = {}
    yearRankMap[r.year_label][r.section][r.award_name] = r.count
  })`;
file = file.replace(s4, r4);

const s5 = `  // ── 羅浮童軍資料 ──
  const roverMembers = await db.prepare(\`
    SELECT chinese_name, country, university
    FROM members
    WHERE UPPER(membership_status) = 'ACTIVE' AND section = '羅浮童軍'
    ORDER BY country, chinese_name
  \`).all()

  const roverCountryMap: Record<string, {count: number, members: string[]}> = {}
  ;(roverMembers.results as any[]).forEach((r: any) => {
    const country = r.country || '台灣'
    if (!roverCountryMap[country]) roverCountryMap[country] = { count: 0, members: [] }
    roverCountryMap[country].count++
    const uni = (r.university && r.university !== 'null' && r.university.trim()) ? \` (\${r.university})\` : ''
    roverCountryMap[country].members.push(r.chinese_name + uni)
  })
  const roverCountries = Object.keys(roverCountryMap).sort((a,b) => roverCountryMap[b].count - roverCountryMap[a].count)

  const roverMapHtml = generateRoverMapHtml(roverCountries, roverCountryMap, sectionColors)`;
const r5 = `  // ── 歷年詳細資料卡片 ──
  const yearDetailCards = [...yearsAsc].reverse().map((yr: any) => {
    const secs = yearSectionMap[yr] || {}
    const total = yearTotalMap[yr] || 0
    const yearRanks = yearRankMap[yr] || {}
    const hasRanks = Object.keys(yearRanks).length > 0

    const secTags = Object.entries(secs).filter(([,v]) => v > 0).map(([sec, cnt]) =>
      \`<span class="text-xs px-2 py-0.5 rounded-full font-medium" style="background:\${sectionColors[sec] || '#888'}22;color:\${sectionColors[sec] || '#888'}">\${sec}: \${cnt}</span>\`
    ).join('')
    const rankTags = hasRanks ? Object.entries(yearRanks).flatMap(([, awards]) =>
      Object.entries(awards).map(([award, cnt]) =>
        \`<span class="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">\${award}: \${cnt}</span>\`
      )
    ).join('') : ''

    return \`
    <div class="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-3 shadow-sm">
      <div class="px-5 py-3 flex items-center justify-between" style="background:\${yr === latestYear ? '#1e3a5f' : '#374151'}">
        <h3 class="font-bold text-white">\${yr} 年度</h3>
        <span class="text-xs text-white/80 bg-white/20 px-3 py-1 rounded-full">總計 \${total} 人</span>
      </div>
      <div class="p-4 space-y-3">
        \${secTags ? \`<div><div class="text-xs text-gray-500 mb-1.5 font-medium">依階段分類</div><div class="flex flex-wrap gap-1.5">\${secTags}</div></div>\` : ''}
        \${rankTags ? \`<div><div class="text-xs text-gray-500 mb-1.5 font-medium">晉級紀錄</div><div class="flex flex-wrap gap-1.5">\${rankTags}</div></div>\` : ''}
        \${!secTags && !rankTags ? \`<p class="text-xs text-gray-400">尚無詳細資料</p>\` : ''}
      </div>
    </div>\`
  }).join('')`;
file = file.replace(s5, r5);

const s6 = `    <!-- 羅浮分佈圖 -->
    <div class="mt-6">
      \${roverMapHtml}
    </div>`;
file = file.replace(s6, "");

const s7 = `      const ROVER_COUNTRY_MAP = \${JSON.stringify(roverCountryMap)};
      const COUNTRY_FLAGS = \${JSON.stringify(countryFlags)};
      const GOOGLE_MAPS_QUERY = \${JSON.stringify(googleMapsQuery)};
      
      \${mapScript}`;
file = file.replace(s7, "");

const s8 = `<canvas id="admin-chart-total" height="60"></canvas>\` : \`<p class="text-gray-400 text-center py-8">需要至少兩個年度才能顯示趨勢</p>\`}`;
const r8 = `<canvas id="admin-chart-total" height="60"></canvas>\` : \`<p class="text-gray-400 text-center py-8">需要至少兩個年度才能顯示趨勢</p>\`}
          
          <h3 class="font-semibold text-gray-700 mb-3 mt-8">年度統計詳情</h3>
          <div class="space-y-3">\${yearDetailCards}</div>`;
file = file.replace(s8, r8);

if (!file.includes('/rover-map')) {
file = file.replace(
  "export default app",
  `// ===================== 羅浮群全球分佈頁面 =====================
adminRoutes.get('/rover-map', authMiddleware, async (c) => {
  const db = c.env.DB
  
  const sectionColors: Record<string, string> = {
    '童軍': '#22c55e', '行義童軍': '#3b82f6', '羅浮童軍': '#a855f7', '服務員': '#f59e0b'
  }

  const roverMembers = await db.prepare(\`
    SELECT chinese_name, country, university
    FROM members
    WHERE UPPER(membership_status) = 'ACTIVE' AND section = '羅浮童軍'
    ORDER BY country, chinese_name
  \`).all()

  const roverCountryMap: Record<string, {count: number, members: string[]}> = {}
  ;(roverMembers.results as any[]).forEach((r: any) => {
    const country = r.country || '台灣'
    if (!roverCountryMap[country]) roverCountryMap[country] = { count: 0, members: [] }
    roverCountryMap[country].count++
    const uni = (r.university && r.university !== 'null' && r.university.trim()) ? \` (\${r.university})\` : ''
    roverCountryMap[country].members.push(r.chinese_name + uni)
  })
  const roverCountries = Object.keys(roverCountryMap).sort((a,b) => roverCountryMap[b].count - roverCountryMap[a].count)

  const roverMapHtml = generateRoverMapHtml(roverCountries, roverCountryMap, sectionColors)

  return c.html(adminLayout('羅浮分佈圖', \`
    <div class="bg-white p-6 rounded-xl shadow-sm">
      \${roverMapHtml}
    </div>
    <script>
      const ROVER_COUNTRY_MAP = \${JSON.stringify(roverCountryMap)};
      const COUNTRY_FLAGS = \${JSON.stringify(countryFlags)};
      const GOOGLE_MAPS_QUERY = \${JSON.stringify(googleMapsQuery)};
      
      \${mapScript}
    </script>
  \`))
})

export default app`
);
}

fs.writeFileSync('src/routes/admin.tsx', file);
console.log('Admin patched with JS strings');
