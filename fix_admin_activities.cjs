const fs = require('fs');
const file = 'src/routes/admin.tsx';
let code = fs.readFileSync(file, 'utf8');

// I will add a condition to always show "報名" button if the category type is registration or if it has registration properties enabled
// We need to change:
// ${a.activity_type === 'registration' ? `<a href="/admin/activities/${a.id}/registrations"...
// To:
// `<a href="/admin/activities/${a.id}/registrations" class="text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center gap-1">報名名單${a.is_registration_open ? '<span class="w-2 h-2 rounded-full bg-green-500"></span>' : ''}</a>`

code = code.replace(
  /\$\{a\.activity_type === 'registration' \? `(.*?)` : ''\}/,
  "`$1`"
);

// Specifically replace the text from "報名" to "報名名單"
code = code.replace(
  /class="text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center gap-1">報名\$\{/,
  'class="text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center gap-1">報名名單${'
);

fs.writeFileSync(file, code);
console.log('Fixed admin activities to show registration link for all');
