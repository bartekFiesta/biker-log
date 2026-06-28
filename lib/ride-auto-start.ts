import * as Location from 'expo-location';

import { haversineKm } from './fuel-calculations';
import { speedKmhFromMps } from './ride-speed';
import type { RoutePoint } from './types';

/** Speed that counts as riding when GPS reports velocity. */
export const AUTO_START_SPEED_THRESHOLD_KMH = 8;

/** How long movement must continue before a new ride starts (unless cumulative distance triggers first). */
export const AUTO_START_CONFIRM_MS = 5 * 1000;

/** Movement between two GPS fixes counts as riding. */
export const AUTO_START_MOVE_M = 15;

/** Start ride once this much movement accumulated since last long stop. */
export const AUTO_START_CUMULATIVE_M = 40;

const MAX_TRAIL_POINTS = 120;
const MIN_SEGMENT_M = 3;

class AutoStartTracker {
  private fastSince: number | null = null;
  private lastLat: number | null = null;
  private lastLng: number | null = null;
  private cumulativeMoveM = 0;
  private trail: RoutePoint[] = [];

  reset(): void {
    this.fastSince = null;
    this.lastLat = null;
    this.lastLng = null;
    this.cumulativeMoveM = 0;
    this.trail = [];
  }

  private pushTrail(location: Location.LocationObject, segmentM: number): void {
    if (segmentM > 0 && segmentM < MIN_SEGMENT_M) return;

    const point: RoutePoint = {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      ts: location.timestamp ?? Date.now(),
      speed_kmh: speedKmhFromMps(location.coords.speed),
    };

    const last = this.trail[this.trail.length - 1];
    if (last && last.lat === point.lat && last.lng === point.lng) return;

    this.trail.push(point);
    if (this.trail.length > MAX_TRAIL_POINTS) {
      this.trail.shift();
    }
  }

  /** Returns true when a new ride should begin. Call consumeTrail() after start(). */
  update(location: Location.LocationObject): boolean {
    const { latitude, longitude, speed } = location.coords;
    const speedKmh = speed != null ? Math.max(0, speed * 3.6) : null;

    let segmentM = 0;
    if (this.lastLat != null && this.lastLng != null) {
      segmentM = haversineKm(this.lastLat, this.lastLng, latitude, longitude) * 1000;
      if (segmentM >= MIN_SEGMENT_M) {
        this.cumulativeMoveM += segmentM;
        this.pushTrail(location, segmentM);
      }
    } else {
      this.pushTrail(location, segmentM);
    }

    this.lastLat = latitude;
    this.lastLng = longitude;

    const moving =
      (speedKmh != null && speedKmh >= AUTO_START_SPEED_THRESHOLD_KMH) ||
      segmentM >= AUTO_START_MOVE_M ||
      this.cumulativeMoveM >= AUTO_START_CUMULATIVE_M;

    if (moving) {
      if (this.fastSince == null) {
        this.fastSince = Date.now();
      }

      const readyByDistance = this.cumulativeMoveM >= AUTO_START_CUMULATIVE_M;
      const readyByTime = Date.now() - this.fastSince >= AUTO_START_CONFIRM_MS;
      if (readyByDistance || readyByTime) {
        return this.trail.length > 0;
      }
      return false;
    }

    if (speedKmh != null && speedKmh < 5) {
      this.fastSince = null;
      this.cumulativeMoveM = 0;
      this.trail = [];
    }

    return false;
  }

  consumeTrail(): RoutePoint[] {
    const points = [...this.trail];
    this.reset();
    return points;
  }
}

export const autoStartTracker = new AutoStartTracker();

export function resetAutoStartTracker(): void {
  autoStartTracker.reset();
}

export function consumeAutoStartTrail(): RoutePoint[] {
  return autoStartTracker.consumeTrail();
}
