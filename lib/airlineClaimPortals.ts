export type AirlineClaimPortal = {
  name: string;
  url: string;
};

export const AIRLINE_CLAIM_PORTALS: Record<string, AirlineClaimPortal> = {
  // MAJOR GLOBAL CARRIERS
  QF: { name: 'Qantas', url: 'https://www.qantas.com/au/en/support/complaints-and-compliments.html' },
  EK: { name: 'Emirates', url: 'https://www.emirates.com/au/english/help/forms/feedback-complaint/' },
  TK: { name: 'Turkish Airlines', url: 'https://www.turkishairlines.com/en-int/any-questions/online-feedback/' },
  LH: { name: 'Lufthansa', url: 'https://www.lufthansa.com/us/en/feedback-form' },
  BA: { name: 'British Airways', url: 'https://www.britishairways.com/travel/customerrelations/public/en_gb' },
  FR: { name: 'Ryanair', url: 'https://www.ryanair.com/gb/en/useful-info/help-centre/claims-and-compensations' },
  KL: { name: 'KLM', url: 'https://www.klm.com/information/eu-passenger-rights' },
  AF: { name: 'Air France', url: 'https://wwws.airfrance.fr/en/local/contact/passenger-right-form' },
  EY: { name: 'Etihad', url: 'https://www.etihad.com/en/help/contact-us' },
  SQ: { name: 'Singapore Airlines', url: 'https://www.singaporeair.com/en_UK/sg/media-centre/our-feedback-form/' },
  VA: { name: 'Virgin Australia', url: 'https://www.virginaustralia.com/au/en/about-us/contact-us/' },
  JQ: { name: 'Jetstar', url: 'https://www.jetstar.com/au/en/help/articles/how-do-i-make-a-complaint' },
  U2: { name: 'easyJet', url: 'https://www.easyjet.com/en/claim' },
  W6: { name: 'Wizz Air', url: 'https://wizzair.com/en-gb/info-and-services/services/compensation' },
  IB: { name: 'Iberia', url: 'https://www.iberia.com/gb/help/contact-us/' },
  VY: { name: 'Vueling', url: 'https://www.vueling.com/en/we-help-you/claim' },
  AZ: { name: 'ITA Airways', url: 'https://www.itaairways.com/en/assistance/claim.html' },
  OS: { name: 'Austrian Airlines', url: 'https://www.austrian.com/us/en/feedback' },
  LX: { name: 'Swiss', url: 'https://www.swiss.com/us/en/prepare/extra-services/feedback' },
  SK: { name: 'SAS', url: 'https://www.flysas.com/en/us/travel-info/passenger-rights/' },
  AY: { name: 'Finnair', url: 'https://www.finnair.com/en/contact-us' },
  DY: { name: 'Norwegian', url: 'https://www.norwegian.com/en/faq/compensation/' },
  TP: { name: 'TAP Air Portugal', url: 'https://www.flytap.com/en-pt/contact-us' },
  SN: { name: 'Brussels Airlines', url: 'https://www.brusselsairlines.com/en-be/practical-information/contact.aspx' },
  LO: { name: 'LOT Polish Airlines', url: 'https://www.lot.com/us/en/contact' },
  RO: { name: 'TAROM', url: 'https://www.tarom.ro/en/contact' },
  JP: { name: 'Adria Airways', url: '' },
  JU: { name: 'Air Serbia', url: 'https://www.airserbia.com/en/contact' },
  CY: { name: 'Cyprus Airways', url: 'https://www.cyprusairways.com/en/contact-us' },
  A3: { name: 'Aegean Airlines', url: 'https://en.aegeanair.com/travel-information/travel-support/submit-a-request/' },
  EI: { name: 'Aer Lingus', url: 'https://www.aerlingus.com/help/contactus/' },
  VS: { name: 'Virgin Atlantic', url: 'https://help.virginatlantic.com/gb/en/compensation.html' },
  ZI: { name: 'Aigle Azur', url: '' },
  TO: { name: 'Transavia France', url: 'https://www.transavia.com/en-EU/contact-us/' },
  BT: { name: 'airBaltic', url: 'https://www.airbaltic.com/en/customer-relations' },
  QR: { name: 'Qatar Airways', url: 'https://www.qatarairways.com/en/help/contact-us.html' },
  MS: { name: 'EgyptAir', url: 'https://www.egyptair.com/en/Pages/Contactus.aspx' },
  ET: { name: 'Ethiopian Airlines', url: 'https://www.ethiopianairlines.com/aa/help/contact-us' },
  KQ: { name: 'Kenya Airways', url: 'https://www.kenya-airways.com/en/support/contact-us/' },
  SA: { name: 'South African Airways', url: 'https://www.flysaa.com/za/en/contact-us' },
  AI: { name: 'Air India', url: 'https://www.airindia.com/in/en/contact-us.html' },
  '6E': { name: 'IndiGo', url: 'https://www.goindigo.in/contact-us.html' },
  CX: { name: 'Cathay Pacific', url: 'https://www.cathaypacific.com/cx/en_AU/contact-us.html' },
  MH: { name: 'Malaysia Airlines', url: 'https://www.malaysiaairlines.com/au/en/contact-us.html' },
  GA: { name: 'Garuda Indonesia', url: 'https://www.garuda-indonesia.com/au/en/contact-us' },
  NH: { name: 'ANA', url: 'https://www.ana.co.jp/en/au/contactus/' },
  JL: { name: 'Japan Airlines', url: 'https://www.jal.co.jp/au/en/contactus/' },
  OZ: { name: 'Asiana Airlines', url: 'https://flyasiana.com/C/AU/EN/contents/customer-support' },
  KE: { name: 'Korean Air', url: 'https://www.koreanair.com/au/en/support' },
  CI: { name: 'China Airlines', url: 'https://www.china-airlines.com/au/en/service/contact' },
  BR: { name: 'EVA Air', url: 'https://www.evaair.com/en-global/contact-us/' },
  TG: { name: 'Thai Airways', url: 'https://www.thaiairways.com/en_AU/contact_us/contact_us.page' },
  VN: { name: 'Vietnam Airlines', url: 'https://www.vietnamairlines.com/au/en/contact' },
  LA: { name: 'LATAM', url: 'https://www.latamairlines.com/au/en/servicio-al-cliente' },
  G3: { name: 'Gol Airlines', url: 'https://www.voegol.com.br/en/information/contact' },
  AD: { name: 'Azul Airlines', url: 'https://www.voeazul.com.br/en/contact' },
  AR: { name: 'Aerolineas Argentinas', url: 'https://www.aerolineas.com.ar/en/contact' },
  AM: { name: 'Aeromexico', url: 'https://aeromexico.com/en-us/contact-us' },
  AC: { name: 'Air Canada', url: 'https://www.aircanada.com/ca/en/aco/home/support.html' },
  WS: { name: 'WestJet', url: 'https://www.westjet.com/en-ca/contact-us' },
  AA: { name: 'American Airlines', url: 'https://www.aa.com/contact/forms/customer-relations' },
  DL: { name: 'Delta', url: 'https://www.delta.com/us/en/feedback/overview' },
  UA: { name: 'United Airlines', url: 'https://www.united.com/en/us/fly/contact-us.html' },
  WN: { name: 'Southwest', url: 'https://www.southwest.com/contact-us/' },
  B6: { name: 'JetBlue', url: 'https://www.jetblue.com/contact-us' },
  AS: { name: 'Alaska Airlines', url: 'https://www.alaskaair.com/content/contact-us' },
  F9: { name: 'Frontier Airlines', url: 'https://www.flyfrontier.com/customer-support/contact-us/' },
  NK: { name: 'Spirit Airlines', url: 'https://customersupport.spirit.com' },
  XW: { name: 'NokScoot', url: '' },
  TR: { name: 'Scoot', url: 'https://www.flyscoot.com/en/contact/contact-us' },
  FD: { name: 'Thai AirAsia', url: 'https://www.airasia.com/en/gb/contact-us.page' },
  AK: { name: 'AirAsia', url: 'https://support.airasia.com/s/contactus' },
  D7: { name: 'AirAsia X', url: 'https://support.airasia.com/s/contactus' },
  FZ: { name: 'flydubai', url: 'https://www.flydubai.com/en/plan/contact-us' },
  G9: { name: 'Air Arabia', url: 'https://www.airarabia.com/en/contact-us' },
  WY: { name: 'Oman Air', url: 'https://www.omanair.com/en/contact-us' },
  GF: { name: 'Gulf Air', url: 'https://www.gulfair.com/contact-us' },
  PK: { name: 'Pakistan International', url: 'https://www.piac.com.pk/contact-us' },
};

export const getAirlineClaimPortal = (airlineCode?: string | null): AirlineClaimPortal | null => {
  if (!airlineCode) return null;
  const key = airlineCode.trim().toUpperCase();
  return AIRLINE_CLAIM_PORTALS[key] || null;
};

export function getAirlineClaimUrl(
  airlineCode: string,
  airlineName: string,
): { url: string; isKnown: boolean } {
  const key = (airlineCode || '').trim().toUpperCase();
  const portal = AIRLINE_CLAIM_PORTALS[key];
  if (portal && portal.url) {
    return { url: portal.url, isKnown: true };
  }
  const searchQuery = encodeURIComponent(`${airlineName} flight delay compensation claim`);
  return {
    url: `https://www.google.com/search?q=${searchQuery}`,
    isKnown: false,
  };
}
