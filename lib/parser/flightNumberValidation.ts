const BLOCKED_PREFIXES = new Set([
  'AUD', 'USD', 'EUR', 'GBP', 'CAD', 'JPY', 'TRY', 'NZD', 'CHF', 'CNY', 'HKD', 'SGD', 'AED',
  'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN',
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  'UTC', 'GMT', 'EET', 'CET', 'BST', 'PST', 'EST', 'AEST', 'JST', 'KST',
  'ECO', 'BUS', 'CAB', 'DEP', 'ARR',
]);

const KNOWN_AIRLINE_PREFIXES = new Set([
  'A3', 'AA', 'AC', 'AF', 'AI', 'AM', 'AS', 'AY', 'AZ',
  'BA', 'BR', 'CX', 'CZ', 'DL', 'EK', 'ET', 'EY',
  'FJ', 'FR', 'GA', 'IB', 'JL', 'JQ', 'KE', 'KL',
  'LA', 'LH', 'LO', 'LX', 'MH', 'NH', 'NZ', 'OS',
  'QF', 'QR', 'RJ', 'SK', 'SQ', 'SU', 'TG', 'TK',
  'UA', 'U2', 'VA', 'VN', 'VS', 'VY', 'W6', 'WS',
  'WY', 'XQ',
]);

export const FORBIDDEN_FAKE_FLIGHT_TOKENS = [
  'AUD3',
  'TUE10',
  'WED15',
  'THU16',
  'UNKNOWN1',
  'UNKN',
];

export const normalizeFlightNumber = (value?: string | null): string | undefined => {
  const normalized = (value || '').trim().toUpperCase().replace(/[\s-]+/g, '');
  const match = normalized.match(/^([A-Z0-9]{2})(\d{1,4})$/);
  if (!match) return undefined;

  return normalizeFlightNumberParts(match[1], match[2]);
};

export const normalizeFlightNumberParts = (prefix: string, digits: string): string | undefined => {
  const carrier = prefix.trim().toUpperCase();
  const number = digits.trim();

  if (!/^[A-Z0-9]{2}$/.test(carrier)) return undefined;
  if (!/^\d{1,4}$/.test(number)) return undefined;
  if (BLOCKED_PREFIXES.has(carrier) || BLOCKED_PREFIXES.has(carrier.slice(0, 3))) return undefined;
  if (!KNOWN_AIRLINE_PREFIXES.has(carrier)) return undefined;

  return `${carrier}${number}`;
};

export const isValidFlightNumber = (value?: string | null): boolean => {
  return Boolean(normalizeFlightNumber(value));
};

export const isForbiddenFakeFlightToken = (value?: string | null): boolean => {
  const normalized = (value || '').trim().toUpperCase().replace(/[\s-]+/g, '');
  return FORBIDDEN_FAKE_FLIGHT_TOKENS.includes(normalized)
    || /^(AUD|USD|EUR|GBP|CAD|TRY|TUE|WED|THU|FRI|SAT|SUN)\d{1,4}$/.test(normalized)
    || /^UNKNOWN\d+$/.test(normalized)
    || normalized === 'UNKN';
};
