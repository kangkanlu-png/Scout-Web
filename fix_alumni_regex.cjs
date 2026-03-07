const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf8');

let routeStart = code.indexOf("adminRoutes.get('/groups/:id/alumni'");
let nextRoute = code.indexOf("adminRoutes.post('/groups/:id/alumni'");
let block = code.substring(routeStart, nextRoute);

block = block.replace(/<div class="bg-white rounded-xl shadow overflow-hidden">[\s\S]*?\$\{tableRows[\s\S]*?<\/div>/, "${tablesHTML}");

code = code.substring(0, routeStart) + block + code.substring(nextRoute);

fs.writeFileSync('src/routes/admin.tsx', code);
console.log('Fixed alumni regex');
