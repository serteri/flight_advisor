export type AirlineClaimPortal = {
  name: string;
  url: string;
};

export const AIRLINE_CLAIM_PORTALS: Record<string, AirlineClaimPortal> = {
  QF: { name: 'Qantas', url: 'https://www.qantas.com/au/en/support/complaints-and-compliments.html' },
  EK: { name: 'Emirates', url: 'https://www.emirates.com/au/english/help/forms/feedback-complaint/' },
  TK: { name: 'Turkish Airlines', url: 'https://www.turkishairlines.com/en-int/any-questions/online-feedback/' },
  LH: { name: 'Lufthansa', url: 'https://www.lufthansa.com/us/en/feedback-form' },
  BA: { name: 'British Airways', url: 'https://www.britishairways.com/travel/managebooking/public/en_gb' },
  FR: { name: 'Ryanair', url: 'https://www.ryanair.com/gb/en/useful-info/help-centre/claims-and-compensations' },
  KL: { name: 'KLM', url: 'https://www.klm.com/information/eu-passenger-rights' },
  AF: { name: 'Air France', url: 'https://wwws.airfrance.fr/en/local/contact/passenger-right-form' },
  EY: { name: 'Etihad', url: 'https://www.etihad.com/en/help/contact-us' },
  SQ: { name: 'Singapore Airlines', url: 'https://www.singaporeair.com/en_UK/sg/media-centre/our-feedback-form/' },
  VA: { name: 'Virgin Australia', url: 'https://www.virginaustralia.com/au/en/about-us/contact-us/' },
  JQ: { name: 'Jetstar', url: 'https://www.jetstar.com/au/en/help/articles/how-do-i-make-a-complaint' },
};

export const getAirlineClaimPortal = (airlineCode?: string | null): AirlineClaimPortal | null => {
  if (!airlineCode) return null;
  const key = airlineCode.trim().toUpperCase();
  return AIRLINE_CLAIM_PORTALS[key] || null;
};

export function getAirlineClaimUrl(
  airlineCode: string,
  airlineName: string
): { url: string; isKnown: boolean } {
  const portal = AIRLINE_CLAIM_PORTALS[airlineCode];
  if (portal && portal.url) {
    return { url: portal.url, isKnown: true };
  }
  const searchQuery = encodeURIComponent(
    `${airlineName} flight delay compensation claim`
  );
  return {
    url: `https://www.google.com/search?q=${searchQuery}`,
    isKnown: false
  };
}
