import type { RoutePoint, RideSpeedStats } from './types';

/** Speed threshold for auto-start (km/h). */
export const RIDE_SPEED_THRESHOLD_KMH = 15;

/** Below this speed counts as parked for auto-stop (km/h). */
export const RIDE_STOP_SPEED_KMH = 8;

/** Auto-stop ride after this long below stop speed. */
export const AUTO_STOP_IDLE_MS = 5 * 60 * 1000;

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
