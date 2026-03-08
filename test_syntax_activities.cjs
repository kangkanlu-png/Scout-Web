const fs = require('fs');
const html = fs.readFileSync('test_activities.html', 'utf-8');
const cheerio = require('cheerio');
const $ = cheerio.load(html);
if (html.includes('500 Internal Server Error')) {
  console.log('500 Internal Server Error found in output');
}
$('script').each((i, el) => {
  const content = $(el).html();
  if (content) {
    try {
      new (require('vm').Script)(content);
    } catch(e) {
      console.log(`Script ${i} syntax error:`, e.message);
      const lines = content.split('\n');
      console.log(e.stack.split('\n').slice(0, 3).join('\n'));
    }
  }
});
