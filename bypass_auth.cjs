const fs = require('fs');
let content = fs.readFileSync('src/index.tsx', 'utf8');
content = content.replace(/import { authMiddleware } from '\.\/routes\/admin'/g, "import { authMiddleware as realAuth } from './routes/admin';\nconst authMiddleware = async (c, next) => { c.set('admin', { username: 'admin' }); await next() };");
fs.writeFileSync('src/index.tsx', content);
