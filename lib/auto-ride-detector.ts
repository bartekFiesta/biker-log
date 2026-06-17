import * as Location from 'expo-location';

import { getLatestOdometer, getSettings } from './db';
import { rideTracker } from './ride-tracker';

const MIN_SPEED_KMH = 25;
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

  async sync(): Promise<void> {
    const settings = await getSettings();
    if (settings.auto_start_rides && rideTracker.getRideId() == null) {
      await this.start();
    } else {
      this.stop();
    }
  }

  private async start() {
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

    const speedKmh = location.coords.speed != null ? Math.max(0, location.coords.speed * 3.6) : 0;

    if (speedKmh >= MIN_SPEED_KMH) {
      if (this.fastSince == null) {
        this.fastSince = Date.now();
      } else if (Date.now() - this.fastSince >= CONFIRM_SECONDS * 1000) {
        this.fastSince = null;
        this.stop();
        const odometer = await getLatestOdometer();
        await rideTracker.start(odometer);
        this.notifyStarted();
        void this.sync();
      }
    } else {
      this.fastSince = null;
    }
  }
}

export const autoRideDetector = new AutoRideDetector();
