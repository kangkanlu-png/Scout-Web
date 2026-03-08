async function test() {
  const res = await fetch('https://scout-management.pages.dev');
  console.log(res.status);
  const text = await res.text();
  console.log(text.substring(0, 500));
}
test();
