import type { RoutePoint, RideSpeedStats } from './types';

export function computeRideSpeedStats(points: RoutePoint[]): RideSpeedStats | null {
  const speeds = points
    .map((point) => point.speed_kmh)
    .filter((speed): speed is number => speed != null && speed > 1);

  if (speeds.length === 0) return null;

  const max = Math.max(...speeds);
  const avg = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
  return { max_kmh: max, avg_kmh: avg };
}

export function speedKmhFromMps(speedMps: number | null | undefined): number | undefined {
  if (speedMps == null || speedMps < 0) return undefined;
  const kmh = speedMps * 3.6;
  return kmh > 1 ? kmh : undefined;
}
