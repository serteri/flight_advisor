import dotenv from 'dotenv';

dotenv.config();

const mask = (s?: string) => {
  if (!s) return '<missing>';
  if (s.length <= 12) return s;
  return `${s.slice(0, 8)}...${s.slice(-4)}`;
};

const required = [
  { name: 'DUFFEL_ACCESS_TOKEN', val: process.env.DUFFEL_ACCESS_TOKEN },
  { name: 'RAPID_API_KEY_SKY', val: process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY },
  { name: 'DATABASE_URL', val: process.env.DATABASE_URL },
];

let ok = true;
console.info('Preflight env check:');
for (const r of required) {
  if (r.val) {
    console.info(` - ${r.name}: ${mask(r.val)}`);
  } else {
    console.error(` - ${r.name}: MISSING`);
    ok = false;
  }
}

if (!ok) {
  console.error('One or more required environment variables are missing. Failing preflight.');
  process.exit(1);
}

console.info('Env preflight OK.');
