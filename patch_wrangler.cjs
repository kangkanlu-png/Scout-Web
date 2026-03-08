const fs = require('fs');
let code = fs.readFileSync('wrangler.jsonc', 'utf-8');

if (!code.includes('r2_buckets')) {
  code = code.replace(`
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "scout-management-production",
      "database_id": "001fb707-f2b9-4790-90bd-03a6be67c7e9"
    }
  ]
}`, `
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "scout-management-production",
      "database_id": "001fb707-f2b9-4790-90bd-03a6be67c7e9"
    }
  ],
  "r2_buckets": [
    {
      "binding": "R2",
      "bucket_name": "scout-management-bucket"
    }
  ]
}`);
  fs.writeFileSync('wrangler.jsonc', code);
  console.log('Restored r2_buckets to wrangler.jsonc');
}
