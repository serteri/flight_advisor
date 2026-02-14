import fs from 'fs';
import path from 'path';

type CacheMap = Record<string, { from: string; to: string }>;

const CACHE_FILE = path.resolve(__dirname, 'placeIdCache.json');

let cache: CacheMap = {};

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf8');
      cache = JSON.parse(raw || '{}');
    }
  } catch (e) {
    // ignore parse errors
    cache = {};
  }
}

function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (e) {
    // ignore write errors
  }
}

loadCache();

export function getCachedPlaceIds(origin: string, destination: string) {
  const key = `${origin.toUpperCase()}->${destination.toUpperCase()}`;
  return cache[key];
}

export function setCachedPlaceIds(origin: string, destination: string, from: string, to: string) {
  const key = `${origin.toUpperCase()}->${destination.toUpperCase()}`;
  cache[key] = { from, to };
  // best-effort persist
  saveCache();
}

export function clearCache() {
  cache = {};
  saveCache();
}

export function inspectCache() {
  return cache;
}
