const fs = require('fs');
const file = 'src/routes/member.tsx';
let code = fs.readFileSync(file, 'utf8');

// The error is because `a.category` displays "general", "training", etc. We should display the label.
const categoryLabelMap = `
  const categoryLabel: Record<string, string> = {
    general: '一般活動',
    tecc: 'TECC 急救',
    camping: '大露營',
    training: '訓練課程',
    service: '服務活動'
  };
`;

code = code.replace(
  'const renderActivityCard = (a: any) => {',
  categoryLabelMap + '\n  const renderActivityCard = (a: any) => {'
);

code = code.replace(
  '<span class="text-xs font-bold text-green-600 mb-1 block">${a.category}</span>',
  '<span class="text-xs font-bold text-green-600 mb-1 block">${categoryLabel[a.category] || a.category}</span>'
);

fs.writeFileSync(file, code);
console.log('Fixed member activity category label');
