import { FlightResult, FlightSource } from "@/types/hybridFlight";
import { resolveSkyPlaceIds } from "../skyPlaceResolver";
import fs from 'fs';
import path from 'path';
import { getCachedSkyHost, setCachedSkyHost } from '../hostCache';

export async function searchSkyScrapper(params: { 
  origin: string, 
  destination: string, 
  date: string, 
  currency?: string,
  cabinClass?: string,
  adults?: number
}): Promise<FlightResult[]> {
  const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY || 'a5019e6badmsh72c554c174620e5p18995ajsnd5606f30e000';
  const envHost = process.env.RAPID_API_HOST_SKY || process.env.RAPID_API_HOST || 'flights-sky.p.rapidapi.com';

  const hostCandidates = [
    envHost,
    'sky-scraper.p.rapidapi.com',
    'skyscanner-api.p.rapidapi.com',
    'skyscanner-search.p.rapidapi.com',
    'skyscanner.p.rapidapi.com',
    'flights-scraper.p.rapidapi.com'
  ];

  // If we have a cached working host, try it first
  const cachedHost = getCachedSkyHost();
  if (cachedHost) {
    // move cachedHost to front of candidates
    const idx = hostCandidates.indexOf(cachedHost);
    if (idx > 0) hostCandidates.splice(idx, 1);
    hostCandidates.unshift(cachedHost);
  }
  
    let targetDate = params.date.includes('T') ? params.date.split('T')[0] : params.date;
    if (targetDate.startsWith('2025')) targetDate = targetDate.replace('2025', '2026');

    // We'll try hosts in order until one returns pricingOptions. This keeps caller code simple.
    let finalItems: any[] = [];
    let usedHost = null as string | null;

    for (const candidateHost of hostCandidates) {
      try {
        const resolved = await resolveSkyPlaceIds(params.origin, params.destination, targetDate, apiKey, candidateHost);
        const placeIdFrom = resolved.from;
        const placeIdTo = resolved.to;

        // perform same search logic but scoped to this candidate host
        // Some RapidAPI hosts (e.g., Sky Scrapper / Air Scraper) expose a different API shape.
        const isSkyScrapper = /sky-?scrapp|flights-?scraper|air-?scraper/i.test(candidateHost);
        const searchUrl = isSkyScrapper ? `https://${candidateHost}/api/v1/flights/searchFlights` : `https://${candidateHost}/web/flights/search-one-way`;
        const incompleteUrl = isSkyScrapper ? undefined : `https://${candidateHost}/web/flights/search-incomplete`;

        // perform search
        const cabin = (params.cabinClass || 'ECONOMY').toUpperCase();
        const adultCount = (params.adults || 1).toString();
        const currency = params.currency || 'AUD';
        const market = currency === 'AUD' ? 'AU' : 'US';

        const queryParams = new URLSearchParams({
          placeIdFrom: placeIdFrom,
          placeIdTo: placeIdTo,
          departDate: targetDate,
          market: market,
          locale: 'en-US',
          currency: currency,
          adults: adultCount,
          cabinClass: cabin
        });

        console.log(`🚀 Trying host ${candidateHost} -> ${searchUrl}?${queryParams.toString()}`);

        let res;
        let json: any = null;
        if (isSkyScrapper) {
          // Sky Scrapper expects POST JSON body
          const body = {
            originSkyId: placeIdFrom,
            destinationSkyId: placeIdTo,
            date: targetDate,
            adults: adultCount,
            cabinClass: cabin,
            currency: currency,
            market: market
          };
          try {
            res = await fetch(searchUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': candidateHost },
              body: JSON.stringify(body)
            });
          } catch (e) {
            console.warn('Host', candidateHost, 'POST failed', e);
            continue;
          }
        } else {
          try {
            res = await fetch(`${searchUrl}?${queryParams.toString()}`, {
              method: 'GET',
              headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': candidateHost }
            });
          } catch (e) {
            console.warn('Host', candidateHost, 'GET failed', e);
            continue;
          }
        }

        if (!res || !res.ok) {
          console.warn('Host', candidateHost, 'returned status', res?.status);
          continue;
        }

        try { json = await res.json(); } catch(e) { json = null; }
        try { const raw = JSON.stringify(json); if (process.env.NODE_ENV !== 'production') console.log(`🔍 Raw Sky response (trimmed 1k): ${raw.slice(0,1000)}`); } catch(e){}

        let allItems: any[] = [];
        let status = 'complete';
        let sessionId: string | undefined = undefined;
        let loopCount = 0;

        if (isSkyScrapper) {
          // Sky Scrapper response shape may differ
          allItems = json?.data?.results || json?.results || json?.data || [];
          // try to find sessionId if present
          sessionId = json?.data?.sessionId || json?.sessionId || undefined;
          status = json?.data?.context?.status || json?.status || (Array.isArray(allItems) && allItems.length ? 'complete' : 'complete');
        } else {
          allItems = extractFlights(json);
          status = json.data?.context?.status || 'complete';
          sessionId = json.data?.context?.sessionId;

          while (status === 'incomplete' && sessionId && loopCount < 6) {
            loopCount++;
            await new Promise(r => setTimeout(r, 1000));
            res = await fetch(`https://${candidateHost}/web/flights/search-incomplete?sessionId=${sessionId}`, {
              method: 'GET',
              headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': candidateHost }
            });
            if (!res.ok) break;
            json = await res.json();
            const newItems = extractFlights(json);
            if (newItems.length) allItems = [...allItems, ...newItems];
            status = json.data?.context?.status || 'complete';
          }
        }

        // dedupe
        const uniqueItems = Array.from(new Map(allItems.map(item => [item.id, item])).values());

        // attempt pricing fetch (same logic as previous)
        const pricingIds = Array.from(new Set(uniqueItems.map((it: any) => it.price?.pricingOptionId || it.pricingOptionId).filter(Boolean)));
        let attachedCount = 0;
        if (sessionId && pricingIds.length > 0) {
          const pricingMap = await (async () => {
            const outMap: Record<string, any[]> = {};
            const endpoints = [
              '/web/flights/pricing',
              '/web/flights/offers',
              '/web/flights/pricing-options',
              '/web/flights/offer-pricing',
              '/web/flights/pricing-v2',
              '/web/flights/search-pricing',
              '/web/flights/booking-options'
            ];
            for (const ep of endpoints) {
              try {
                const url = `https://${candidateHost}${ep}`;
                const body = { sessionId, pricingOptionIds: pricingIds };
                const pres = await fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': candidateHost },
                  body: JSON.stringify(body)
                });
                if (!pres.ok) continue;
                const pjson = await pres.json();
                const candidates = pjson.data?.pricingOptions || pjson.pricingOptions || pjson.data?.offers || pjson.offers || pjson.data?.pricing || null;
                if (Array.isArray(candidates) && candidates.length > 0) {
                  for (const opt of candidates) {
                    const id = opt.pricingOptionId || opt.id || opt.pricingId || (opt.pricingOptionId && opt.pricingOptionId.toString());
                    if (!id) continue;
                    const agents = [] as any[];
                    if (Array.isArray(opt.agents)) for (const a of opt.agents) agents.push(a);
                    else if (opt.agent) agents.push(opt.agent);
                    else if (Array.isArray(opt.items)) for (const it of opt.items) if (it.agent) agents.push(it.agent);
                    outMap[id.toString()] = agents;
                  }
                  return outMap;
                }
              } catch (e) { continue; }
            }
            return outMap;
          })();

          if (Object.keys(pricingMap).length > 0) {
            for (const it of uniqueItems) {
              const pid = it.price?.pricingOptionId || it.pricingOptionId;
              if (pid && pricingMap[pid]) {
                it.pricingOptions = pricingMap[pid];
                attachedCount++;
              }
            }
          }
        }

        console.log(`Host ${candidateHost} produced ${uniqueItems.length} items, attached pricing: ${attachedCount}`);

        // if we attached any pricingOptions, consider this host working
        if (attachedCount > 0) {
          usedHost = candidateHost;
          finalItems = uniqueItems;
          setCachedSkyHost(candidateHost);
          break;
        }

        // otherwise keep the items as fallback but continue trying other hosts
        if (finalItems.length === 0) finalItems = uniqueItems;

      } catch (e) {
        console.warn('Error probing host', candidateHost, e);
        continue;
      }
    }

    // if no host set, fall back to envHost behavior
    const placeIdResult = finalItems && finalItems.length > 0 ? finalItems : [];
    // continue below to mapping using finalItems

  // Map finalItems to FlightResult
  try {
    const cabin = (params.cabinClass || 'ECONOMY').toUpperCase();
    const currency = params.currency || 'AUD';
    const uniqueItems = Array.from(new Map((finalItems || []).map(item => [item.id, item])).values());

    console.log(`✅ TOPLAM SONUÇ: ${uniqueItems.length} benzersiz uçuş bulundu! 🎉`);

    try {
      if (process.env.NODE_ENV !== 'production') {
        const debugDir = path.resolve(__dirname, '..', '..', 'tmp');
        try { fs.mkdirSync(debugDir, { recursive: true }); } catch(e){}
        const itemsF = path.join(debugDir, `sky_aggregated_items_${Date.now()}.json`);
        try { fs.writeFileSync(itemsF, JSON.stringify(uniqueItems, null, 2)); console.log('🗂️ Saved aggregated items to', itemsF); } catch(e){}
      }
    } catch (e) {}

    const withPricing = uniqueItems.filter((it: any) => Array.isArray(it.pricingOptions) && it.pricingOptions.length > 0).length;
    console.log(`🧾 Sky: ${withPricing}/${uniqueItems.length} offers include pricingOptions`);

    return uniqueItems.map((item: any) => {
      const agents = item.pricingOptions?.map((opt: any) => ({
        name: opt.agent?.name,
        price: opt.price?.amount,
        image: opt.agent?.imageUrl,
        url: opt.items?.[0]?.url
      })) || [];

      agents.sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
      const bestAgentWithUrl = agents.find((a: any) => a.url && a.url.startsWith('http'));
      const firstLeg = item.legs?.[0];

      return {
        id: `SKY_${item.id || Math.random()}`,
        source: 'SKY_SCANNER_PRO' as FlightSource,
        airline: firstLeg?.carriers?.marketing?.[0]?.name || "Airline",
        airlineLogo: firstLeg?.carriers?.marketing?.[0]?.logoUrl,
        flightNumber: firstLeg?.carriers?.marketing?.[0]?.alternateId || "FLY",

        from: params.origin,
        to: params.destination,
        departTime: firstLeg?.departure,
        arriveTime: firstLeg?.arrival,
        duration: firstLeg?.durationInMinutes || 0,
        stops: firstLeg?.stopCount || 0,

        price: agents[0]?.price || item.price?.raw || 0,
        currency: currency,
        cabinClass: cabin.toLowerCase() as any,

        bookingProviders: agents.map((a: any) => ({
          name: a.name || 'Unknown',
          price: a.price || 0,
          currency: currency,
          link: a.url || '',
          logo: a.image,
          type: 'agency' as const
        })),

        deepLink: bestAgentWithUrl ? bestAgentWithUrl.url : undefined,
        bookingLink: bestAgentWithUrl ? bestAgentWithUrl.url : undefined
      };
    });

  } catch (error: any) {
    console.error("🔥 CATCH HATASI:", error.message);
    return [];
  }
}

// 🕵️‍♂️ YARDIMCI FONKSİYON: JSON'dan Uçuşları Çıkarır
function extractFlights(json: any) {
    let items: any[] = [];
    const itineraries = json.data?.itineraries || json.itineraries;

    if (itineraries) {
        // Bucket yapısı
        if (itineraries.buckets && Array.isArray(itineraries.buckets)) {
            itineraries.buckets.forEach((bucket: any) => {
                if (bucket.items && Array.isArray(bucket.items)) {
                    items.push(...bucket.items);
                }
            });
        } 
        // Results Listesi
        else if (itineraries.results && Array.isArray(itineraries.results)) {
            items = itineraries.results;
        } 
        // Direkt Liste
        else if (Array.isArray(itineraries)) {
            items = itineraries;
        }
    }
    return items;
}

export async function searchAirScraper(params: any) {
    return []; // Placeholder
}
