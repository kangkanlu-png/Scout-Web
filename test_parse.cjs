const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

// replace parseImportFile
code = code.replace(
  /const raw = await new Promise\(\(resolve, reject\) => \{[\s\S]*?reader\.readAsBinaryString\(file\);\s*\}\)\.catch\(err => \{[\s\S]*?return null;\s*\}\);/m,
  `const raw = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              try {
                const data = e.target.result;
                // 改用 read array buffer，避免 binary string 在部分瀏覽器或檔案格式的相容性問題
                const wb = XLSX.read(data, { type: 'array', cellDates: false, raw: false });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
                resolve(rows);
              } catch(err) { reject(err); }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
          }).catch(err => {
            alert('❌ Excel 解析失敗：' + err.message);
            return null;
          });`
);

fs.writeFileSync('src/routes/admin.tsx', code);
