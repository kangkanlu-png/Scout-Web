const fs = require('fs');
let code = fs.readFileSync('src/routes/frontend.tsx', 'utf8');

const regex = /<div id="pane-rover" class="tab-pane hidden">[\s\S]*?<!-- ====== END TAB ====== -->/;
// wait, we don't have END TAB. Let's see what is after pane-rover.
