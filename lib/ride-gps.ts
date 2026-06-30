import { haversineKm } from './fuel-calculations';
import type { Ride, RoutePoint } from './types';

export interface RideRouteEndpoints {
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
}

export function rideRouteEndpoints(routePoints: RoutePoint[]): RideRouteEndpoints {
  if (routePoints.length === 0) {
    return { start_lat: null, start_lng: null, end_lat: null, end_lng: null };
  }
  const first = routePoints[0];
  const last = routePoints[routePoints.length - 1];
  return {
    start_lat: first.lat,
    start_lng: first.lng,
    end_lat: last.lat,
    end_lng: last.lng,
  };
}

/** Meters between previous ride end and this ride start (GPS). */
export function gpsGapFromPreviousRideM(
  previous: Ride | null,
  current: Ride
): number | null {
  if (!previous?.ended_at || !current.route_points.length || !previous.route_points.length) {
    return null;
  }
  const prevEnd = previous.route_points[previous.route_points.length - 1];
  const curStart = current.route_points[0];
  return haversineKm(prevEnd.lat, prevEnd.lng, curStart.lat, curStart.lng) * 1000;
}

export function buildGpsGapByRideId(rides: Ride[]): Map<number, number | null> {
  const chronological = [...rides]
    .filter((ride) => ride.ended_at != null)
    .sort((a, b) => a.started_at.localeCompare(b.started_at));

  const gaps = new Map<number, number | null>();
  for (let i = 0; i < chronological.length; i++) {
    const ride = chronological[i];
    gaps.set(ride.id, i === 0 ? null : gpsGapFromPreviousRideM(chronological[i - 1], ride));
  }
  return gaps;
}
