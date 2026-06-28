import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { getActiveRide, getLatestOdometer, getSettings } from './db';
import { isNative } from './platform';
import { autoStartTracker, consumeAutoStartTrail, resetAutoStartTracker } from './ride-auto-start';
import { rideTracker } from './ride-tracker';

export const BACKGROUND_RIDE_TASK = 'background-ride-detection';

export function resetBackgroundRideDetectionTimer(): void {
  resetAutoStartTracker();
}

if (isNative) {
  TaskManager.defineTask(BACKGROUND_RIDE_TASK, async ({ data, error }) => {
    if (error) return;
    if (!data) return;

    const locations = (data as { locations?: Location.LocationObject[] }).locations;
    const location = locations?.[0];
    if (!location) return;

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

    const settings = await getSettings();
    if (settings.ride_detection_paused || !settings.background_auto_start) return;

    if (!autoStartTracker.update(location)) return;

    const odometer = await getLatestOdometer();
    const trail = consumeAutoStartTrail();
    await rideTracker.start(odometer, trail);
    const { syncRideDetection } = await import('./ride-detection');
    await syncRideDetection();
  });
}
