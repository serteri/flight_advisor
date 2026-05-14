import { getAirportCoordinate } from './airportCoordinates';
import { DGCA_COUNTRIES, EU_COUNTRIES, getCarrierZone, UK_COUNTRIES } from './airlineZones';

export type RegulationZone = 'EU261' | 'UK261' | 'DGCA' | 'NONE';
export type EligibilityStatus = 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'UNKNOWN';
export type DisruptionCause = 'OPERATIONAL' | 'WEATHER' | 'ATC_STRIKE' | 'SECURITY_RISK' | 'UNKNOWN';

export type CompensationTier = {
  scenario: string;
  minDelayMinutes: number;
  amount: number | null;
  currency: 'EUR' | 'GBP' | 'AUD';
  eligible: boolean;
  note: string;
};

export type CompensationAssessment = {
  regulation: RegulationZone;
  distanceKm: number | null;
  compensationTiers: CompensationTier[];
  currentStatus: {
    eligibilityStatus: EligibilityStatus;
    delayMinutes: number | null;
    estimatedAmount: number | null;
    currency: 'EUR' | 'GBP' | 'AUD' | null;
    reason: string;
  };
};

const extraordinaryCauses = new Set<DisruptionCause>(['WEATHER', 'ATC_STRIKE', 'SECURITY_RISK']);

const isEuCountry = (country?: string) => Boolean(country && EU_COUNTRIES.has(country));
const isUkCountry = (country?: string) => Boolean(country && UK_COUNTRIES.has(country));
const isDgcaCountry = (country?: string) => Boolean(country && DGCA_COUNTRIES.has(country));

export const determineRegulationZone = (params: {
  origin: string;
  destination: string;
  carrier: string;
}): RegulationZone => {
  const originCountry = getAirportCoordinate(params.origin)?.country;
  const destinationCountry = getAirportCoordinate(params.destination)?.country;
  const carrier = getCarrierZone(params.carrier);

  if (isUkCountry(originCountry)) return 'UK261';
  if (isEuCountry(originCountry)) return 'EU261';
  if (isEuCountry(destinationCountry) && carrier?.isEuCarrier) return 'EU261';
  if (isUkCountry(destinationCountry) && carrier?.isUkCarrier) return 'UK261';
  if (isDgcaCountry(originCountry) || isDgcaCountry(destinationCountry)) return 'DGCA';

  return 'NONE';
};

export const calculateDelayMinutes = (scheduledArr: Date, actualArr?: Date | null): number | null => {
  if (!actualArr) return null;
  return Math.max(0, Math.round((actualArr.getTime() - scheduledArr.getTime()) / 60000));
};

export const calculateEu261Amount = (distanceKm: number, delayMinutes: number, isCancellation = false): number | null => {
  if (!isCancellation && delayMinutes <= 180) return null;

  if (distanceKm < 1500) return 250;
  if (distanceKm <= 3500) return 400;
  if (delayMinutes > 240 || isCancellation) return 600;
  if (delayMinutes > 180) return 300;

  return null;
};

export const buildPotentialTiers = (regulation: RegulationZone, distanceKm: number | null): CompensationTier[] => {
  if (regulation === 'DGCA') {
    return [
      {
        scenario: 'Care entitlement',
        minDelayMinutes: 120,
        amount: null,
        currency: 'AUD',
        eligible: true,
        note: 'Australian rules generally focus on care such as meals, accommodation, and rebooking. Cash compensation is not mandatory.',
      },
    ];
  }

  if (regulation === 'NONE' || distanceKm === null) {
    return [
      {
        scenario: 'Outside supported cash-compensation rules',
        minDelayMinutes: 0,
        amount: null,
        currency: 'EUR',
        eligible: false,
        note: 'This route does not appear to fall under EU261 or UK261 based on the supplied airport and carrier data.',
      },
    ];
  }

  const currency = regulation === 'UK261' ? 'GBP' : 'EUR';

  return [
    {
      scenario: '1 hour reported delay',
      minDelayMinutes: 60,
      amount: null,
      currency,
      eligible: false,
      note: 'Below the standard 3 hour cash-compensation threshold.',
    },
    {
      scenario: '2 hour reported delay',
      minDelayMinutes: 120,
      amount: null,
      currency,
      eligible: false,
      note: 'Below the standard 3 hour cash-compensation threshold.',
    },
    {
      scenario: '3-4 hour reported delay',
      minDelayMinutes: 181,
      amount: distanceKm > 3500 ? 300 : calculateEu261Amount(distanceKm, 181),
      currency,
      eligible: true,
      note: distanceKm > 3500 ? 'Long-haul flights may receive a reduced amount for delays between 3 and 4 hours.' : 'Meets the standard EU261/UK261 delay threshold.',
    },
    {
      scenario: '4+ hour reported delay or cancellation',
      minDelayMinutes: 241,
      amount: calculateEu261Amount(distanceKm, 241, true),
      currency,
      eligible: true,
      note: 'Meets the highest listed delay/cancellation scenario for this distance band.',
    },
  ];
};

export const assessCompensation = (params: {
  origin: string;
  destination: string;
  carrier: string;
  distanceKm: number | null;
  scheduledArr: Date;
  actualArr?: Date | null;
  disruptionCause?: DisruptionCause;
  cancellationNoticeDays?: number | null;
  isCancellation?: boolean;
}): CompensationAssessment => {
  const regulation = determineRegulationZone(params);
  const delayMinutes = calculateDelayMinutes(params.scheduledArr, params.actualArr);
  const tiers = buildPotentialTiers(regulation, params.distanceKm);
  const currency = regulation === 'UK261' ? 'GBP' : regulation === 'DGCA' ? 'AUD' : 'EUR';

  if (regulation === 'NONE') {
    return {
      regulation,
      distanceKm: params.distanceKm,
      compensationTiers: tiers,
      currentStatus: {
        eligibilityStatus: 'NOT_ELIGIBLE',
        delayMinutes,
        estimatedAmount: null,
        currency: null,
        reason: 'The supplied route/carrier combination does not appear to be covered by EU261, UK261, or Australian DGCA care rules.',
      },
    };
  }

  if (regulation === 'DGCA') {
    return {
      regulation,
      distanceKm: params.distanceKm,
      compensationTiers: tiers,
      currentStatus: {
        eligibilityStatus: 'UNKNOWN',
        delayMinutes,
        estimatedAmount: null,
        currency,
        reason: 'Australian passenger protections generally require airline care, but mandatory cash compensation is not part of the framework.',
      },
    };
  }

  if (extraordinaryCauses.has(params.disruptionCause ?? 'UNKNOWN')) {
    return {
      regulation,
      distanceKm: params.distanceKm,
      compensationTiers: tiers,
      currentStatus: {
        eligibilityStatus: 'NOT_ELIGIBLE',
        delayMinutes,
        estimatedAmount: null,
        currency,
        reason: 'Extraordinary circumstances such as weather, ATC strike, or security risk normally exclude cash compensation.',
      },
    };
  }

  if (params.isCancellation && typeof params.cancellationNoticeDays === 'number' && params.cancellationNoticeDays > 14) {
    return {
      regulation,
      distanceKm: params.distanceKm,
      compensationTiers: tiers,
      currentStatus: {
        eligibilityStatus: 'NOT_ELIGIBLE',
        delayMinutes,
        estimatedAmount: null,
        currency,
        reason: 'Cancellation notice was more than 14 days before departure.',
      },
    };
  }

  if (params.distanceKm === null) {
    return {
      regulation,
      distanceKm: params.distanceKm,
      compensationTiers: tiers,
      currentStatus: {
        eligibilityStatus: 'UNKNOWN',
        delayMinutes,
        estimatedAmount: null,
        currency,
        reason: 'Airport coordinates are unavailable, so distance-based compensation cannot be estimated.',
      },
    };
  }

  if (delayMinutes === null && !params.isCancellation) {
    return {
      regulation,
      distanceKm: params.distanceKm,
      compensationTiers: tiers,
      currentStatus: {
        eligibilityStatus: 'UNKNOWN',
        delayMinutes,
        estimatedAmount: null,
        currency,
        reason: 'No actual arrival time was supplied. Showing potential compensation based on scheduled times and possible reported delay scenarios.',
      },
    };
  }

  const estimatedAmount = calculateEu261Amount(params.distanceKm, delayMinutes ?? 0, params.isCancellation);

  return {
    regulation,
    distanceKm: params.distanceKm,
    compensationTiers: tiers,
    currentStatus: {
      eligibilityStatus: estimatedAmount ? 'ELIGIBLE' : 'NOT_ELIGIBLE',
      delayMinutes,
      estimatedAmount,
      currency,
      reason: estimatedAmount
        ? 'Estimated eligible based on reported delay/cancellation timing and distance band.'
        : 'Reported delay is below the cash-compensation threshold for this distance band.',
    },
  };
};
