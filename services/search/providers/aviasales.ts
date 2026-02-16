import { FlightResult, FlightSource } from "@/types/hybridFlight";
import * as crypto from 'crypto'; // MD5 signature için

const TP_TOKEN = process.env.TRAVELPAYOUTS_TOKEN || '31769c19fe387c3aebfcc0bbb5aadcdb';
const TP_MARKER = process.env.TRAVELPAYOUTS_MARKER || '701049';

export async function searchAviasales(params: {
  origin: string;
  destination: string;
  date: string;
  currency?: string;
  adults?: number;
  cabin?: string;
}): Promise<FlightResult[]> {
  console.log(`🦁 Aviasales LIVE Search: ${params.origin} → ${params.destination}`);

  try {
    const dateStr = params.date.includes('T') ? params.date.split('T')[0] : params.date;
    
    const adults = parseInt(String(params.adults || '1'));
    const children = 0;
    const infants = 0;
    
    // 1. MD5 İMZA OLUŞTURMA (Zorunlu!)
    // Format: token:marker:adults:children:infants:date:dest:origin:trip_class:ip
    const signatureStr = `${TP_TOKEN}:${TP_MARKER}:${adults}:${children}:${infants}:${dateStr}:${params.destination.toUpperCase()}:${params.origin.toUpperCase()}:Y:127.0.0.1`;
    const signature = crypto.createHash('md5').update(signatureStr).digest('hex');
    
    console.log(`🔐 Aviasales Signature String: ${signatureStr}`);
    console.log(`🔐 Aviasales MD5 Hash: ${signature}`);
    
    // 2. ARAMAYI BAŞLAT
    const requestBody = {
      signature: signature, // ← İşte eksik olan!
      marker: TP_MARKER,
      host: "flightagent.io",
      user_ip: "127.0.0.1",
      locale: "en",
      trip_class: "Y", // Economy
      passengers: {
        adults: adults,
        children: children,
        infants: infants
      },
      segments: [
        {
          origin: params.origin.toUpperCase(),
          destination: params.destination.toUpperCase(),
          date: dateStr
        }
      ]
    };

    console.log(`📡 Aviasales Init Request for ${params.origin} → ${params.destination}`);

    const initResponse = await fetch('https://api.travelpayouts.com/v1/flight_search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Token': TP_TOKEN
      },
      body: JSON.stringify(requestBody)
    });

    if (!initResponse.ok) {
      const errText = await initResponse.text();
      console.error(`❌ Aviasales Init Failed (${initResponse.status}):`, errText);
      console.error(`❌ Aviasales Request Body:`, JSON.stringify(requestBody, null, 2));
      return [];
    }

    const initData = await initResponse.json();
    console.log(`📦 Aviasales Init Response:`, JSON.stringify(initData, null, 2));
    
    const searchId = initData.search_id || initData.searchId;
    
    if (!searchId) {
      console.error('❌ No search_id returned:', JSON.stringify(initData).substring(0, 200));
      return [];
    }
    
    console.log(`⏳ Aviasales Search Started. ID: ${searchId}`);

    // 2. SONUÇLARI BEKLE (POLLING)
    // İlk sonuçların toplanması 3-4 saniye sürer
    await new Promise(resolve => setTimeout(resolve, 4000)); // 4 saniye bekle
    
    for (let attempt = 0; attempt < 3; attempt++) {
      const resultsUrl = `https://api.travelpayouts.com/v1/flight_search_results?search_id=${searchId}`;
      console.log(`🔍 Aviasales Polling attempt ${attempt + 1}/3...`);
      
      const resultsResponse = await fetch(resultsUrl);
      
      if (!resultsResponse.ok) {
        console.warn(`⚠️ Aviasales results poll failed (${resultsResponse.status})`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Tekrar denemeden önce bekle
        continue;
      }
      
      const resultsJson = await resultsResponse.json();
      
      if (!resultsJson || !Array.isArray(resultsJson) || resultsJson.length === 0) {
        console.log(`⏳ Aviasales: No results yet (attempt ${attempt + 1})`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Tekrar denemeden önce bekle
        continue;
      }

      // 3. VERİYİ İŞLE
      const flights: FlightResult[] = [];
      
      try {
        const proposals = resultsJson[0]?.proposals || [];
        
        if (proposals.length === 0) {
          console.warn('⚠️ Aviasales: No proposals in search results');
          return [];
        }

        console.log(`📦 Aviasales: Processing ${proposals.length} proposals...`);

        proposals.forEach((offer: any) => {
          try {
            const segment = offer.segment?.[0];
            if (!segment) return;
            
            const flightLegs = segment.flight || [];
            if (flightLegs.length === 0) return;

            const firstLeg = flightLegs[0];
            const lastLeg = flightLegs[flightLegs.length - 1];
            
            const stops = Math.max(0, flightLegs.length - 1);
            const airlineCode = firstLeg?.operating_carrier || 'XX';
            const airlineName = getAirlineName(airlineCode);
            
            // Tarih-Saat birleştir
            const departTime = `${firstLeg?.departure_date}T${firstLeg?.departure_time}`;
            const arriveTime = `${lastLeg?.arrival_date}T${lastLeg?.arrival_time}`;
            
            const deepLink = `https://search.aviasales.com/${searchId}/${offer.sign}?marker=${TP_MARKER}`;
            
            // Toplam süre (dakika cinsinden)
            const totalDurationMins = segment.duration || 0;
            
            // Layover'ları hesapla
            const layovers: any[] = [];
            for (let i = 0; i < flightLegs.length - 1; i++) {
              const current = flightLegs[i];
              const next = flightLegs[i + 1];
              
              const arrivalTime = new Date(`${current?.arrival_date}T${current?.arrival_time}`).getTime();
              const departureTime = new Date(`${next?.departure_date}T${next?.departure_time}`).getTime();
              const layoverMins = Math.floor((departureTime - arrivalTime) / 60000);
              
              layovers.push({
                airport: current?.destination || 'XXX',
                duration: layoverMins,
                city: current?.destination_name || ''
              });
            }

            flights.push({
              id: `TP_${offer.sign}`,
              source: 'TRAVELPAYOUTS' as FlightSource,
              airline: airlineName,
              airlineLogo: `https://pics.avs.io/200/200/${airlineCode}.png`,
              flightNumber: `${airlineCode}${Math.floor(Math.random() * 9999)}`,
              
              from: params.origin.toUpperCase(),
              to: params.destination.toUpperCase(),
              departTime: departTime,
              arriveTime: arriveTime,
              duration: totalDurationMins,
              stops: stops,
              
              price: parseFloat(offer.total_price || '0'),
              currency: offer.currency || params.currency || 'USD',
              cabinClass: 'economy',
              
              segments: flightLegs.map((leg: any) => ({
                from: leg.origin || 'XXX',
                to: leg.destination || 'XXX',
                departure: `${leg.departure_date}T${leg.departure_time}`,
                arrival: `${leg.arrival_date}T${leg.arrival_time}`,
                duration: leg.duration || 0,
                carrier: leg.operating_carrier || 'XX',
                carrierName: getAirlineName(leg.operating_carrier || 'XX'),
                flightNumber: leg.flight_number || 'FLT',
                aircraft: leg.aircraft_type || ''
              })),
              
              layovers: layovers,
              
              amenities: {
                hasWifi: false,
                hasMeal: stops === 0,
                baggage: '20kg'
              },
              
              policies: {
                baggageKg: 20,
                cabinBagKg: 7,
                refundable: false,
                changeAllowed: false
              },
              
              baggageSummary: {
                checked: '1 x 20kg',
                cabin: '1 x 7kg',
                totalWeight: '20kg'
              },
              
              deepLink: deepLink,
              bookingLink: deepLink,
              
              tags: stops === 0 ? ['Direkt'] : [`${stops} Aktarma`],
              score: stops === 0 ? 9.0 : 7.5,
              
              bookingProviders: [
                {
                  name: 'Aviasales/Travelpayouts',
                  price: parseFloat(offer.total_price || '0'),
                  currency: offer.currency || params.currency || 'USD',
                  link: deepLink,
                  type: 'agency' as const,
                  rating: 4.5
                }
              ]
            } as FlightResult);
            
          } catch (itemErr: any) {
            console.warn('⚠️ Aviasales: Error processing proposal:', itemErr.message);
          }
        });

        if (flights.length > 0) {
          console.log(`✅ Aviasales found ${flights.length} flights!`);
          return flights;
        }
        
      } catch (err: any) {
        console.error('❌ Aviasales: Error processing results:', err.message);
        return [];
      }
    }

    console.warn('⚠️ Aviasales: No results after polling');
    return [];

  } catch (error: any) {
    console.error('🔥 Aviasales Error:', error.message);
    return [];
  }
}

function getAirlineName(code: string): string {
  const airlines: Record<string, string> = {
    'TK': 'Turkish Airlines',
    'LH': 'Lufthansa',
    'BA': 'British Airways',
    'AF': 'Air France',
    'DL': 'Delta Air Lines',
    'AA': 'American Airlines',
    'UA': 'United Airlines',
    'QF': 'Qantas',
    'SQ': 'Singapore Airlines',
    'EK': 'Emirates',
    'EY': 'Etihad Airways',
    'QR': 'Qatar Airways',
    'KL': 'KLM',
    'IB': 'Iberia',
    'OS': 'Austrian Airlines'
  };
  
  return airlines[code] || code;
}
