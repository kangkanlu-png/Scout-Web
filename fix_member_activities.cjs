const fs = require('fs');
const file = 'src/routes/member.tsx';
let code = fs.readFileSync(file, 'utf8');

// I will make sure we only show activities that are type 'registration' or 'general'
code = code.replace(
  'WHERE a.is_published = 1\n    ORDER BY a.activity_date DESC',
  "WHERE a.is_published = 1 AND (a.activity_type = 'registration' OR a.activity_type = 'general' OR a.activity_type IS NULL)\n    ORDER BY a.activity_date DESC"
);

fs.writeFileSync(file, code);
console.log('Fixed member activities filter');
