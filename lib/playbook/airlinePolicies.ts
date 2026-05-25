// lib/playbook/airlinePolicies.ts
// Hardcoded airline policies for the top-20 carriers.
// Data reflects publicly available disruption-handling policies as of 2025.
// Update periodically — policies change without notice.

import type { AirlinePolicy } from './types';

export const AIRLINE_POLICIES: Record<string, AirlinePolicy> = {
  // ── Full-service European / Middle-Eastern ────────────────────────────────

  TK: {
    iataCode: 'TK',
    name: 'Turkish Airlines',
    rebookingPhone: '+90 212 444 0849',
    rebookingUrl: 'https://www.turkishairlines.com/en-int/flights/manage-booking/',
    appName: 'Turkish Airlines',
    loungeAlliance: 'Star Alliance',
    missedConnectionDesk: 'Transfer Desk',
    notes:
      'Turkish Airlines operates a dedicated Transfer Desk at IST (Istanbul Airport).' +
      ' For involuntary reroutes, insist on a written endorsement on your ticket;' +
      ' Miles&Smiles status holders get priority rebooking.',
  },

  LH: {
    iataCode: 'LH',
    name: 'Lufthansa',
    rebookingPhone: '+49 69 86 799 799',
    rebookingUrl: 'https://www.lufthansa.com/xx/en/manage-booking',
    appName: 'Lufthansa',
    loungeAlliance: 'Star Alliance',
    missedConnectionDesk: 'Transfer Desk',
    notes:
      'The Lufthansa app allows same-day rebooking push notifications. At FRA/MUC,' +
      ' look for "Transfer/Connecting Flights" counters — separate from check-in.' +
      ' Hotel vouchers are issued at the rebooking desk, not at the gate.',
  },

  BA: {
    iataCode: 'BA',
    name: 'British Airways',
    rebookingPhone: '+44 344 493 0787',
    rebookingUrl: 'https://www.britishairways.com/travel/managebooking/public/en_gb',
    appName: 'British Airways',
    loungeAlliance: 'OneWorld',
    missedConnectionDesk: 'Transfer Desk',
    notes:
      'The BA Manage My Booking app is the fastest route for rebooking.' +
      ' At LHR, the transfer desk is airside — do not exit security.' +
      ' UK261 applies for all flights departing from or arriving into the UK on BA.',
  },

  EK: {
    iataCode: 'EK',
    name: 'Emirates',
    rebookingPhone: '+971 600 555 555',
    rebookingUrl: 'https://www.emirates.com/uk/english/manage-booking/',
    appName: 'Emirates',
    loungeAlliance: null,
    missedConnectionDesk: 'Transfer Desk',
    notes:
      'Emirates operates a 24-hour transfer desk at DXB. For missed connections on' +
      ' an Emirates ticket, rebooking is free on the next available Emirates flight.' +
      ' Hotel is provided if the next available flight is the following day.',
  },

  QR: {
    iataCode: 'QR',
    name: 'Qatar Airways',
    rebookingPhone: '+974 4023 0000',
    rebookingUrl: 'https://www.qatarairways.com/en/manage-booking.html',
    appName: 'Qatar Airways',
    loungeAlliance: 'OneWorld',
    missedConnectionDesk: 'Transfer Desk',
    notes:
      'Qatar Airways provides hotel accommodation and meals for overnight connections' +
      ' at DOH. The Al Mourjan transfer desk is in Hamad International Terminal.' +
      ' Privilege Club members are assisted first.',
  },

  EY: {
    iataCode: 'EY',
    name: 'Etihad Airways',
    rebookingPhone: '+971 2 599 0000',
    rebookingUrl: 'https://www.etihad.com/en/manage',
    appName: 'Etihad Airways',
    loungeAlliance: null,
    missedConnectionDesk: 'Transfer Desk',
    notes:
      'Etihad\'s Stopover Desk at AUH handles missed connections.' +
      ' For involuntary rerouting, Etihad guest tiers affect rebooking priority.' +
      ' Keep all meal/refreshment receipts for expense claims.',
  },

  AF: {
    iataCode: 'AF',
    name: 'Air France',
    rebookingPhone: '+33 9 69 39 02 15',
    rebookingUrl: 'https://wwws.airfrance.us/en/booking/manage',
    appName: 'Air France',
    loungeAlliance: 'SkyTeam',
    missedConnectionDesk: 'Transfer Desk',
    notes:
      'Air France issues meal vouchers electronically via the app at CDG/ORY.' +
      ' EU261 applies on all AF flights departing from EU airports or operated by AF.' +
      ' Flying Blue status members can rebook via the Flying Blue service line.',
  },

  KL: {
    iataCode: 'KL',
    name: 'KLM',
    rebookingPhone: '+31 20 4 747 747',
    rebookingUrl: 'https://www.klm.com/en/manage-booking',
    appName: 'KLM',
    loungeAlliance: 'SkyTeam',
    missedConnectionDesk: 'Transfer Desk',
    notes:
      'KLM\'s Manage My Trip feature offers near-instant rebooking.' +
      ' AMS Schiphol has a dedicated KLM Transfer Desk in Departure Hall 3.' +
      ' EU261 applies on all KLM flights departing from EU airports.',
  },

  IB: {
    iataCode: 'IB',
    name: 'Iberia',
    rebookingPhone: '+34 901 111 500',
    rebookingUrl: 'https://www.iberia.com/gb/manage-your-booking/',
    appName: 'Iberia',
    loungeAlliance: 'OneWorld',
    missedConnectionDesk: 'Transfer Desk',
    notes:
      'Iberia Express and Iberia are separate entities; ensure rebooking is on' +
      ' the operating carrier\'s desk at MAD. EU261 applies.',
  },

  SQ: {
    iataCode: 'SQ',
    name: 'Singapore Airlines',
    rebookingPhone: '+65 6223 8888',
    rebookingUrl: 'https://www.singaporeair.com/en_UK/plan-travel/manage-booking/',
    appName: 'Singapore Airlines',
    loungeAlliance: 'Star Alliance',
    missedConnectionDesk: 'Transfer Desk',
    notes:
      'SQ operates a 24-hour transfer desk at SIN Changi. For involuntary rerouting,' +
      ' KrisFlyer members receive priority. SQ has a strong track record of providing' +
      ' hotel accommodation for overnight delays at SIN.',
  },

  CX: {
    iataCode: 'CX',
    name: 'Cathay Pacific',
    rebookingPhone: '+852 2747 1888',
    rebookingUrl: 'https://www.cathaypacific.com/cx/en_HK/manage-booking.html',
    appName: 'Cathay Pacific',
    loungeAlliance: 'OneWorld',
    missedConnectionDesk: 'Transfer Desk',
    notes:
      'Cathay Pacific has an arrivals/transfer desk at HKG. For connections missed' +
      ' due to an inbound CX delay, hotel and meals are provided at HKG.' +
      ' Marco Polo Club members receive priority rebooking.',
  },

  // ── Low-cost European ─────────────────────────────────────────────────────

  FR: {
    iataCode: 'FR',
    name: 'Ryanair',
    rebookingPhone: '+44 330 909 2012',
    rebookingUrl: 'https://www.ryanair.com/gb/en/manage-booking',
    appName: 'Ryanair',
    loungeAlliance: null,
    missedConnectionDesk: 'Any Gate Agent',
    notes:
      'Ryanair does NOT interline — missed connections are handled flight-by-flight.' +
      ' EU261 applies for departures from EU airports. Rebooking is almost always' +
      ' through the app or website; gate agents have limited authority.' +
      ' There is no through-check baggage when connecting Ryanair flights.',
  },

  U2: {
    iataCode: 'U2',
    name: 'easyJet',
    rebookingPhone: '+44 330 365 5000',
    rebookingUrl: 'https://www.easyjet.com/en/manage-bookings',
    appName: 'easyJet',
    loungeAlliance: null,
    missedConnectionDesk: 'Any Gate Agent',
    notes:
      'easyJet does NOT interline. For disruptions covered by EU261/UK261, use the' +
      ' Help section in the easyJet app to request a rebooking or refund.' +
      ' Meal vouchers at the airport are requested from gate staff.',
  },

  W6: {
    iataCode: 'W6',
    name: 'Wizz Air',
    rebookingPhone: '+36 1 777 9696',
    rebookingUrl: 'https://wizzair.com/#/manage-booking',
    appName: 'Wizz Air',
    loungeAlliance: null,
    missedConnectionDesk: 'Any Gate Agent',
    notes:
      'Wizz Air does NOT interline. EU261 applies for departures from EU airports.' +
      ' Wizz Air has historically contested many claims; document everything carefully.' +
      ' Rebooking via app is the primary channel; phone wait times can be very long.',
  },

  // ── Australian / Pacific ──────────────────────────────────────────────────

  QF: {
    iataCode: 'QF',
    name: 'Qantas',
    rebookingPhone: '+61 2 9691 3636',
    rebookingUrl: 'https://www.qantas.com/au/en/manage-booking.html',
    appName: 'Qantas',
    loungeAlliance: 'OneWorld',
    missedConnectionDesk: 'Transfer Desk',
    notes:
      'Qantas interlines with Jetstar and many OneWorld partners.' +
      ' For domestic-international connections at SYD/MEL, look for the' +
      ' Qantas Connections desk landside. Frequent Flyer status grants priority.',
  },

  VA: {
    iataCode: 'VA',
    name: 'Virgin Australia',
    rebookingPhone: '+61 7 3295 3000',
    rebookingUrl: 'https://www.virginaustralia.com/au/en/plan/manage-my-booking/',
    appName: 'Virgin Australia',
    loungeAlliance: null,
    missedConnectionDesk: 'Any Gate Agent',
    notes:
      'Virgin Australia\'s care obligations are governed by Australian Consumer Law.' +
      ' Velocity Frequent Flyer status grants priority rebooking.' +
      ' For international missed connections due to a VA domestic delay, see the' +
      ' VA customer service desk — not the international carrier\'s desk.',
  },

  JQ: {
    iataCode: 'JQ',
    name: 'Jetstar',
    rebookingPhone: '+61 3 9645 5999',
    rebookingUrl: 'https://www.jetstar.com/au/en/manage-booking',
    appName: 'Jetstar',
    loungeAlliance: null,
    missedConnectionDesk: 'Any Gate Agent',
    notes:
      'Jetstar does NOT interline outside Qantas Group.' +
      ' For disruptions, the primary channel is the Jetstar app or website.' +
      ' Cash compensation is not mandated under Australian law — care (meals, hotel)' +
      ' is the standard remedy. Keep all receipts.',
  },

  // ── North American ────────────────────────────────────────────────────────

  AA: {
    iataCode: 'AA',
    name: 'American Airlines',
    rebookingPhone: '+1 800 433 7300',
    rebookingUrl: 'https://www.aa.com/reservation/view/find-your-reservation.jsp',
    appName: 'American Airlines',
    loungeAlliance: 'OneWorld',
    missedConnectionDesk: 'Any Gate Agent',
    notes:
      'American Airlines interlines with most OneWorld partners.' +
      ' Same-day flight change is available in the app for eligible fares.' +
      ' Note: US regulations (DOT) govern domestic flights; EU261 does not apply' +
      ' unless the flight departs from an EU airport.',
  },

  UA: {
    iataCode: 'UA',
    name: 'United Airlines',
    rebookingPhone: '+1 800 864 8331',
    rebookingUrl: 'https://www.united.com/en/us/manageres',
    appName: 'United Airlines',
    loungeAlliance: 'Star Alliance',
    missedConnectionDesk: 'Any Gate Agent',
    notes:
      'United\'s app offers real-time rebooking during disruptions and can auto-protect' +
      ' passengers before a gate agent is reached. MileagePlus status holders are' +
      ' prioritised on standby. EU261 applies for flights departing from EU airports.',
  },

  DL: {
    iataCode: 'DL',
    name: 'Delta Air Lines',
    rebookingPhone: '+1 800 221 1212',
    rebookingUrl: 'https://www.delta.com/us/en/manage-trip/overview',
    appName: 'Fly Delta',
    loungeAlliance: 'SkyTeam',
    missedConnectionDesk: 'Any Gate Agent',
    notes:
      'Delta often auto-rebooks passengers during IROPS — check the Fly Delta app' +
      ' first before queuing at the gate. SkyMiles Medallion status holders can' +
      ' call the dedicated disruption line. EU261 applies for EU-departure flights.',
  },
};

/** IATA fallback for airlines not in the hardcoded list. */
export const GENERIC_FALLBACK: AirlinePolicy = {
  iataCode: 'XX',
  name: 'Your Airline',
  rebookingPhone: 'See your booking confirmation',
  rebookingUrl: 'https://www.iata.org/en/about/members/airline-list/',
  appName: null,
  loungeAlliance: null,
  missedConnectionDesk: 'Transfer Desk',
  notes:
    'Airline-specific data is not available. Contact the airline customer service' +
    ' desk or check your booking confirmation for contact details.',
};

/**
 * Returns the hardcoded AirlinePolicy for the given IATA code,
 * falling back to a generic entry if not found.
 */
export function getAirlinePolicy(iataCode: string): AirlinePolicy {
  const key = iataCode.trim().toUpperCase();
  return AIRLINE_POLICIES[key] ?? { ...GENERIC_FALLBACK, iataCode: key };
}
