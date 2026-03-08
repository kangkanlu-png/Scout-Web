const XLSX = require('xlsx');
const fs = require('fs');

const fileBuffer = fs.readFileSync('/home/user/uploaded_files/115年資料-格式輸入.xlsx');

// 模擬瀏覽器的 parseImportFile 行為
const raw = (function() {
  try {
    // 改用 read array buffer (用 Buffer 模擬)
    const wb = XLSX.read(fileBuffer, { type: 'buffer', cellDates: false, raw: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    return rows;
  } catch(err) { 
    console.error("XLSX read error:", err);
    return null;
  }
})();

if (!raw || raw.length < 2) {
  console.log('⚠️ Excel 內容為空或格式不符');
  process.exit(1);
}

const KNOWN_HEADERS = new Set(['姓名','中文姓名','英文名','英文姓名','身分證號','生日','性別','童軍階段','童軍進程','電話','小隊','職務','團次','Name','Chinese Name']);
let headerIdx = 0;
for (let i = 0; i < Math.min(6, raw.length); i++) {
  if (raw[i].some(c => KNOWN_HEADERS.has(String(c).trim()))) {
    headerIdx = i; break;
  }
}

console.log("Header index:", headerIdx);
const headers = raw[headerIdx].map(h => String(h).trim());
console.log("Headers:", headers);

const csvData = raw.slice(headerIdx + 1)
  .filter(row => row.some(c => c !== '' && c !== null && c !== undefined))
  .filter(row => {
    const nameIdx = headers.findIndex(h => h === '姓名' || h === '中文姓名');
    if (nameIdx < 0) return true;
    return row[nameIdx] && String(row[nameIdx]).trim();
  })
  .map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : ''; });
    return obj;
  });

console.log("Parsed data length:", csvData.length);
if (csvData.length === 0) {
  console.log("❌ 找不到有效資料行，請確認第一列是否為標題，並至少包含一筆資料");
} else {
  console.log("First row:", JSON.stringify(csvData[0]));
}
