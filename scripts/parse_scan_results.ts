import fs from 'fs';
import path from 'path';

const scanDir = path.resolve(__dirname, '..', 'services', 'tmp', 'host-scan');

if (!fs.existsSync(scanDir)) {
  console.log('Scan directory not found:', scanDir);
  process.exit(0);
}

const files = fs.readdirSync(scanDir).filter(f => f.endsWith('.json'));
console.log(`Scanning ${files.length} files in ${scanDir}...`);

let found = 0;

files.forEach(f => {
  const content = fs.readFileSync(path.join(scanDir, f), 'utf-8');
  // Check for interesting keys
  if (content.includes('pricingOptions') || 
      content.includes('deep_link') || 
      content.includes('"agent"') || 
      content.includes('"carriers"') ||
      content.includes('"itineraries"')) {
        
    try {
      const json = JSON.parse(content);
      // Filter out error responses
      if (json.message || json.status === 404 || json.status === 429 || json.status === 500) {
        return; 
      }
      
      console.log(`\nFound potential match in: ${f}`);
      const keys = Object.keys(json);
      console.log(`Top-level keys: ${keys.join(', ')}`);
      
      if (json.itineraries) {
        console.log(` - Itineraries found: ${json.itineraries.length}`);
        if (json.itineraries.length > 0) {
           const first = json.itineraries[0];
           console.log(` - Sample Itinerary keys: ${Object.keys(first).join(', ')}`);
           if (first.pricingOptions) {
             console.log(` - PricingOptions found: ${first.pricingOptions.length}`);
           }
        }
      }
      
      found++;
    } catch (e) {
      // ignore parse errors
    }
  }
});

if (found === 0) {
  console.log('\nNo valid pricing/itinerary data found in any response.');
} else {
  console.log(`\nFound ${found} files with potential data.`);
}
