// lib/booking/linkGenerator.ts

interface FlightParams {
  origin: string;       // e.g. BNE
  destination: string;  // e.g. IST
  departureDate: string; // Keep for interface compatibility but use departureTime logic
  departureTime?: string; // Add this
  returnDate?: string;
  passengers?: number;
  source?: string; // Normalized to string to accept 'duffel' | 'RAPID_API' etc.
  deepLink?: string;    // If API provided a ready-to-use link
}

export function generateBookingLink(flight: any): string {
  // 1. Eğer RapidAPI'den geldiyse ve kendi direkt linki varsa onu kullan
  if (flight.source === 'RAPID_API' && flight.deepLink && flight.deepLink.startsWith('http')) {
    return flight.deepLink;
  }

  // 2. Duffel veya Linki Olmayanlar için: AVIASALES Linki Üret
  const marker = process.env.NEXT_PUBLIC_TRAVELPAYOUTS_MARKER || 'direct';
  const domain = "aviasales.com";

  // 🚨 HATA BURADAYDI: flight.departureDate DEĞİL, flight.departureTime OLMALI
  const dateValue = flight.departureTime || flight.departureDate;

  if (!dateValue) {
    console.error("Link Üretilemedi: Tarih Yok!", flight);
    return "https://aviasales.com"; // Hata durumunda ana sayfaya at
  }

  const d = new Date(dateValue);

  if (isNaN(d.getTime())) {
    console.error("Link Üretilemedi: Geçersiz Tarih!", dateValue);
    return "https://aviasales.com";
  }

  // Aviasales Formatı: GunAy (Örn: 0103)
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');

  // Rota: Origin + GunAy + Dest + YolcuSayisi
  // Örn: BNE0103IST1
  // Use default pax=1 if undefined
  const pax = flight.passengers || 1;
  let searchRoute = `${flight.origin}${day}${month}${flight.destination}${pax}`;

  // Affiliate Linki
  return `https://${domain}/search/${searchRoute}?marker=${marker}&currency=AUD&locale=en`;
}
