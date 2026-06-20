import * as Location from 'expo-location';

import { haversineKm } from './fuel-calculations';

/** Lower bar for auto-start than auto-stop — city / GPS without speed still starts. */
export const AUTO_START_SPEED_THRESHOLD_KMH = 15;

/** How long movement must continue before a new ride starts. */
export const AUTO_START_CONFIRM_MS = 12 * 1000;

/** When GPS has no speed, this much movement between fixes counts as riding. */
export const AUTO_START_MOVE_M = 50;

class AutoStartTracker {
  private fastSince: number | null = null;
  private lastLat: number | null = null;
  private lastLng: number | null = null;

  reset(): void {
    this.fastSince = null;
    this.lastLat = null;
    this.lastLng = null;
  }

  /** Returns true when a new ride should begin. */
  update(location: Location.LocationObject): boolean {
    const { latitude, longitude, speed } = location.coords;
    const speedKmh = speed != null ? Math.max(0, speed * 3.6) : null;

    let moving =
      speedKmh != null && speedKmh >= AUTO_START_SPEED_THRESHOLD_KMH;

    if (!moving && this.lastLat != null && this.lastLng != null) {
      const movedM =
        haversineKm(this.lastLat, this.lastLng, latitude, longitude) * 1000;
      if (movedM >= AUTO_START_MOVE_M) {
        moving = true;
      }
    }

    this.lastLat = latitude;
    this.lastLng = longitude;

    if (moving) {
      if (this.fastSince == null) {
        this.fastSince = Date.now();
      } else if (Date.now() - this.fastSince >= AUTO_START_CONFIRM_MS) {
        this.reset();
        return true;
      }
      return false;
    }

    if (speedKmh != null && speedKmh < AUTO_START_SPEED_THRESHOLD_KMH) {
      this.fastSince = null;
    }

    return false;
  }
}

export const autoStartTracker = new AutoStartTracker();

export function resetAutoStartTracker(): void {
  autoStartTracker.reset();
}
