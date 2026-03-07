const fs = require('fs');
const file = 'src/routes/admin.tsx';
let code = fs.readFileSync(file, 'utf8');

// The replacement made it invalid syntax:
// `${a.activity_type !== 'announcement' ? `<a href="/admin/activities/${a.id}/images" class="text-purple-600 hover:text-purple-800 text-sm font-medium">圖片</a>` : ''}
// `<a href="/admin/activities/${a.id}/registrations"...`
// It's missing the interpolation syntax `${ }`

code = code.replace(
  /`\<a href="\/admin\/activities\/\$\{a\.id\}\/registrations" class="text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center gap-1"\>報名名單\$\{a\.is_registration_open \? '<span class="w-2 h-2 rounded-full bg-green-500"><\/span>' : ''\}\<\/a>`/,
  "a.activity_type !== 'announcement' ? `<a href=\"/admin/activities/${a.id}/registrations\" class=\"text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center gap-1\">報名名單${a.is_registration_open ? '<span class=\"w-2 h-2 rounded-full bg-green-500\"></span>' : ''}</a>` : ''"
);

// I need to wrap it in ${ }
code = code.replace(
  "a.activity_type !== 'announcement' ? `<a href=\"/admin/activities/${a.id}/registrations\" class=\"text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center gap-1\">報名名單${a.is_registration_open ? '<span class=\"w-2 h-2 rounded-full bg-green-500\"></span>' : ''}</a>` : ''",
  "${a.activity_type !== 'announcement' ? `<a href=\"/admin/activities/${a.id}/registrations\" class=\"text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center gap-1\">報名名單${a.is_registration_open ? '<span class=\"w-2 h-2 rounded-full bg-green-500\"></span>' : ''}</a>` : ''}"
);

fs.writeFileSync(file, code);
console.log('Fixed syntax error');
