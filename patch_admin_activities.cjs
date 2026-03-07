const fs = require('fs');
const file = 'src/routes/admin.tsx';
let code = fs.readFileSync(file, 'utf8');

const statusOptions = `
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">活動狀態</label>
            <select id="f-activity_status" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="active" \${activity?.activity_status === 'active' || !activity?.activity_status ? 'selected' : ''}>籌備/進行中</option>
              <option value="completed" \${activity?.activity_status === 'completed' ? 'selected' : ''}>已結案</option>
              <option value="cancelled" \${activity?.activity_status === 'cancelled' ? 'selected' : ''}>已取消</option>
            </select>
          </div>
`;

// Insert the status field after is_published
code = code.replace(
  '</select>\n          </div>\n          <div class="md:col-span-2">',
  '</select>\n          </div>\n' + statusOptions + '          <div class="md:col-span-2">'
);

// Add to JS payload
code = code.replace(
  "is_published: parseInt(document.getElementById('f-is_published').value),",
  "is_published: parseInt(document.getElementById('f-is_published').value),\n      activity_status: document.getElementById('f-activity_status')?.value || 'active',"
);

// Update list view in /admin/activities
code = code.replace(
  "const badge = r.activity_type === 'announcement' ? '<span class=\"bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs\">公告</span>'",
  `const statusBadge = r.activity_status === 'completed' ? '<span class="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-xs ml-1">已結案</span>' : 
                          r.activity_status === 'cancelled' ? '<span class="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs ml-1">已取消</span>' : '';
    const badge = r.activity_type === 'announcement' ? '<span class=\"bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs\">公告</span>' + statusBadge`
);

code = code.replace(
  " : '<span class=\"bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs\">一般</span>'",
  " : '<span class=\"bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs\">一般</span>' + statusBadge"
);

code = code.replace(
  " : '<span class=\"bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs\">報名</span>'",
  " : '<span class=\"bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs\">報名</span>' + statusBadge"
);

fs.writeFileSync(file, code);
console.log('Patched admin.tsx');
