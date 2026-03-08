const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

// The loadXLSX function might be rejecting or resolving but not waiting properly for the script to execute
code = code.replace(
  /async function loadXLSX\(\) \{[\s\S]*?throw new Error\('無法載入 Excel 解析套件，請確認網路連線後重試'\);\n\s*\}/m,
  `async function loadXLSX() {
        if (xlsxLoaded || typeof XLSX !== 'undefined') { xlsxLoaded = true; return; }
        const cdns = [
          '/static/xlsx.full.min.js',
          'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
          'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'
        ];
        for (const src of cdns) {
          try {
            await new Promise((resolve, reject) => {
              const s = document.createElement('script');
              s.src = src;
              s.onload = () => { 
                // Small delay to ensure browser parsed the script
                setTimeout(() => {
                  if (typeof XLSX !== 'undefined') {
                    xlsxLoaded = true; 
                    resolve(); 
                  } else {
                    reject(new Error('XLSX undefined after load'));
                  }
                }, 50);
              };
              s.onerror = reject;
              document.head.appendChild(s);
            });
            if (typeof XLSX !== 'undefined') return;
          } catch(e) { /* next */ }
        }
        throw new Error('無法載入 Excel 解析套件，請確認網路連線後重試');
      }`
);

fs.writeFileSync('src/routes/admin.tsx', code);
