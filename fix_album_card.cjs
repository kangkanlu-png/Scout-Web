const fs = require('fs');
const file = 'src/routes/frontend.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  '<div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-300 group" id="album-${a.id}">',
  '<div class="album-card bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-300 group" id="album-${a.id}" data-cat="${catClass}">'
);

fs.writeFileSync(file, code);
console.log('Fixed album card');
