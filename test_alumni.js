const http = require('http');

async function test() {
  const res = await fetch('http://127.0.0.1:3000/admin/groups/1/alumni', {
    headers: {
      'Cookie': 'admin_session=test' // wait, admin requires a proper cookie or I can bypass it.
    }
  });
  console.log(res.status);
  const text = await res.text();
  console.log(text.includes('歷屆名單'));
}
test();
