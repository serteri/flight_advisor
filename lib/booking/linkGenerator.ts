export function generateBookingLink(flight: any): string {
  // 1. Varsa hazır Deep Link'i kullan (Mappers'dan gelen)
  if (flight.deepLink) return flight.deepLink;
  if (flight.bookingLink) return flight.bookingLink;

  // If this is a Duffel result, prefer the Duffel offer URL (if we have an id)
  const src = (flight.source || '').toString().toUpperCase();
  if (src === 'DUFFEL') {
    if (flight.id) return `https://app.duffel.com/offers/${flight.id}`;
    // If no id, avoid forcing Aviasales — fallback to a safe blank link
    return '#';
  }

  // 2. Link yoksa Aviasales Arama Linki oluştur (Fallback)
  const origin = flight.origin || flight.from;
  const destination = flight.destination || flight.to;
  const departureTime = flight.departTime || flight.departureTime;

  const marker = process.env.NEXT_PUBLIC_TRAVELPAYOUTS_MARKER || '701049';
  const domain = process.env.NEXT_PUBLIC_TP_DOMAIN || "aviasales.com";

  if (!origin || !destination || !departureTime) {
    return `https://${domain}?marker=${marker}`;
  }

  try {
    const d = new Date(departureTime);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');

    // Aviasales formatı: ORIGIN + DD + MM + DEST + 1
    const orig = String(origin).substring(0, 3).toUpperCase();
    const dest = String(destination).substring(0, 3).toUpperCase();

    const searchRoute = `${orig}${day}${month}${dest}1`;

    return `https://${domain}/search/${searchRoute}?marker=${marker}&currency=AUD&locale=en`;
  } catch (e) {
    return `https://${domain}?marker=${marker}`;
  }
}
