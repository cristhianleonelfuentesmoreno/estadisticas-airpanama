const fs = require('fs');
const content = fs.readFileSync('app/dashboard/page.tsx', 'utf8');
console.log(content.substring(content.indexOf('fetchUser ='), content.indexOf('fetchFlightStats')));
