const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/routes/admin.tsx');
let content = fs.readFileSync(file, 'utf-8');

const oldTd = `<td class="py-3 px-4 text-gray-500 text-xs max-w-[200px] truncate" title="\${r.user_notes || ''}">\${r.user_notes || '-'}</td>`;

const newTd = `<td class="py-3 px-4 text-gray-500 text-xs max-w-[200px] whitespace-pre-wrap">
        \${r.user_notes ? r.user_notes.replace(/\\[附件\\]: (\\/api\\/files\\/[^\\s]+)/g, '<br><a href="$1" target="_blank" class="text-blue-600 hover:underline flex items-center gap-1 mt-1"><i class="fas fa-paperclip"></i> 查看附件</a>') : '-'}
      </td>`;

content = content.replace(oldTd, newTd);
fs.writeFileSync(file, content);
