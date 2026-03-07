const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

// Find the alumni route and fix it
let routeStart = code.indexOf("adminRoutes.get('/groups/:id/alumni'");
let nextRoute = code.indexOf("adminRoutes.post('/groups/:id/alumni'");
let block = code.substring(routeStart, nextRoute);

const oldDiv = `<div class="bg-white rounded-xl shadow overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b text-xs text-gray-500">
          <tr>
            <th class="py-2 px-3 text-left">學年度</th>
            <th class="py-2 px-3 text-left">姓名</th>
            <th class="py-2 px-3 text-left">英文名</th>
            <th class="py-2 px-3 text-left">小隊</th>
            <th class="py-2 px-3 text-left">職位</th>
            <th class="py-2 px-3 text-left">級別</th>
            <th class="py-2 px-3 text-left">操作</th>
          </tr>
        </thead>
        <tbody>
          \${tableRows || '<tr><td colspan="7" class="py-8 text-center text-gray-400">尚無歷屆名單資料</td></tr>'}
        </tbody>
      </table>
    </div>`;

if (block.includes(oldDiv)) {
  let newBlock = block.replace(oldDiv, `\${tablesHTML}`);
  code = code.substring(0, routeStart) + newBlock + code.substring(nextRoute);
  fs.writeFileSync('src/routes/admin.tsx', code);
  console.log('Fixed alumni admin tables');
} else {
  console.log('Could not find the old table block in alumni route');
}
