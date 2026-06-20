import * as Location from 'expo-location';

import { BACKGROUND_RIDE_TASK } from './background-ride-task';
import { isWeb } from './platform';

export async function stopBackgroundRideDetection(): Promise<void> {
  await syncBackgroundRideDetection(false);
}

export async function syncBackgroundRideDetection(enabled: boolean): Promise<void> {
  if (isWeb) return;
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_RIDE_TASK).catch(
    () => false
  );

  if (enabled) {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') return;

    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_RIDE_TASK);
    }

    await Location.startLocationUpdatesAsync(BACKGROUND_RIDE_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 15,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Biker Log',
        notificationBody: 'Ride detection active',
      },
    });
    return;
  }

  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_RIDE_TASK);
  }
}
