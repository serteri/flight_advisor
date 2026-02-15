import fs from 'fs';
import path from 'path';

const FILE = path.resolve(__dirname, 'skyHostCache.json');

type HostEntry = { host: string; updatedAt: number };

let data: HostEntry | null = null;

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const raw = fs.readFileSync(FILE, 'utf8');
      data = JSON.parse(raw || 'null');
    }
  } catch (e) { data = null; }
}

function save() {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data || {}, null, 2), 'utf8');
  } catch (e) {}
}

load();

export function getCachedSkyHost() {
  return data?.host;
}

export function setCachedSkyHost(host: string) {
  data = { host, updatedAt: Date.now() };
  save();
}

export function clearCachedSkyHost() {
  data = null;
  try { fs.unlinkSync(FILE); } catch (e) {}
}
