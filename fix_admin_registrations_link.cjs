const fs = require('fs');
const file = 'src/routes/admin.tsx';
let code = fs.readFileSync(file, 'utf8');

// Currently the button is missing for many activities because:
// ${a.activity_type !== 'announcement' ? `<a href="/admin/activities/${a.id}/registrations" class="text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center gap-1">報名名單${a.is_registration_open ? '<span class="w-2 h-2 rounded-full bg-green-500"></span>' : ''}</a>` : ''}
// I will change it to only check if it is not announcement
code = code.replace(
  "a.activity_type !== 'announcement' ? `<a href=\"/admin/activities/${a.id}/registrations\" class=\"text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center gap-1\">報名名單${a.is_registration_open ? '<span class=\"w-2 h-2 rounded-full bg-green-500\"></span>' : ''}</a>` : ''",
  "a.activity_type !== 'announcement' ? `<a href=\"/admin/activities/${a.id}/registrations\" class=\"text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center gap-1 bg-orange-50 px-2 py-1 rounded\">📋 報名名單${a.is_registration_open ? '<span class=\"w-2 h-2 rounded-full bg-green-500\"></span>' : ''}</a>` : ''"
);

fs.writeFileSync(file, code);
console.log('Fixed admin registrations link UI');
