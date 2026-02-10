export function generateBookingLink(flight: any): string {
  // Duffel ise link yok
  if (flight.source === 'DUFFEL') return "";

  // Rapid API ise Link Var
  if (flight.source && flight.source.includes('RAPID')) {
    // Check for both possible property names just in case
    const origin = flight.origin || flight.from;
    const destination = flight.destination || flight.to;
    const departureTime = flight.departTime || flight.departureTime;

    if (!origin || !destination || !departureTime) return "https://aviasales.com";

    const marker = process.env.NEXT_PUBLIC_TRAVELPAYOUTS_MARKER || '701049';
    const domain = process.env.NEXT_PUBLIC_TP_DOMAIN || "aviasales.com";

    try {
      const d = new Date(departureTime);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');

      const orig = String(origin).substring(0, 3).toUpperCase();
      const dest = String(destination).substring(0, 3).toUpperCase();

      const searchRoute = `${orig}${day}${month}${dest}1`;

      return `https://${domain}/search/${searchRoute}?marker=${marker}&currency=USD&locale=en`;
    } catch (e) {
      return `https://${domain}?marker=${marker}`;
    }
  }

  return "";
}
