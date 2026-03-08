const fs = require('fs');

// --- update admin.tsx ---
let adminCode = fs.readFileSync('src/routes/admin.tsx', 'utf-8');

// Update categoryLabel
adminCode = adminCode.replace(
  "general: '一般活動', tecc: 'TECC 急救', camping: '大露營', training: '訓練課程', service: '服務活動'",
  "general: '一般活動', tecc: 'TECC 急救', camping: '大露營', training: '訓練課程', service: '服務活動', national_day: '國慶服務活動'"
);

// Update categories array in activityForm
const oldCategories = `    { value: 'service', label: '服務活動' },
  ]`;
const newCategories = `    { value: 'service', label: '服務活動' },
    { value: 'national_day', label: '國慶服務活動' },
  ]`;
adminCode = adminCode.replace(oldCategories, newCategories);

fs.writeFileSync('src/routes/admin.tsx', adminCode);

// --- update frontend.tsx ---
let frontendCode = fs.readFileSync('src/routes/frontend.tsx', 'utf-8');

// Update cats array
const oldCats = `    { id: 'general', name: '一般活動', icon: '⚜️' }
  ];`;
const newCats = `    { id: 'general', name: '一般活動', icon: '⚜️' },
    { id: 'national_day', name: '國慶服務', icon: '🇹🇼' }
  ];`;
frontendCode = frontendCode.replace(oldCats, newCats);

// Update categoryLabel
const oldCategoryLabel = `    service: '服務活動',
  }`;
const newCategoryLabel = `    service: '服務活動',
    national_day: '國慶服務活動',
  }`;
frontendCode = frontendCode.replace(oldCategoryLabel, newCategoryLabel);

// Update categoryColor
const oldCategoryColor = `    service: 'bg-purple-100 text-purple-800',
  }`;
const newCategoryColor = `    service: 'bg-purple-100 text-purple-800',
    national_day: 'bg-indigo-100 text-indigo-800',
  }`;
frontendCode = frontendCode.replace(oldCategoryColor, newCategoryColor);

fs.writeFileSync('src/routes/frontend.tsx', frontendCode);
console.log('Categories updated!');
