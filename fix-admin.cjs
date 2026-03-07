const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

// Ensure import is there
if (!code.includes('import { generateRoverMapHtml, mapScript, countryCoords, countryFlags, googleMapsQuery }')) {
  code = code.replace("import { Context } from 'hono'", "import { Context } from 'hono'\nimport { generateRoverMapHtml, mapScript, countryCoords, countryFlags, googleMapsQuery } from './map-data'");
}

// Add data extraction for Rovers in adminRoutes.get('/stats')
const dataExtraction = `
  // ── 羅浮童軍資料 ──
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
`;

if (!code.includes('const roverMapHtml = generateRoverMapHtml')) {
  code = code.replace("// Chart.js 資料", dataExtraction + "\n  // Chart.js 資料");
}

// Add the HTML into the layout
const htmlInjection = `
    <!-- 羅浮分佈圖 -->
    <div class="mt-6">
      \${roverMapHtml}
    </div>
`;

if (!code.includes('<!-- 羅浮分佈圖 -->')) {
  code = code.replace("<!-- Chart.js -->", htmlInjection + "\n    <!-- Chart.js -->");
}

// Inject mapScript into JS
const scriptInjection = `
      const ROVER_COUNTRY_MAP = \${JSON.stringify(roverCountryMap)};
      const COUNTRY_FLAGS = \${JSON.stringify(countryFlags)};
      const GOOGLE_MAPS_QUERY = \${JSON.stringify(googleMapsQuery)};
      
      \${mapScript}
`;

if (!code.includes('const ROVER_COUNTRY_MAP =')) {
  code = code.replace("const RANK_DATA = ${JSON.stringify(rankChartData)};", "const RANK_DATA = ${JSON.stringify(rankChartData)};\n" + scriptInjection);
}

fs.writeFileSync('src/routes/admin.tsx', code);
