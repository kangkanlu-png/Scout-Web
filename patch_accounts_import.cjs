const fs = require('fs');

let content = fs.readFileSync('src/routes/admin.tsx', 'utf8');

const htmlOld = `    <!-- CSV 匯入 Modal -->
    <div id="csvImportModal" class="fixed inset-0 bg-black/50 hidden items-center justify-center z-50 flex">
      <div class="bg-white rounded-2xl w-full max-w-lg mx-4 overflow-hidden shadow-xl">
        <div class="bg-orange-500 px-4 py-3 flex justify-between items-center text-white">
          <h3 class="font-bold"><i class="fas fa-file-csv mr-2"></i>批次建立會員帳號 (CSV)</h3>
          <button onclick="document.getElementById('csvImportModal').classList.add('hidden')" class="hover:text-orange-200">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="p-5">
          <p class="text-sm text-gray-600 mb-4">
            請上傳包含以下欄位的 CSV 檔案（包含標題列）：<br>
            <code class="bg-gray-100 px-1 py-0.5 rounded text-xs text-purple-700">member_id,username,password</code>
          </p>
          <div class="mb-4 text-xs text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-100">
            <p class="font-bold text-blue-700 mb-1">提示：如何取得 member_id？</p>
            可以在「成員管理」列表查看，或是使用尚未建立帳號名單中的 ID。
          </div>
          
          <input type="file" id="csvFileInput" accept=".csv" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 mb-4"/>`;

const htmlNew = `    <!-- Excel/CSV 匯入 Modal -->
    <div id="csvImportModal" class="fixed inset-0 bg-black/50 hidden items-center justify-center z-50 flex">
      <div class="bg-white rounded-2xl w-full max-w-lg mx-4 overflow-hidden shadow-xl">
        <div class="bg-orange-500 px-4 py-3 flex justify-between items-center text-white">
          <h3 class="font-bold"><i class="fas fa-file-csv mr-2"></i>批次建立會員帳號 (Excel / CSV)</h3>
          <button onclick="document.getElementById('csvImportModal').classList.add('hidden')" class="hover:text-orange-200">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="p-5">
          <p class="text-sm text-gray-600 mb-2">
            請上傳包含以下欄位的 Excel/CSV 檔案（包含標題列）：<br>
            <code class="bg-gray-100 px-1 py-0.5 rounded text-xs text-purple-700">member_id,username,password</code>
          </p>
          <div class="mb-4">
            <a href="/static/accounts_import_template.xlsx" download="帳號匯入範例.xlsx" class="text-xs text-blue-600 hover:underline font-medium">📥 下載 Excel 範例檔</a>
          </div>
          <div class="mb-4 text-xs text-gray-500 bg-blue-50 p-3 rounded-lg border border-blue-100">
            <p class="font-bold text-blue-700 mb-1">提示：如何取得 member_id？</p>
            可以在「成員管理」列表查看，或是使用尚未建立帳號名單中的 ID。
          </div>
          
          <input type="file" id="csvFileInput" accept=".csv,.xlsx,.xls" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 mb-4"/>`;

content = content.replace(htmlOld, htmlNew);

const scriptOld = `    let csvDataToImport = [];

    document.getElementById('csvFileInput').addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 2) {
          alert('CSV 格式錯誤或無資料');
          return;
        }
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const idIdx = headers.indexOf('member_id');
        const userIdx = headers.indexOf('username');
        const pwIdx = headers.indexOf('password');
        
        if (idIdx === -1 || userIdx === -1 || pwIdx === -1) {
          alert('找不到必要的欄位，請確保包含 member_id, username, password');
          return;
        }

        csvDataToImport = [];
        let previewHtml = '<table class="w-full text-left"><thead><tr class="border-b"><th>ID</th><th>帳號</th><th>密碼</th></tr></thead><tbody>';
        
        for (let i = 1; i < lines.length; i++) {
          // Simple CSV parse handling quotes
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length < 3) continue;
          
          const record = {
            member_id: cols[idIdx],
            username: cols[userIdx],
            password: cols[pwIdx]
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
      reader.readAsText(file);
    });`;

const scriptNew = `    let csvDataToImport = [];

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

content = content.replace(scriptOld, scriptNew);

// Also let's fix the button text from "CSV 批次匯入" to "Excel/CSV 批次匯入"
const btnOld = `<i class="fas fa-file-csv"></i>CSV 批次匯入`;
const btnNew = `<i class="fas fa-file-excel"></i>Excel/CSV 批次匯入`;
content = content.replace(btnOld, btnNew);

fs.writeFileSync('src/routes/admin.tsx', content);
console.log('Patched import modal and script successfully.');
