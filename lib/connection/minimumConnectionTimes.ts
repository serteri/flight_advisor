export const MCT_MINUTES: Record<string, number> = {
  FRA: 45,
  AMS: 40,
  CDG: 60,
  LHR: 60,
  IST: 60,
  DXB: 45,
  SIN: 50,
  MUC: 30,
  ZRH: 30,
  VIE: 25,
};

export const DEFAULT_MCT = 60;

export const getMinimumConnectionTime = (airportCode: string): number => {
  return MCT_MINUTES[airportCode.trim().toUpperCase()] ?? DEFAULT_MCT;
};
