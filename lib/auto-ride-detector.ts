import * as Location from 'expo-location';

import { getActiveRide, getLatestOdometer, getSettings } from './db';
import { rideTracker } from './ride-tracker';
import { RIDE_SPEED_THRESHOLD_KMH } from './ride-speed';

const CONFIRM_SECONDS = 20;
const CHECK_INTERVAL_MS = 5000;

type AutoStartListener = () => void;

export class AutoRideDetector {
  private subscription: Location.LocationSubscription | null = null;
  private fastSince: number | null = null;
  private listeners = new Set<AutoStartListener>();
  private running = false;

  subscribe(listener: AutoStartListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyStarted() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  async startMonitoring(): Promise<void> {
    if (this.running) return;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    this.running = true;
    this.fastSince = null;

    this.subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: CHECK_INTERVAL_MS,
        distanceInterval: 20,
      },
      (location) => {
        void this.handleLocation(location);
      }
    );
  }

  async sync(): Promise<void> {
    const settings = await getSettings();
    if (settings.ride_detection_paused || rideTracker.getRideId() != null) {
      this.stop();
      return;
    }
    if (settings.auto_start_rides) {
      await this.startMonitoring();
    } else {
      this.stop();
    }
  }

  stopMonitoring() {
    this.stop();
  }

  private stop() {
    this.subscription?.remove();
    this.subscription = null;
    this.running = false;
    this.fastSince = null;
  }

  private async handleLocation(location: Location.LocationObject) {
    if (rideTracker.getRideId() != null) {
      this.fastSince = null;
      return;
    }

    const activeRide = await getActiveRide();
    if (activeRide) {
      await rideTracker.restore({ startGps: true });
      this.fastSince = null;
      return;
    }

    const speedKmh = location.coords.speed != null ? Math.max(0, location.coords.speed * 3.6) : 0;

    if (speedKmh >= RIDE_SPEED_THRESHOLD_KMH) {
      if (this.fastSince == null) {
        this.fastSince = Date.now();
      } else if (Date.now() - this.fastSince >= CONFIRM_SECONDS * 1000) {
        this.fastSince = null;
        this.stop();
        const odometer = await getLatestOdometer();
        await rideTracker.start(odometer);
        this.notifyStarted();
        const { syncRideDetection } = await import('./ride-detection');
        await syncRideDetection();
      }
    } else {
      this.fastSince = null;
    }
  }
}

export const autoRideDetector = new AutoRideDetector();
