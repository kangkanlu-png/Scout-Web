const fs = require('fs');
let file = fs.readFileSync('src/routes/admin.tsx', 'utf8');

if (!file.includes("adminRoutes.get('/rover-map'")) {
file = file.replace(
  /export default adminRoutes/,
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

export default adminRoutes`
);
fs.writeFileSync('src/routes/admin.tsx', file);
console.log('Rover map route added');
} else {
console.log('Already added');
}
