import type * as Location from 'expo-location';

import { haversineKm } from './fuel-calculations';
import { getSettings } from './db';
import { sendPassengerTransportNotification, sendWalkingWhileRecordingNotification } from './notifications';

const SAMPLE_MAX_AGE_MS = 4 * 60 * 1000;
const VEHICLE_MIN_SPEED_KMH = 20;
const VEHICLE_SUSTAIN_MS = 90 * 1000;
const VEHICLE_MIN_DISTANCE_M = 350;
/** Walk to bus stop / corner shop — no alert below this. */
const SHORT_TRIP_EXEMPT_M = 200;
const WALK_MAX_SPEED_KMH = 10;
const WALK_MIN_MS = 3 * 60 * 1000;
const WALK_MAX_DISTANCE_M = 280;
const ALERT_COOLDOWN_MS = 20 * 60 * 1000;

interface Sample {
  lat: number;
  lng: number;
  ts: number;
  speedKmh: number | null;
}

export type TransportSuspicion = 'none' | 'vehicle_passenger' | 'walking';

export type TransportContext = 'detection' | 'recording';

class PassengerTransportDetector {
  private samples: Sample[] = [];
  private suspicion: TransportSuspicion = 'none';
  private lastVehicleAlertAt = 0;
  private lastWalkingAlertAt = 0;
  private listeners = new Set<(suspicion: TransportSuspicion) => void>();

  subscribe(listener: (suspicion: TransportSuspicion) => void): () => void {
    this.listeners.add(listener);
    listener(this.suspicion);
    return () => this.listeners.delete(listener);
  }

  getSuspicion(): TransportSuspicion {
    return this.suspicion;
  }

  shouldBlockAutoStart(): boolean {
    return this.suspicion === 'vehicle_passenger';
  }

  reset(): void {
    this.samples = [];
    this.setSuspicion('none');
  }

  private setSuspicion(next: TransportSuspicion) {
    if (this.suspicion === next) return;
    this.suspicion = next;
    for (const listener of this.listeners) {
      listener(next);
    }
  }

  private effectiveSpeedKmh(current: Sample, previous: Sample | null): number | null {
    if (current.speedKmh != null && current.speedKmh > 1) {
      return current.speedKmh;
    }
    if (!previous) return null;
    const dtSec = (current.ts - previous.ts) / 1000;
    if (dtSec < 2) return null;
    const distM = haversineKm(previous.lat, previous.lng, current.lat, current.lng) * 1000;
    return (distM / dtSec) * 3.6;
  }

  private analyzeWindow(): {
    distanceM: number;
    durationMs: number;
    vehicleFraction: number;
    maxSpeedKmh: number;
    medianSpeedKmh: number;
  } | null {
    if (this.samples.length < 3) return null;

    let distanceM = 0;
    const speeds: number[] = [];
    let vehicleCount = 0;
    let speedCount = 0;

    for (let i = 1; i < this.samples.length; i++) {
      const prev = this.samples[i - 1];
      const cur = this.samples[i];
      distanceM += haversineKm(prev.lat, prev.lng, cur.lat, cur.lng) * 1000;
      const speed = this.effectiveSpeedKmh(cur, prev);
      if (speed != null) {
        speeds.push(speed);
        speedCount++;
        if (speed >= VEHICLE_MIN_SPEED_KMH) vehicleCount++;
      }
    }

    const durationMs = this.samples[this.samples.length - 1].ts - this.samples[0].ts;
    const sorted = [...speeds].sort((a, b) => a - b);
    const medianSpeedKmh = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;

    return {
      distanceM,
      durationMs,
      vehicleFraction: speedCount > 0 ? vehicleCount / speedCount : 0,
      maxSpeedKmh: speeds.length > 0 ? Math.max(...speeds) : 0,
      medianSpeedKmh,
    };
  }

  update(location: Location.LocationObject, context: TransportContext = 'detection'): void {
    const now = Date.now();
    const speedKmh =
      location.coords.speed != null ? Math.max(0, location.coords.speed * 3.6) : null;

    this.samples.push({
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      ts: now,
      speedKmh,
    });
    this.samples = this.samples.filter((sample) => now - sample.ts <= SAMPLE_MAX_AGE_MS);

    const stats = this.analyzeWindow();
    if (!stats) {
      this.setSuspicion('none');
      return;
    }

    if (stats.distanceM < SHORT_TRIP_EXEMPT_M) {
      this.setSuspicion('none');
      return;
    }

    const vehicleLike =
      stats.distanceM >= VEHICLE_MIN_DISTANCE_M &&
      stats.durationMs >= VEHICLE_SUSTAIN_MS &&
      stats.vehicleFraction >= 0.45 &&
      stats.medianSpeedKmh >= VEHICLE_MIN_SPEED_KMH;

    if (vehicleLike) {
      this.setSuspicion('vehicle_passenger');
      void this.maybeNotifyVehicle(context);
      return;
    }

    const walkingLike =
      context === 'recording' &&
      stats.distanceM <= WALK_MAX_DISTANCE_M &&
      stats.durationMs >= WALK_MIN_MS &&
      stats.maxSpeedKmh <= WALK_MAX_SPEED_KMH &&
      stats.medianSpeedKmh <= WALK_MAX_SPEED_KMH;

    if (walkingLike) {
      this.setSuspicion('walking');
      void this.maybeNotifyWalking();
      return;
    }

    this.setSuspicion('none');
  }

  private async shouldNotifyTransport(): Promise<boolean> {
    const settings = await getSettings();
    return settings.transport_alerts_enabled && !settings.ride_detection_paused;
  }

  private async maybeNotifyVehicle(context: TransportContext): Promise<void> {
    if (Date.now() - this.lastVehicleAlertAt < ALERT_COOLDOWN_MS) return;
    if (!(await this.shouldNotifyTransport())) return;

    this.lastVehicleAlertAt = Date.now();
    const settings = await getSettings();
    await sendPassengerTransportNotification(settings.app_language, context);
  }

  private async maybeNotifyWalking(): Promise<void> {
    if (Date.now() - this.lastWalkingAlertAt < ALERT_COOLDOWN_MS) return;
    if (!(await this.shouldNotifyTransport())) return;

    this.lastWalkingAlertAt = Date.now();
    const settings = await getSettings();
    await sendWalkingWhileRecordingNotification(settings.app_language);
  }
}

export const passengerTransportDetector = new PassengerTransportDetector();

export function resetPassengerTransportDetector(): void {
  passengerTransportDetector.reset();
}
