const fs = require('fs');
let config = fs.readFileSync('wrangler.jsonc', 'utf8');
// remove r2_buckets block
config = config.replace(/,\s*"r2_buckets":\s*\[[\s\S]*?\]/, "");
fs.writeFileSync('wrangler.jsonc', config);
