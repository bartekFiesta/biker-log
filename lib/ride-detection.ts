import { autoRideDetector } from './auto-ride-detector';
import { stopBackgroundRideDetection, syncBackgroundRideDetection } from './background-location';
import { getSettings, updateSettings } from './db';
import { rideTracker } from './ride-tracker';

export async function syncRideDetection(): Promise<void> {
  const settings = await getSettings();

  if (settings.ride_detection_paused || rideTracker.getRideId() != null) {
    autoRideDetector.stopMonitoring();
    if (rideTracker.getRideId() == null) {
      await stopBackgroundRideDetection();
    }
    return;
  }

  if (settings.auto_start_rides) {
    await autoRideDetector.startMonitoring();
  } else {
    autoRideDetector.stopMonitoring();
  }

  if (settings.background_auto_start) {
    await syncBackgroundRideDetection(true);
  } else {
    await stopBackgroundRideDetection();
  }
}

export async function setRideDetectionPaused(paused: boolean): Promise<void> {
  await updateSettings({ ride_detection_paused: paused });
  await syncRideDetection();
}

export async function requestRideLocationPermissions(): Promise<boolean> {
  const { requestForegroundPermissionsAsync, requestBackgroundPermissionsAsync } = await import(
    'expo-location'
  );
  const foreground = await requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return false;
  await requestBackgroundPermissionsAsync();
  return true;
}
