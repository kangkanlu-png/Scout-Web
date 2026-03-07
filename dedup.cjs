const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');
const block = `  // 依年度整理晉級（section 層）
  const yearRankMap: Record<string, Record<string, Record<string, number>>> = {}
  ;(yearRankData.results as any[]).forEach((r: any) => {
    if (!yearRankMap[r.year_label]) yearRankMap[r.year_label] = {}
    if (!yearRankMap[r.year_label][r.section]) yearRankMap[r.year_label][r.section] = {}
    yearRankMap[r.year_label][r.section][r.award_name] = r.count
  })`;
let parts = code.split(block);
if (parts.length > 2) {
  code = parts[0] + block + parts.slice(2).join('');
  fs.writeFileSync('src/routes/admin.tsx', code);
  console.log('Deduped yearRankMap');
}
