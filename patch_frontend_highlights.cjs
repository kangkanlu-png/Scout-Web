const fs = require('fs');
const file = 'src/routes/frontend.tsx';
let code = fs.readFileSync(file, 'utf8');

const newHighlightsCode = `
  // 取得所有精彩回顧相冊（show_in_highlights=1 或 activity_status='completed'，且有圖片的活動）
  const allActivitiesData = await db.prepare(\`
    SELECT a.*,
      GROUP_CONCAT(ai.image_url) as image_urls,
      GROUP_CONCAT(ai.caption) as captions,
      GROUP_CONCAT(ai.id) as image_ids,
      COUNT(ai.id) as img_count
    FROM activities a
    LEFT JOIN activity_images ai ON ai.activity_id = a.id
    WHERE a.is_published = 1 AND (a.show_in_highlights = 1 OR a.activity_status = 'completed')
    GROUP BY a.id
    HAVING img_count > 0 OR a.cover_image IS NOT NULL
    ORDER BY a.display_order ASC, a.activity_date DESC
  \`).all()
  
  const allActivities = allActivitiesData.results;
`;

// Replace the two queries logic
code = code.replace(
  /\/\/ 取得所有精彩回顧相冊.*?const allActivities.*?\)\.results/s,
  newHighlightsCode.trim()
);

const catFilterCode = `
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
        // Update buttons
        document.querySelectorAll('[id^="btn-filter-"]').forEach(btn => {
          btn.className = 'px-4 py-2 rounded-full text-sm font-medium transition-colors border bg-white text-gray-600 border-gray-200 hover:border-green-500 hover:text-green-600';
        });
        document.getElementById('btn-filter-' + cat).className = 'px-4 py-2 rounded-full text-sm font-medium transition-colors border bg-green-600 text-white border-green-600';
        
        // Filter cards
        document.querySelectorAll('.album-card').forEach(card => {
          if (cat === 'all' || card.dataset.cat === cat) {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        });
      }
    </script>
  \`;
`;

// Add category to the albumCard
code = code.replace(
  'const coverImg = a.cover_image || images[0] || \'\'',
  "const coverImg = a.cover_image || images[0] || ''\n    const catClass = a.category || 'general'"
);

code = code.replace(
  '<div class="bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group flex flex-col h-full">',
  '<div class="album-card bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group flex flex-col h-full" data-cat="${catClass}">'
);

code = code.replace(
  '<!-- 相冊網格 -->\n  <div class="max-w-5xl mx-auto px-4 py-10">',
  '<!-- 篩選器 -->\n  <div class="max-w-5xl mx-auto px-4 pt-8 pb-2">\n' + catFilterCode + '  </div>\n\n  <!-- 相冊網格 -->\n  <div class="max-w-5xl mx-auto px-4 pb-10">'
);

fs.writeFileSync(file, code);
console.log('Patched frontend.tsx highlights');
