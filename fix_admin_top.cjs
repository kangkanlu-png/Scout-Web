const fs = require('fs');
let file = fs.readFileSync('src/routes/admin.tsx', 'utf8');

// remove the prepended string
file = file.replace(/^const rankYearMap: Record<string, Record<string, number>> = \{\}\n\s*;\(yearRankData\.results as any\[\]\)\.forEach\(\(r: any\) => \{\n\s*if \(!rankYearMap\[r\.award_name\]\) rankYearMap\[r\.award_name\] = \{\}\n\s*rankYearMap\[r\.award_name\]\[r\.year_label\] = \(rankYearMap\[r\.award_name\]\[r\.year_label\] || 0\) \+ r\.count\n\s*\}\)\n\n\s*\/\/ 依年度整理晉級（section 層）\n\s*const yearRankMap: Record<string, Record<string, Record<string, number>>> = \{\}\n\s*;\(yearRankData\.results as any\[\]\)\.forEach\(\(r: any\) => \{\n\s*if \(!yearRankMap\[r\.year_label\]\) yearRankMap\[r\.year_label\] = \{\}\n\s*if \(!yearRankMap\[r\.year_label\]\[r\.section\]\) yearRankMap\[r\.year_label\]\[r\.section\] = \{\}\n\s*yearRankMap\[r\.year_label\]\[r\.section\]\[r\.award_name\] = r\.count\n\s*\}\)/, '');

fs.writeFileSync('src/routes/admin.tsx', file);
