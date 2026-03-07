const fs = require('fs');
const file = 'src/routes/frontend.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'WHERE a.is_published = 1 AND a.show_in_highlights = 1',
  "WHERE a.is_published = 1 AND (a.show_in_highlights = 1 OR a.activity_status = 'completed')\n    HAVING images IS NOT NULL OR a.cover_image IS NOT NULL"
);

fs.writeFileSync(file, code);
console.log('Patched frontend index');
