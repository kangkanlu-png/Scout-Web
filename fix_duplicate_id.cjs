const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

// The second id="csv-file" is around line 7740. 
// It's part of the group-alumni-import page. We need to rename it so it doesn't conflict with the member-import modal's id="csv-file".

code = code.replace(
  /onclick="document\.getElementById\('csv-file'\)\.click\(\)"/g,
  (match, offset) => {
    // Only replace the one that comes later in the file (around 7700+)
    if (offset > 5000) {
      return `onclick="document.getElementById('alumni-csv-file').click()"`;
    }
    return match;
  }
);

code = code.replace(
  /<input type="file" id="csv-file" accept="\.csv" class="hidden" onchange="previewCSV\(event\)">/g,
  `<input type="file" id="alumni-csv-file" accept=".csv" class="hidden" onchange="previewCSV(event)">`
);

fs.writeFileSync('src/routes/admin.tsx', code);
