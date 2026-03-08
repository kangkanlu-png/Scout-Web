const fs = require('fs');
const XLSX = require('xlsx');

try {
  console.log('Testing 114 file...');
  const file114 = fs.readFileSync('/home/user/uploaded_files/114年資料-格式輸入.xlsx');
  const wb114 = XLSX.read(file114, { type: 'buffer' });
  const ws114 = wb114.Sheets[wb114.SheetNames[0]];
  const data114 = XLSX.utils.sheet_to_json(ws114, { header: 1 });
  console.log(`114 file rows: ${data114.length}`);
  if (data114.length > 0) {
    console.log(`Header 114: ${JSON.stringify(data114[0])}`);
  }
} catch (e) {
  console.error('Error reading 114:', e);
}

try {
  console.log('\nTesting 115 file...');
  const file115 = fs.readFileSync('/home/user/uploaded_files/115年資料-格式輸入.xlsx');
  const wb115 = XLSX.read(file115, { type: 'buffer' });
  const ws115 = wb115.Sheets[wb115.SheetNames[0]];
  const data115 = XLSX.utils.sheet_to_json(ws115, { header: 1 });
  console.log(`115 file rows: ${data115.length}`);
  if (data115.length > 0) {
    console.log(`Header 115: ${JSON.stringify(data115[0])}`);
  }
} catch (e) {
  console.error('Error reading 115:', e);
}
