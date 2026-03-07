const fs = require('fs');
let file = fs.readFileSync('src/routes/admin.tsx', 'utf8');

file = file.replace(/<button onclick="document.getElementById\('add-coach-modal'\).classList.remove\('hidden'\)"\n\s*class="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">＋ 新增教練<\/button>/, '<!-- button removed, use advancement page instead -->');

fs.writeFileSync('src/routes/admin.tsx', file);
console.log('Button hidden');
