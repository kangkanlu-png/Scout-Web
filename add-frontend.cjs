const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/routes/frontend.tsx');
let content = fs.readFileSync(file, 'utf-8');

// 1. Query group honors
const queryCode = `
  // ── 團體榮譽 (績優童軍團等) ──
  const groupHonorRecords = await db.prepare('SELECT honor_name, year_label, tier FROM group_honors ORDER BY tier ASC, year_label DESC').all()
  const groupHonorsByTier: Record<number, Record<string, string[]>> = { 1: {}, 2: {}, 3: {} }
  ;(groupHonorRecords.results as any[]).forEach((h: any) => {
    if (!groupHonorsByTier[h.tier]) groupHonorsByTier[h.tier] = {}
    if (!groupHonorsByTier[h.tier][h.honor_name]) groupHonorsByTier[h.tier][h.honor_name] = []
    groupHonorsByTier[h.tier][h.honor_name].push(h.year_label)
  })

  // ── 榮譽小隊（公告記錄）──`;
content = content.replace(/\/\/ ── 榮譽小隊（公告記錄）──/g, queryCode);

// 2. Generate blocks for group honors
const blockCode = `
  // 產生團體獎項區塊的函數
  const makeGroupHonorBlock = (tierData: Record<string, string[]>) => {
    return Object.entries(tierData).map(([honorName, years]) => {
      const yearChips = years.map(y => \`<span class="px-3 py-1 bg-white/60 border border-amber-200 text-amber-700 text-sm font-bold rounded-full">\${y}</span>\`).join('\\n')
      return \`
      <div class="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-5">
        <div class="flex items-center gap-2 mb-4">
          <span class="text-2xl">🏆</span>
          <h3 class="text-amber-800 font-bold text-lg">\${honorName}</h3>
          <span class="ml-auto text-sm font-semibold bg-amber-100 px-3 py-0.5 rounded-full text-amber-700">團體榮譽</span>
        </div>
        <div class="flex flex-wrap gap-2">\${yearChips}</div>
      </div>\`
    })
  }

  // 第一階：全國性
`;
content = content.replace(/\/\/ 第一階：全國性/g, blockCode);

// 3. Inject group honors into the tier renders
content = content.replace(
  /\$\{\[\.\.\.tier1RankBlocks, \.\.\.specialBlocks\]\.join\(''\) \|\| '<p class="text-gray-400 col-span-2 py-6 text-center">尚無全國性榮譽記錄<\/p>'\}/g,
  `\${[...makeGroupHonorBlock(groupHonorsByTier[1]), ...tier1RankBlocks, ...specialBlocks].join('') || '<p class="text-gray-400 col-span-2 py-6 text-center">尚無全國性榮譽記錄</p>'}`
);

content = content.replace(
  /\$\{tier2RankBlocks\.join\(''\)\}/g,
  `\${[...makeGroupHonorBlock(groupHonorsByTier[2]), ...tier2RankBlocks].join('')}`
);

// We need to also add to the condition so it shows up if there are group honors
content = content.replace(
  /\$\{\(tier1RankBlocks\.length > 0 \|\| specialBlocks\.length > 0\) \? `/g,
  `\${(Object.keys(groupHonorsByTier[1]).length > 0 || tier1RankBlocks.length > 0 || specialBlocks.length > 0) ? \``
);

content = content.replace(
  /\$\{tier2RankBlocks\.length > 0 \? `/g,
  `\${(Object.keys(groupHonorsByTier[2]).length > 0 || tier2RankBlocks.length > 0) ? \``
);

fs.writeFileSync(file, content);
console.log('Updated frontend UI');
