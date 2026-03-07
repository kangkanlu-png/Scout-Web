const fs = require('fs');
const file = 'src/routes/member.tsx';
let code = fs.readFileSync(file, 'utf8');

// The issue with the upcoming/past logic is that activity_date might be null or empty string, or it uses date_display
// Also, the isRegOpen condition might be false if `a.is_registration_open` is 0, but we still want to show the activity without the register button.
// Actually `a.is_registration_open` could be integer 1 or 0.
// Let's modify the separation logic to check if registration is open OR if activity_date >= today
const separationLogicOld = `  activities.results.forEach((a: any) => {
    if (a.activity_date >= today) upcoming.push(a)
    else past.push(a)
  })`;

const separationLogicNew = `  activities.results.forEach((a: any) => {
    const isUpcoming = 
      (a.activity_date && a.activity_date >= today) || 
      (a.activity_end_date && a.activity_end_date >= today) ||
      (!a.activity_date && !a.activity_end_date && a.is_registration_open === 1) || 
      (a.is_registration_open === 1 && a.registration_end && new Date(a.registration_end) >= new Date()) ||
      a.activity_status === 'active';
      
    if (isUpcoming) upcoming.push(a)
    else past.push(a)
  })`;

code = code.replace(separationLogicOld, separationLogicNew);

fs.writeFileSync(file, code);
console.log('Fixed member activity past/upcoming split');
