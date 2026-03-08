const fs = require('fs');
let code = fs.readFileSync('src/routes/admin.tsx', 'utf-8');

const facebookField = `        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Facebook 網址</label>
          <input type="url" name="facebook_url" value="\${settings.facebook_url || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
        </div>`;

const instagramField = `        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Facebook 網址</label>
          <input type="url" name="facebook_url" value="\${settings.facebook_url || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Instagram 網址</label>
          <input type="url" name="instagram_url" value="\${settings.instagram_url || ''}" class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
        </div>`;

code = code.replace(facebookField, instagramField);
fs.writeFileSync('src/routes/admin.tsx', code);
console.log('Added instagram_url to settings form');
