const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf-8');

const newField = `        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">目前學年度 (Global Current Year)</label>
          <input type="text" name="current_year_label" value="\${settings.current_year_label || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">聯絡信箱</label>`;

code = code.replace(`        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">聯絡信箱</label>`, newField);

fs.writeFileSync('src/routes/admin.tsx', code);
console.log('Settings updated!');
