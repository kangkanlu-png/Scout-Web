const fs = require('fs')

let code = fs.readFileSync('src/routes/admin.tsx', 'utf8')

code = code.replace(
  '<th class="px-4 py-3 text-left text-xs font-medium text-gray-500">最高晉級紀錄</th>',
  '<th class="px-4 py-3 text-left text-xs font-medium text-gray-500">目前進程</th>'
)

fs.writeFileSync('src/routes/admin.tsx', code)
console.log('HTML patched')
