import * as TaskManager from 'expo-task-manager';

import { getLatestOdometer, getSettings } from './db';
import { isNative } from './platform';
import { rideTracker } from './ride-tracker';
import { RIDE_SPEED_THRESHOLD_KMH } from './ride-speed';

export const BACKGROUND_RIDE_TASK = 'background-ride-detection';

const CONFIRM_MS = 20000;
let fastSince: number | null = null;

if (isNative) {
  TaskManager.defineTask(BACKGROUND_RIDE_TASK, async ({ data, error }) => {
  if (error) return;
  if (!data) return;

  const locations = (data as { locations?: { coords: { speed: number | null } }[] }).locations;
  const location = locations?.[0];
  if (!location) return;

  if (rideTracker.getRideId() != null) {
    fastSince = null;
    return;
  }

  const settings = await getSettings();
  if (settings.ride_detection_paused || !settings.background_auto_start) return;

  const speedKmh = location.coords.speed != null ? Math.max(0, location.coords.speed * 3.6) : 0;

  if (speedKmh >= RIDE_SPEED_THRESHOLD_KMH) {
    if (fastSince == null) fastSince = Date.now();
    else if (Date.now() - fastSince >= CONFIRM_MS) {
      fastSince = null;
      const odometer = await getLatestOdometer();
      await rideTracker.start(odometer);
      const { syncRideDetection } = await import('./ride-detection');
      await syncRideDetection();
    }
  } else {
    fastSince = null;
  }
  });
}
