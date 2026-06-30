import * as Location from 'expo-location';

import { autoStartTracker, consumeAutoStartTrail, resetAutoStartTracker } from './ride-auto-start';
import { getActiveRide, getLatestOdometer, getSettings } from './db';
import {
  passengerTransportDetector,
  resetPassengerTransportDetector,
} from './passenger-transport-detector';
import { rideTracker } from './ride-tracker';

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
    resetPassengerTransportDetector();

    this.subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 3000,
        distanceInterval: 10,
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
    resetPassengerTransportDetector();
  }

  private async handleLocation(location: Location.LocationObject) {
    if (rideTracker.getRideId() != null) {
      resetAutoStartTracker();
      resetPassengerTransportDetector();
      return;
    }

    const settings = await getSettings();
    if (settings.ride_detection_paused) {
      resetPassengerTransportDetector();
      return;
    }

    passengerTransportDetector.update(location, 'detection');

    const activeRide = await getActiveRide();
    if (activeRide) {
      await rideTracker.restore({ startGps: true });
      resetAutoStartTracker();
      return;
    }

    if (passengerTransportDetector.shouldBlockAutoStart()) {
      return;
    }

    if (!autoStartTracker.update(location)) return;

    this.stop();
    const odometer = await getLatestOdometer();
    const trail = consumeAutoStartTrail();
    await rideTracker.start(odometer, trail);
    this.notifyStarted();
    const { syncRideDetection } = await import('./ride-detection');
    await syncRideDetection();
  }
}

export const autoRideDetector = new AutoRideDetector();
