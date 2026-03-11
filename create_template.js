const XLSX = require('xlsx');

const wb = XLSX.utils.book_new();
const wsData = [
  ['member_id', 'username', 'password'],
  ['1', 'scout01', 'password123'],
  ['2', 'scout02', 'password123']
];
const ws = XLSX.utils.aoa_to_sheet(wsData);
XLSX.utils.book_append_sheet(wb, ws, "Accounts");
XLSX.writeFile(wb, "public/static/accounts_import_template.xlsx");
console.log("Template created.");
