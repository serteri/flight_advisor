
const airports = require('airports');
console.log("Count:", airports.length);
if (airports.length > 0) {
    console.log("Sample:", JSON.stringify(airports[0], null, 2));
}
