import type { RoutePoint, RideSpeedStats } from './types';

/** Speed threshold shared by auto-start and auto-stop (km/h). */
export const RIDE_SPEED_THRESHOLD_KMH = 15;

/** Auto-stop ride after this long below threshold speed. */
export const AUTO_STOP_IDLE_MS = 2 * 60 * 1000;

/** Ignore auto-stop until the ride has been active this long (avoids GPS glitches). */
export const MIN_RIDE_BEFORE_AUTO_STOP_MS = 60 * 1000;

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
