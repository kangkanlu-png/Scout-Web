const fs = require('fs');

let content = fs.readFileSync('src/routes/admin.tsx', 'utf8');

const oldScript = `        const headers = dataArray[0].map(h => String(h).trim().replace(/^"|"$/g, ''));
        const idIdx = headers.indexOf('member_id');
        const userIdx = headers.indexOf('username');
        const pwIdx = headers.indexOf('password');
        
        if (idIdx === -1 || userIdx === -1 || pwIdx === -1) {
          alert('找不到必要的欄位，請確保包含 member_id, username, password');
          return;
        }`;

const newScript = `        const headers = dataArray[0].map(h => String(h).trim().replace(/^"|"$/g, ''));
        // Support multiple possible header names for flexibility
        let idIdx = headers.findIndex(h => h === 'member_id' || h === 'ID');
        let nameIdx = headers.findIndex(h => h === '學員姓名' || h === '姓名' || h === '中文姓名');
        const userIdx = headers.findIndex(h => h === 'username' || h === '帳號' || h === '登入帳號');
        const pwIdx = headers.findIndex(h => h === 'password' || h === '密碼' || h === '登入密碼');
        
        if (userIdx === -1 || pwIdx === -1) {
          alert('找不到登入帳號或密碼欄位，請確保包含 username/登入帳號 和 password/密碼');
          return;
        }
        if (idIdx === -1 && nameIdx === -1) {
          alert('找不到 member_id 或 姓名 欄位，無法對應成員');
          return;
        }`;

const oldLoop = `          const record = {
            member_id: String(cols[idIdx]).trim(),
            username: String(cols[userIdx]).trim(),
            password: String(cols[pwIdx]).trim()
          };`;

const newLoop = `          const record = {
            member_id: idIdx !== -1 ? String(cols[idIdx]).trim() : null,
            name: nameIdx !== -1 ? String(cols[nameIdx]).trim() : null,
            username: String(cols[userIdx]).trim(),
            password: String(cols[pwIdx]).trim()
          };`;

// We also need to fix the preview HTML and how the backend handles 'name' instead of just 'member_id'
