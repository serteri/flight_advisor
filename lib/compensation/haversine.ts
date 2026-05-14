import { getAirportCoordinate } from './airportCoordinates';

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number) => degrees * (Math.PI / 180);

export type Coordinate = {
  lat: number;
  lng: number;
};

export const calculateHaversineDistanceKm = (from: Coordinate, to: Coordinate): number => {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_KM * c);
};

export const calculateAirportDistanceKm = (origin: string, destination: string): number | null => {
  const from = getAirportCoordinate(origin);
  const to = getAirportCoordinate(destination);

  if (!from || !to) return null;

  return calculateHaversineDistanceKm(from, to);
};
