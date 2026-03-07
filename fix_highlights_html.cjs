const fs = require('fs');
const file = 'src/routes/frontend.tsx';
let code = fs.readFileSync(file, 'utf8');

// Find the section that was wrongly replaced
const badCodeStart = code.indexOf('<!-- 篩選器 -->');
if (badCodeStart !== -1) {
  // It's probably inside the return c.html(...)
  // Wait, I replaced `<!-- 相冊網格 -->` which is inside the template literal.
  // And my replacement string was `<!-- 篩選器 -->... const cats = ...` which is plain text inside the template literal!
  
  // Revert back
  code = code.replace(
    /<!-- 篩選器 -->[\s\S]*?<!-- 相冊網格 -->\n  <div class="max-w-5xl mx-auto px-4 pb-10">/,
    '<!-- 篩選器 -->\n  <div class="max-w-5xl mx-auto px-4 pt-8 pb-2">\n    ${filterHtml}\n  </div>\n\n  <!-- 相冊網格 -->\n  <div class="max-w-5xl mx-auto px-4 pb-10">'
  );
  
  // Now inject the `cats` and `filterHtml` BEFORE `return c.html(...)`
  const logicToInject = `
  // Category tabs for filtering
  const cats = [
    { id: 'all', name: '全部', icon: '📸' },
    { id: 'camping', name: '露營', icon: '⛺' },
    { id: 'tecc', name: 'TECC急救', icon: '🚑' },
    { id: 'service', name: '服務', icon: '🤝' },
    { id: 'training', name: '訓練', icon: '📚' },
    { id: 'general', name: '一般活動', icon: '⚜️' }
  ];
  
  const filterHtml = \`
    <div class="flex flex-wrap justify-center gap-2 mb-8">
      \${cats.map(c => \`
        <button onclick="filterHighlights('\${c.id}')" id="btn-filter-\${c.id}" class="px-4 py-2 rounded-full text-sm font-medium transition-colors border \${c.id === 'all' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-500 hover:text-green-600'}">
          \${c.icon} \${c.name}
        </button>
      \`).join('')}
    </div>
    
    <script>
      function filterHighlights(cat) {
        document.querySelectorAll('[id^="btn-filter-"]').forEach(btn => {
          btn.className = 'px-4 py-2 rounded-full text-sm font-medium transition-colors border bg-white text-gray-600 border-gray-200 hover:border-green-500 hover:text-green-600';
        });
        const activeBtn = document.getElementById('btn-filter-' + cat);
        if (activeBtn) {
          activeBtn.className = 'px-4 py-2 rounded-full text-sm font-medium transition-colors border bg-green-600 text-white border-green-600';
        }
        
        document.querySelectorAll('.album-card').forEach(card => {
          if (cat === 'all' || card.dataset.cat === cat) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      }
    </script>
  \`;
`;
  
  code = code.replace(
    'return c.html(`${pageHead(\'精彩回顧 - 林口康橋童軍團\')}',
    logicToInject + '\n  return c.html(`${pageHead(\'精彩回顧 - 林口康橋童軍團\')}'
  );
  
  fs.writeFileSync(file, code);
  console.log('Fixed highlights HTML');
}
