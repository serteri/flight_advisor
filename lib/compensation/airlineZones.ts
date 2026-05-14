export type CarrierZone = {
  country: string;
  isEuCarrier: boolean;
  isUkCarrier: boolean;
  acceptanceRate: number;
};

export const EU_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES', 'SE',
]);

export const UK_COUNTRIES = new Set(['GB']);

export const DGCA_COUNTRIES = new Set(['AU']);

export const AIRLINE_ZONES: Record<string, CarrierZone> = {
  A3: { country: 'GR', isEuCarrier: true, isUkCarrier: false, acceptanceRate: 0.69 },
  AA: { country: 'US', isEuCarrier: false, isUkCarrier: false, acceptanceRate: 0.48 },
  AC: { country: 'CA', isEuCarrier: false, isUkCarrier: false, acceptanceRate: 0.55 },
  AF: { country: 'FR', isEuCarrier: true, isUkCarrier: false, acceptanceRate: 0.76 },
  BA: { country: 'GB', isEuCarrier: false, isUkCarrier: true, acceptanceRate: 0.74 },
  CX: { country: 'HK', isEuCarrier: false, isUkCarrier: false, acceptanceRate: 0.58 },
  DL: { country: 'US', isEuCarrier: false, isUkCarrier: false, acceptanceRate: 0.52 },
  EK: { country: 'AE', isEuCarrier: false, isUkCarrier: false, acceptanceRate: 0.63 },
  EY: { country: 'AE', isEuCarrier: false, isUkCarrier: false, acceptanceRate: 0.6 },
  FR: { country: 'IE', isEuCarrier: true, isUkCarrier: false, acceptanceRate: 0.41 },
  IB: { country: 'ES', isEuCarrier: true, isUkCarrier: false, acceptanceRate: 0.71 },
  JQ: { country: 'AU', isEuCarrier: false, isUkCarrier: false, acceptanceRate: 0.36 },
  KL: { country: 'NL', isEuCarrier: true, isUkCarrier: false, acceptanceRate: 0.78 },
  LH: { country: 'DE', isEuCarrier: true, isUkCarrier: false, acceptanceRate: 0.81 },
  LX: { country: 'CH', isEuCarrier: false, isUkCarrier: false, acceptanceRate: 0.77 },
  OS: { country: 'AT', isEuCarrier: true, isUkCarrier: false, acceptanceRate: 0.74 },
  QF: { country: 'AU', isEuCarrier: false, isUkCarrier: false, acceptanceRate: 0.44 },
  QR: { country: 'QA', isEuCarrier: false, isUkCarrier: false, acceptanceRate: 0.61 },
  SQ: { country: 'SG', isEuCarrier: false, isUkCarrier: false, acceptanceRate: 0.67 },
  TK: { country: 'TR', isEuCarrier: false, isUkCarrier: false, acceptanceRate: 0.72 },
  U2: { country: 'GB', isEuCarrier: false, isUkCarrier: true, acceptanceRate: 0.38 },
  VA: { country: 'AU', isEuCarrier: false, isUkCarrier: false, acceptanceRate: 0.4 },
  VS: { country: 'GB', isEuCarrier: false, isUkCarrier: true, acceptanceRate: 0.7 },
  W6: { country: 'HU', isEuCarrier: true, isUkCarrier: false, acceptanceRate: 0.39 },
};

export const getCarrierZone = (carrier: string): CarrierZone | undefined => {
  return AIRLINE_ZONES[carrier.trim().toUpperCase()];
};

export const getAirlineAcceptanceRate = (carrier: string): number | null => {
  return getCarrierZone(carrier)?.acceptanceRate ?? null;
};
