import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const KEY = process.env.RAPID_API_KEY || process.env.RAPID_API_KEY_SKY;
if (!KEY) {
  console.error('RAPID_API_KEY not set');
  process.exit(1);
}

const hosts = [
  process.env.RAPID_API_HOST_SKY || 'sky-scrapper.p.rapidapi.com',
  'sky-scraper.p.rapidapi.com',
  'sky-scrapper.p.rapidapi.com',
  'skyscanner-api.p.rapidapi.com',
  'skyscanner-search.p.rapidapi.com',
  'skyscanner.p.rapidapi.com',
  'flights-scraper.p.rapidapi.com',
  'air-scraper.p.rapidapi.com',
  'apiheya-sky-scrapper.p.rapidapi.com',
  'sky-scrapper-api.p.rapidapi.com'
];

const endpointsGet = [
  '/web/flights/search-one-way',
  '/web/flights/search',
  '/api/v1/flights/searchFlights',
  '/api/v1/flights/search',
  '/api/v1/searchFlights',
  '/api/v1/flights/searchFlights',
  '/api/flights/search',
  '/v1/flights/search'
];

const endpointsPost = [
  '/api/v1/flights/searchFlights',
  '/api/v1/flights/search',
  '/web/flights/pricing',
  '/web/flights/offers',
  '/api/v1/flights/pricing',
  '/api/v1/flights/offers'
];

const origin = process.argv[2] || 'BNE';
const dest = process.argv[3] || 'IST';
const date = process.argv[4] || new Date().toISOString().slice(0,10);

const outDir = path.resolve(__dirname, '..', 'services', 'tmp', 'host-scan');
fs.mkdirSync(outDir, { recursive: true });

async function tryGet(host: string, ep: string) {
  const url = `https://${host}${ep}`;
  const params = new URLSearchParams({ placeIdFrom: origin, placeIdTo: dest, departDate: date, market: 'AU', locale: 'en-US', currency: 'AUD', adults: '1', cabinClass: 'ECONOMY' });
  try {
    const res = await fetch(`${url}?${params.toString()}`, { method: 'GET', headers: { 'X-RapidAPI-Key': KEY, 'X-RapidAPI-Host': host } });
    const text = await res.text();
    const fname = path.join(outDir, `${host.replace(/\W+/g,'_')}${ep.replace(/\W+/g,'_')}_get_${res.status}.json`);
    fs.writeFileSync(fname, text);
    return { host, ep, status: res.status, fname };
  } catch (e: any) {
    return { host, ep, status: 'ERR', fname: '' };
  }
}

async function tryPost(host: string, ep: string) {
  const url = `https://${host}${ep}`;
  const body = { originSkyId: origin, destinationSkyId: dest, date, adults: 1, cabinClass: 'ECONOMY', currency: 'AUD', market: 'AU' };
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RapidAPI-Key': KEY, 'X-RapidAPI-Host': host }, body: JSON.stringify(body) });
    const text = await res.text();
    const fname = path.join(outDir, `${host.replace(/\W+/g,'_')}${ep.replace(/\W+/g,'_')}_post_${res.status}.json`);
    fs.writeFileSync(fname, text);
    return { host, ep, status: res.status, fname };
  } catch (e: any) {
    return { host, ep, status: 'ERR', fname: '' };
  }
}

(async () => {
  const results: any[] = [];
  for (const host of hosts) {
    for (const ep of endpointsGet) {
      const r = await tryGet(host, ep);
      console.log('GET', r.host, ep, r.status, r.fname);
      results.push(r);
      await new Promise(r => setTimeout(r, 300));
    }
    for (const ep of endpointsPost) {
      const r = await tryPost(host, ep);
      console.log('POST', r.host, ep, r.status, r.fname);
      results.push(r);
      await new Promise(r => setTimeout(r, 300));
    }
  }
  console.log('Scan complete. Results saved to', outDir);
  process.exit(0);
})();
