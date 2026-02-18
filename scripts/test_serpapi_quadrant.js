const fs = require("fs");

function readEnvKey(key) {
  const env = fs.readFileSync(".env", "utf8");
  const match = new RegExp(`^${key}=(.+)$`, "m").exec(env);
  if (!match) return "";
  return match[1].trim().replace(/^"|"$/g, "");
}

const API_KEY = readEnvKey("SERPAPI_KEY");
if (!API_KEY) {
  console.error("Missing SERPAPI_KEY in .env");
  process.exit(1);
}

const params = { origin: "BNE", destination: "IST", date: "2026-03-25" };
const settings = { currency: "AUD", country: "au" };

function buildUrl(gl, currency) {
  const u = new URL("https://serpapi.com/search.json");
  u.searchParams.set("engine", "google_flights");
  u.searchParams.set("departure_id", params.origin);
  u.searchParams.set("arrival_id", params.destination);
  u.searchParams.set("outbound_date", params.date);
  u.searchParams.set("currency", currency);
  u.searchParams.set("hl", "en");
  u.searchParams.set("gl", gl);
  u.searchParams.set("api_key", API_KEY);
  u.searchParams.set("type", "2");
  u.searchParams.set("travel_class", "1");
  u.searchParams.set("deep_search", "true");
  u.searchParams.set("show_hidden", "true");
  u.searchParams.set("stops", "0");
  u.searchParams.set("adults", "1");
  return u.toString();
}

async function run() {
  const tests = [
    { label: "LOCAL", gl: settings.country, currency: settings.currency },
    { label: "US", gl: "us", currency: "USD" }
  ];

  for (const test of tests) {
    const res = await fetch(buildUrl(test.gl, test.currency));
    const json = await res.json();
    if (json.error) {
      console.log(`[${test.label}] error: ${json.error}`);
      continue;
    }
    const best = Array.isArray(json.best_flights) ? json.best_flights : [];
    const other = Array.isArray(json.other_flights) ? json.other_flights : [];
    const main = Array.isArray(json.flights) ? json.flights : [];
    const total = best.length + other.length + main.length;
    console.log(`[${test.label}] best:${best.length} other:${other.length} main:${main.length} total:${total}`);
  }
}

run().catch((e) => {
  console.error("Test failed", e);
  process.exit(1);
});
