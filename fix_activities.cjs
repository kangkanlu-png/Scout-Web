const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf-8');

const oldStr = `    </div>
    \${tablesHTML}
    <script>
      async function closeAndHighlight(id) {`;

const newStr = `    </div>
    <div class="bg-white rounded-xl shadow overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="py-3 px-4 text-left text-gray-600">屬性/狀態</th>
            <th class="py-3 px-4 text-left text-gray-600">標題</th>
            <th class="py-3 px-4 text-left text-gray-600">分類</th>
            <th class="py-3 px-4 text-left text-gray-600">日期</th>
            <th class="py-3 px-4 text-left text-gray-600">圖片</th>
            <th class="py-3 px-4 text-left text-gray-600">操作</th>
          </tr>
        </thead>
        <tbody>
          \${rows || '<tr><td colspan="6" class="py-8 text-center text-gray-400">尚無資料</td></tr>'}
        </tbody>
      </table>
    </div>
    <script>
      async function closeAndHighlight(id) {`;

if (code.includes(oldStr)) {
  code = code.replace(oldStr, newStr);
  fs.writeFileSync('src/routes/admin.tsx', code);
  console.log('Fixed activities page!');
} else {
  console.log('oldStr not found');
}
