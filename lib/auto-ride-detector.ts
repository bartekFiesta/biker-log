import * as Location from 'expo-location';

import { autoStartTracker, resetAutoStartTracker } from './ride-auto-start';
import { getActiveRide, getLatestOdometer, getSettings } from './db';
import { rideTracker } from './ride-tracker';

const CHECK_INTERVAL_MS = 5000;

type AutoStartListener = () => void;

export class AutoRideDetector {
  private subscription: Location.LocationSubscription | null = null;
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
    if (this.running && this.subscription != null) return;

    this.stop();

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    this.running = true;
    resetAutoStartTracker();

    this.subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: CHECK_INTERVAL_MS,
        distanceInterval: 15,
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
    resetAutoStartTracker();
  }

  private async handleLocation(location: Location.LocationObject) {
    if (rideTracker.getRideId() != null) {
      resetAutoStartTracker();
      return;
    }

    const activeRide = await getActiveRide();
    if (activeRide) {
      await rideTracker.restore({ startGps: true });
      resetAutoStartTracker();
      return;
    }

    if (!autoStartTracker.update(location)) return;

    this.stop();
    const odometer = await getLatestOdometer();
    await rideTracker.start(odometer);
    this.notifyStarted();
    const { syncRideDetection } = await import('./ride-detection');
    await syncRideDetection();
  }
}

export const autoRideDetector = new AutoRideDetector();
