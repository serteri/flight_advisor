export const FREE_TIER_LIMITS = {
  itineraryAnalyses: 3,
  trackedItineraries: 1,
  monitoredTrips: 1,
  advisorReports: 0,
  playbookAccess: false,
  compensationLetters: false,
} as const;

export const PRO_TIER = {
  itineraryAnalyses: -1,
  trackedItineraries: 10,
  monitoredTrips: -1,
  advisorReports: -1,
  playbookAccess: true,
  compensationLetters: true,
} as const;

export type FreemiumFeature =
  | 'itinerary_analysis'
  | 'tracked_itinerary'
  | 'monitored_trip'
  | 'advisor_report'
  | 'compensation_letter'
  | 'playbook_access';

export const FREEMIUM_FEATURES: FreemiumFeature[] = [
  'itinerary_analysis',
  'tracked_itinerary',
  'monitored_trip',
  'advisor_report',
  'compensation_letter',
  'playbook_access',
];

export const FEATURE_TO_LIMIT_KEY = {
  itinerary_analysis: 'itineraryAnalyses',
  tracked_itinerary: 'trackedItineraries',
  monitored_trip: 'monitoredTrips',
  advisor_report: 'advisorReports',
  compensation_letter: 'compensationLetters',
  playbook_access: 'playbookAccess',
} as const;

export const FEATURE_DISPLAY_NAMES: Record<FreemiumFeature, string> = {
  itinerary_analysis: 'itinerary analyses',
  tracked_itinerary: 'tracked itineraries',
  monitored_trip: 'monitored trips',
  advisor_report: 'advisor reports',
  compensation_letter: 'compensation letters',
  playbook_access: 'disruption playbook',
};
