const XLSX = require('xlsx');
const fs = require('fs');

const fileBuffer = fs.readFileSync('/home/user/uploaded_files/成員匯入範例-114.xlsx');

const raw = (function() {
  try {
    const wb = XLSX.read(fileBuffer, { type: 'buffer', cellDates: false, raw: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    return rows;
  } catch(err) { 
    console.error("XLSX read error:", err);
    return null;
  }
})();

console.log("Raw length:", raw ? raw.length : "null");

if (raw && raw.length > 0) {
  console.log("First row:", raw[0]);
  console.log("Second row:", raw[1]);
  console.log("Third row:", raw[2]);
}

const KNOWN_HEADERS = new Set(['姓名','中文姓名','英文名','英文姓名','身分證號','生日','性別','童軍階段','童軍進程','電話','小隊','職務','團次','Name','Chinese Name']);
let headerIdx = -1;
for (let i = 0; i < Math.min(6, raw.length); i++) {
  if (raw[i].some(c => KNOWN_HEADERS.has(String(c).trim()))) {
    headerIdx = i; break;
  }
}
console.log("Detected header index:", headerIdx);

if (headerIdx >= 0) {
  const headers = raw[headerIdx].map(h => String(h).trim());
  console.log("Headers:", headers);
}

