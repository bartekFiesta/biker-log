import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { deleteRide, finishRide, getActiveRide, updateRidePauseState, updateRideRoute } from './db';
import { routeDistanceKm } from './fuel-calculations';
import { isNative } from './platform';
import { speedKmhFromMps } from './ride-speed';
import type { RideRecordingState, RoutePoint } from './types';

export const ACTIVE_RIDE_TASK = 'active-ride-tracking';

const MIN_DISTANCE_M = 5;
const MIN_INTERVAL_MS = 3000;
const POLL_INTERVAL_MS = 5000;
const isIos = Platform.OS === 'ios';

export interface RideTrackerSnapshot {
  points: RoutePoint[];
  distanceKm: number;
  state: RideRecordingState;
  movingDurationMs: number;
  pausedDurationMs: number;
}

export class RideTracker {
  private rideId: number | null = null;
  private points: RoutePoint[] = [];
  private subscription: Location.LocationSubscription | null = null;
  private watching = false;
  private lastRecordedAt = 0;
  private paused = false;
  private pausedDurationMs = 0;
  private pauseStartedAt: number | null = null;
  private rideStartedAt: number | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(snapshot: RideTrackerSnapshot) => void>();

  subscribe(listener: (snapshot: RideTrackerSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): RideTrackerSnapshot {
    return {
      points: this.points,
      distanceKm: routeDistanceKm(this.points),
      state: this.getState(),
      movingDurationMs: this.getMovingDurationMs(),
      pausedDurationMs: this.getTotalPausedDurationMs(),
    };
  }

  getState(): RideRecordingState {
    if (this.rideId == null) return 'idle';
    return this.paused ? 'paused' : 'recording';
  }

  private notify() {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private getTotalPausedDurationMs(): number {
    let total = this.pausedDurationMs;
    if (this.paused && this.pauseStartedAt != null) {
      total += Date.now() - this.pauseStartedAt;
    }
    return total;
  }

  private getMovingDurationMs(): number {
    if (this.rideStartedAt == null) return 0;
    return Math.max(0, Date.now() - this.rideStartedAt - this.getTotalPausedDurationMs());
  }

  async ensureRestored(): Promise<number | null> {
    if (this.rideId != null) return this.rideId;
    return this.restore();
  }

  async restore(options?: { startGps?: boolean }): Promise<number | null> {
    const active = await getActiveRide();
    if (!active) return null;

    this.rideId = active.id;
    this.points = active.route_points;
    this.paused = active.is_paused;
    this.pausedDurationMs = active.paused_duration_ms;
    this.pauseStartedAt = null;
    this.rideStartedAt = new Date(active.started_at).getTime();

    if (!this.paused && options?.startGps !== false) {
      await this.startWatching();
      await this.seedCurrentLocation();
    }

    this.notify();
    return active.id;
  }

  isWatching(): boolean {
    return this.watching;
  }

  getPointCount(): number {
    return this.points.length;
  }

  async ensureTracking(): Promise<void> {
    if (this.rideId == null || this.paused) return;

    if (!this.watching || this.subscription == null) {
      this.watching = false;
      await this.startWatching(true);
    }

    await this.seedCurrentLocation();
  }

  getRideId(): number | null {
    return this.rideId;
  }

  isPaused(): boolean {
    return this.paused;
  }

  getPoints(): RoutePoint[] {
    return this.points;
  }

  getDistanceKm(): number {
    return routeDistanceKm(this.points);
  }

  private async resumeBackgroundRideDetection() {
    const { getSettings } = await import('./db');
    const { syncBackgroundRideDetection } = await import('./background-location');
    const settings = await getSettings();
    await syncBackgroundRideDetection(settings.background_auto_start);
  }

  private stopPollTimer() {
    if (this.pollTimer != null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private startPollTimer() {
    this.stopPollTimer();
    this.pollTimer = setInterval(() => {
      void this.pollLocation();
    }, POLL_INTERVAL_MS);
  }

  private async pollLocation() {
    if (this.rideId == null || this.paused) return;

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      await this.handleLocation(location);
    } catch {
      // GPS may be unavailable briefly.
    }
  }

  private async teardownWatching() {
    this.stopPollTimer();
    this.subscription?.remove();
    this.subscription = null;
    this.watching = false;
  }

  private async stopWatching() {
    if (!this.watching) return;

    await this.teardownWatching();
    await this.resumeBackgroundRideDetection();
  }

  private async startWatching(force = false) {
    if (this.watching && !force) return;

    if (force) {
      await this.teardownWatching();
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission denied');
    }

    if (isIos) {
      const { stopBackgroundRideDetection } = await import('./background-location');
      await stopBackgroundRideDetection();
    }

    this.subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: MIN_INTERVAL_MS,
        distanceInterval: isIos ? 1 : MIN_DISTANCE_M,
      },
      (location) => {
        void this.handleLocation(location);
      }
    );

    this.watching = true;
    this.startPollTimer();
  }

  async processLocationFromTask(location: Location.LocationObject): Promise<void> {
    await this.handleLocation(location);
  }

  /** Stops location updates when no ride is active (e.g. provider unmount). */
  async dispose(): Promise<void> {
    if (this.rideId == null) {
      await this.stopWatching();
    }
  }

  private async persistPauseState() {
    if (this.rideId == null) return;
    await updateRidePauseState(this.rideId, this.paused, this.getTotalPausedDurationMs());
  }

  private async handleLocation(location: Location.LocationObject) {
    if (this.rideId == null || this.paused) return;

    const now = Date.now();
    const point: RoutePoint = {
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      ts: now,
      speed_kmh: speedKmhFromMps(location.coords.speed),
    };

    const last = this.points[this.points.length - 1];
    if (last) {
      const moved =
        Math.abs(last.lat - point.lat) > 0.00001 || Math.abs(last.lng - point.lng) > 0.00001;
      if (!moved && now - this.lastRecordedAt < MIN_INTERVAL_MS) return;
    }

    this.points.push(point);
    this.lastRecordedAt = now;
    this.notify();

    await updateRideRoute(this.rideId, this.points, routeDistanceKm(this.points));
  }

  private async seedCurrentLocation() {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      await this.handleLocation(location);
    } catch {
      // GPS may not be ready yet; watchPositionAsync will pick up later.
    }
  }

  async start(odometerStart: number | null): Promise<number> {
    if (this.rideId != null) return this.rideId;

    const existing = await getActiveRide();
    if (existing) {
      const restored = await this.restore({ startGps: true });
      if (restored != null) {
        await this.ensureTracking();
        return restored;
      }
    }

    const { autoRideDetector } = await import('./auto-ride-detector');
    autoRideDetector.stopMonitoring();

    const { createRide } = await import('./db');
    const ride = await createRide(odometerStart);
    this.rideId = ride.id;
    this.points = [];
    this.lastRecordedAt = 0;
    this.paused = false;
    this.pausedDurationMs = 0;
    this.pauseStartedAt = null;
    this.rideStartedAt = Date.now();
    await this.startWatching();
    await this.seedCurrentLocation();
    this.notify();
    return ride.id;
  }

  async discardActiveRide(): Promise<void> {
    let id = this.rideId;
    if (id == null) {
      const active = await getActiveRide();
      id = active?.id ?? null;
      if (active) {
        this.rideId = active.id;
        this.points = active.route_points;
      }
    }
    if (id == null) return;

    await this.teardownWatching();
    await this.resumeBackgroundRideDetection();

    this.rideId = null;
    this.points = [];
    this.paused = false;
    this.pausedDurationMs = 0;
    this.pauseStartedAt = null;
    this.rideStartedAt = null;
    this.lastRecordedAt = 0;
    this.notify();

    await deleteRide(id);

    const { autoRideDetector } = await import('./auto-ride-detector');
    void autoRideDetector.sync();
  }

  async pause(): Promise<void> {
    if (this.rideId == null || this.paused) return;

    await this.stopWatching();
    this.paused = true;
    this.pauseStartedAt = Date.now();
    await this.persistPauseState();
    this.notify();
  }

  async resume(): Promise<void> {
    if (this.rideId == null || !this.paused) return;

    if (this.pauseStartedAt != null) {
      this.pausedDurationMs += Date.now() - this.pauseStartedAt;
    }
    this.pauseStartedAt = null;
    this.paused = false;
    await this.startWatching();
    await this.seedCurrentLocation();
    await this.persistPauseState();
    this.notify();
  }

  async stopQuick(): Promise<void> {
    await this.ensureRestored();
    if (this.rideId == null) {
      throw new Error('No active ride');
    }

    const active = await getActiveRide();
    let odometerEnd: number | null = null;
    if (active?.odometer_start != null) {
      odometerEnd = active.odometer_start + routeDistanceKm(this.points);
    }

    await this.stop(odometerEnd, active?.label ?? null, active?.tolls_cost ?? null);
  }

  async stop(
    odometerEnd: number | null,
    label: string | null = null,
    tollsCost: number | null = null
  ): Promise<void> {
    if (this.rideId == null) {
      await this.ensureRestored();
    }
    if (this.rideId == null) return;

    if (this.paused && this.pauseStartedAt != null) {
      this.pausedDurationMs += Date.now() - this.pauseStartedAt;
      this.pauseStartedAt = null;
      this.paused = false;
    }

    await this.stopWatching();

    const distance = routeDistanceKm(this.points);
    const pausedDurationMs = this.pausedDurationMs;
    await finishRide(this.rideId, this.points, distance, odometerEnd, pausedDurationMs, label, tollsCost);

    this.rideId = null;
    this.points = [];
    this.pausedDurationMs = 0;
    this.rideStartedAt = null;
    this.notify();

    const { autoRideDetector } = await import('./auto-ride-detector');
    void autoRideDetector.sync();
  }
}

export const rideTracker = new RideTracker();

if (isNative) {
  TaskManager.defineTask(ACTIVE_RIDE_TASK, async ({ data, error }) => {
    if (error) return;
    if (!data) return;

    const locations = (data as { locations?: Location.LocationObject[] }).locations;
    for (const location of locations ?? []) {
      await rideTracker.processLocationFromTask(location);
    }
  });
}
