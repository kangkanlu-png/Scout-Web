const fs = require('fs');

let content = fs.readFileSync('src/routes/admin.tsx', 'utf8');

const regex = /let csvDataToImport = \[\];[\s\S]*?reader\.readAsText\(file\);\n    }\);/m;

const newStr = `    let csvDataToImport = [];

    // Load XLSX library dynamically if not present
    async function loadXLSX() {
      if (typeof XLSX !== 'undefined') return true;
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = '/static/xlsx.full.min.js';
        script.onload = () => resolve(true);
        script.onerror = () => {
          // fallback
          script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.head.appendChild(script);
        };
        document.head.appendChild(script);
      });
    }

    async function exportBatchTemplate() {
      const loaded = await loadXLSX();
      if (!loaded) {
        alert('無法載入 Excel 處理套件，請檢查網路連線。');
        return;
      }
      
      const members = \${JSON.stringify(noAccount.results)};
      
      const wsData = [
        ['member_id', '學員姓名', 'username', 'password']
      ];
      
      members.forEach(m => {
        wsData.push([m.id, m.chinese_name, '', '']);
      });
      
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "批次登錄表");
      XLSX.writeFile(wb, "批次帳號密碼登錄表.xlsx");
    }

    document.getElementById('csvFileInput').addEventListener('change', async function(e) {
      const file = e.target.files[0];
      if (!file) return;
      
      const ext = file.name.split('.').pop().toLowerCase();
      
      const processData = (dataArray) => {
        if (dataArray.length < 2) {
          alert('格式錯誤或無資料');
          return;
        }
        
        const headers = dataArray[0].map(h => String(h).trim().replace(/^"|"$/g, ''));
        const idIdx = headers.indexOf('member_id');
        const userIdx = headers.indexOf('username');
        const pwIdx = headers.indexOf('password');
        
        if (idIdx === -1 || userIdx === -1 || pwIdx === -1) {
          alert('找不到必要的欄位，請確保包含 member_id, username, password');
          return;
        }

        csvDataToImport = [];
        let previewHtml = '<table class="w-full text-left"><thead><tr class="border-b"><th>ID</th><th>帳號</th><th>密碼</th></tr></thead><tbody>';
        
        for (let i = 1; i < dataArray.length; i++) {
          const cols = dataArray[i];
          if (!cols || cols.length < 3) continue;
          if (!cols[idIdx] || !cols[userIdx] || !cols[pwIdx]) continue;
          
          const record = {
            member_id: String(cols[idIdx]).trim(),
            username: String(cols[userIdx]).trim(),
            password: String(cols[pwIdx]).trim()
          };
          csvDataToImport.push(record);
          if (i <= 5) {
            previewHtml += '<tr><td>' + record.member_id + '</td><td>' + record.username + '</td><td>***</td></tr>';
          }
        }
        if (csvDataToImport.length > 5) {
          previewHtml += '<tr><td colspan="3" class="text-gray-400">...共 ' + csvDataToImport.length + ' 筆資料</td></tr>';
        }
        previewHtml += '</tbody></table>';
        
        const previewEl = document.getElementById('csvPreview');
        previewEl.innerHTML = previewHtml;
        previewEl.classList.remove('hidden');
        document.getElementById('csvSubmitBtn').disabled = false;
      };

      if (ext === 'xlsx' || ext === 'xls') {
        const loaded = await loadXLSX();
        if (!loaded) {
          alert('無法載入 Excel 處理套件，請檢查網路連線。');
          return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, {type: 'array'});
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, {header: 1, defval: ''});
          // Remove empty rows at the end
          const cleanedJson = json.filter(row => row.some(cell => String(cell).trim() !== ''));
          processData(cleanedJson);
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = function(e) {
          const text = e.target.result;
          const lines = text.split('\\n').map(l => l.trim()).filter(l => l);
          const dataArray = lines.map(line => line.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
          processData(dataArray);
        };
        reader.readAsText(file);
      }
    });`;

if (regex.test(content)) {
  content = content.replace(regex, newStr);
  fs.writeFileSync('src/routes/admin.tsx', content);
  console.log('Regex replace successful.');
} else {
  console.log('Regex did not match.');
}
