const fs = require('fs');
let file = fs.readFileSync('src/routes/admin.tsx', 'utf8');

file = file.replace(
  /<div class="bg-white rounded-xl shadow overflow-hidden">\n\s*<table class="w-full text-sm">\n\s*<thead class="bg-gray-50 border-b text-xs text-gray-500">\n\s*<tr>\n\s*<th class="py-2 px-3 text-left">學年度<\/th>\n\s*<th class="py-2 px-3 text-left">姓名<\/th>\n\s*<th class="py-2 px-3 text-left">英文名<\/th>\n\s*<th class="py-2 px-3 text-left">小隊<\/th>\n\s*<th class="py-2 px-3 text-left">職位<\/th>\n\s*<th class="py-2 px-3 text-left">級別<\/th>\n\s*<th class="py-2 px-3 text-left">操作<\/th>\n\s*<\/tr>\n\s*<\/thead>\n\s*<tbody>\n\s*\$\{tableRows \|\| '<tr><td colspan="7" class="py-8 text-center text-gray-400">尚無歷屆名單資料<\/td><\/tr>'\}\n\s*<\/tbody>\n\s*<\/table>\n\s*<\/div>/g,
  "${tablesHTML}"
);

fs.writeFileSync('src/routes/admin.tsx', file);
