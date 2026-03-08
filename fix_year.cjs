const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

// The line `const currentYear = yearParam || yearSetting?.value || '114'` should pick the max year from enrollments instead of the default setting if no yearParam is given, or at least we should get all years and pick the max one.
// Actually, let's see how yearRange is constructed:
