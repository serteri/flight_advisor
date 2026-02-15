import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const KEY = process.env.RAPID_API_KEY || process.env.RAPID_API_KEY_SKY;
const HOST = 'flights-scraper-real-time.p.rapidapi.com';

if (!KEY) {
  console.error('RAPID_API_KEY not set');
  process.exit(1);
}

const paths = [
  '/',
  '/status',
  '/search',
  '/flights',
  '/flights/search',
  '/api/search',
  '/api/flights',
  '/api/v1/search',
  '/api/v1/flights',
  '/api/v1/flights/search',
  '/v1/search',
  '/v1/flights',
  '/v2/search',
  '/v2/flights',
  '/get-flights',
  '/flight/search'
];

const origin = 'BNE';
const dest = 'IST';
const date = '2026-03-15';

async function probe() {
  console.log(`Probing POST ${HOST} with key ...${KEY!.slice(-4)}`);
  
  for (const p of paths) {
    const body = {
      from: origin,
      to: dest,
      date: date,
      adults: 1,
      currency: 'USD',
      locale: 'en-US'
    };
    
    const url = `https://${HOST}${p}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': KEY!,
          'X-RapidAPI-Host': HOST
        },
        body: JSON.stringify(body)
      });
      console.log(`POST ${p} -> ${res.status}`);
      if (res.ok) {
        console.log('SUCCESS! Payload:', await res.text());
        return; 
      }
    } catch (e: any) {
      console.log(`POST ${p} -> Error: ${e.message}`);
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
}

probe();
