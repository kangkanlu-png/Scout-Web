const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

// The logic: 
// const yearSetting = await db.prepare(`SELECT value FROM site_settings WHERE key='current_year_label'`).first() as any
// const currentYear = yearParam || yearSetting?.value || '114'

// We will change it to:
// const maxYearQuery = await db.prepare(`SELECT MAX(CAST(year_label as INTEGER)) as m FROM member_enrollments`).first() as any
// const dbMaxYear = maxYearQuery?.m ? String(maxYearQuery.m) : (yearSetting?.value || '114')
// const currentYear = yearParam || dbMaxYear

code = code.replace(
  /const yearSetting = await db\.prepare\(`SELECT value FROM site_settings WHERE key='current_year_label'`\)\.first\(\) as any\s*const currentYear = yearParam \|\| yearSetting\?\.value \|\| '114'/m,
  `const yearSetting = await db.prepare(\`SELECT value FROM site_settings WHERE key='current_year_label'\`).first() as any
  const maxYearQuery = await db.prepare(\`SELECT MAX(CAST(year_label as INTEGER)) as m FROM member_enrollments\`).first() as any
  const dbMaxYear = maxYearQuery?.m ? String(maxYearQuery.m) : (yearSetting?.value || '114')
  // We prefer the max year from enrollments to always show the latest data by default
  const currentYear = yearParam || dbMaxYear`
);

fs.writeFileSync('src/routes/admin.tsx', code);
