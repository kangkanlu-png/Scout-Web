async function main() {
  const res = await fetch('http://localhost:3000/api/activities/20', { method: 'DELETE' });
  console.log(res.status);
  console.log(await res.text());
}
main();
