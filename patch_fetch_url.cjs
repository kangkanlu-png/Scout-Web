const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf-8');

// The route in api.tsx is /api/activities/:id/images, not /api/admin/activities/:id/images
code = code.replace(
  `const saveRes = await fetch('/api/admin/activities/' + activityId + '/images', {`,
  `const saveRes = await fetch('/api/activities/' + activityId + '/images', {`
);

fs.writeFileSync('src/routes/admin.tsx', code);
console.log('Fixed API fetch URL for saving images');
