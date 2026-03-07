const fs = require('fs');
let file = fs.readFileSync('src/routes/admin.tsx', 'utf8');

file = file.replace(
  /const rankYearMap: Record<string, Record<string, number>> = \{\}\n\s*;\(yearRankData\.results as any\[\]\)\.forEach\(\(r: any\) => \{\n\s*if \(!rankYearMap\[r\.award_name\]\) rankYearMap\[r\.award_name\] = \{\}\n\s*rankYearMap\[r\.award_name\]\[r\.year_label\] = \(rankYearMap\[r\.award_name\]\[r\.year_label\] || 0\) \+ r\.count\n\s*\}\)/,
  `const rankYearMap: Record<string, Record<string, number>> = {}
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
  })`
);

fs.writeFileSync('src/routes/admin.tsx', file);
