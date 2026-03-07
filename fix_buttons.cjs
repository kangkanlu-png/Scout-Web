const fs = require('fs');
let code = fs.readFileSync('src/routes/frontend.tsx', 'utf8');

// Combine FB and IG buttons inside one div.mt-6 flex flex-wrap gap-4
code = code.replace(
  /\$\{settings\.facebook_url \? `\n\s*<div class="mt-6">\n\s*<a href="\$\{settings\.facebook_url\}"[^>]*>\n\s*<i class="fab fa-facebook"><\/i> 追蹤我們的 Facebook\n\s*<\/a>\n\s*<\/div>\n\s*` : ''\}\n\s*\$\{settings\.instagram_url \? `\n\s*<div class="mt-6">\n\s*<a href="\$\{settings\.instagram_url\}"[^>]*>\n\s*<i class="fab fa-instagram"><\/i> 追蹤我們的 Instagram\n\s*<\/a>\n\s*<\/div>\n\s*` : ''\}/,
  `<div class="mt-6 flex flex-wrap gap-4">
          \${settings.facebook_url ? \`
            <a href="\${settings.facebook_url}" target="_blank" class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg transition-colors">
              <i class="fab fa-facebook"></i> 追蹤我們的 Facebook
            </a>
          \` : ''}
          \${settings.instagram_url ? \`
            <a href="\${settings.instagram_url}" target="_blank" class="inline-flex items-center gap-2 bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:from-pink-600 hover:via-red-600 hover:to-yellow-600 text-white px-5 py-2.5 rounded-lg transition-colors">
              <i class="fab fa-instagram"></i> 追蹤我們的 Instagram
            </a>
          \` : ''}
        </div>`
);

fs.writeFileSync('src/routes/frontend.tsx', code);
