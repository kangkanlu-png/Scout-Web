const fs = require('fs');
let file = fs.readFileSync('src/routes/admin.tsx', 'utf8');

file = file.replace(
  /const res = await fetch\(isEdit \? `\/api\/activities\/\$\{actId\}` : `\/api\/activities`/,
  'const res = await fetch(\'/api/activities\' + (isEdit ? \'/\' + actId : \'\')'
);
file = file.replace(
  /const res = await fetch\(`\/api\/activities\$\{isEdit \? '\/' \+ actId : ''\}`/,
  'const res = await fetch(\'/api/activities\' + (isEdit ? \'/\' + actId : \'\')'
);
file = file.replace(
  /const res = await fetch\(`\/api\/activities\\?\$\{isEdit \? '\/' \+ actId : ''\}`/,
  'const res = await fetch(\'/api/activities\' + (isEdit ? \'/\' + actId : \'\')'
);

fs.writeFileSync('src/routes/admin.tsx', file);
