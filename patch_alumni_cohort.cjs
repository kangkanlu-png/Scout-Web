const fs = require('fs');
let code = fs.readFileSync('src/routes/frontend.tsx', 'utf8');

// For alumni (around line 3165)
code = code.replace(
  /民國 \$\{year\} 學年度/,
  `第 \${parseInt(year) - 107} 屆 (民國 \${year} 學年度)`
);

// For past cadres (around line 3130)
code = code.replace(
  /民國 \$\{year\} 學年度/,
  `第 \${parseInt(year) - 107} 屆 (民國 \${year} 學年度)`
);

fs.writeFileSync('src/routes/frontend.tsx', code);
console.log('patched alumni cohort');
