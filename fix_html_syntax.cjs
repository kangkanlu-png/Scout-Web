const fs = require('fs');
const file = 'src/routes/admin.tsx';
let code = fs.readFileSync(file, 'utf8');

// The issue is using literal string interpolation in a TSX string template
// Let's fix the escaping

code = code.replace(
  "previewArea.innerHTML += `<div class=\"aspect-square bg-gray-100 rounded overflow-hidden border relative\">\n              <img src=\"${ev.target.result}\" class=\"w-full h-full object-cover\">\n              <div class=\"absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 truncate\">${file.name}</div>\n            </div>`;",
  "previewArea.innerHTML += '<div class=\"aspect-square bg-gray-100 rounded overflow-hidden border relative\"><img src=\"' + ev.target.result + '\" class=\"w-full h-full object-cover\"><div class=\"absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 truncate\">' + file.name + '</div></div>';"
);

fs.writeFileSync(file, code);
