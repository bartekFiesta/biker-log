import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { isNative } from './platform';
import { syncRideDetection, requestRideLocationPermissions } from './ride-detection';
import {
  getLatestOdometer,
  getServiceRecords,
  getServiceReminderRules,
  getDatabase,
} from './db';
import { refreshServiceNotifications, requestNotificationPermissions } from './notifications';
import { rideTracker } from './ride-tracker';
import type { RideRecordingState } from './types';

interface DatabaseContextValue {
  ready: boolean;
  refreshKey: number;
  refresh: () => void;
}

const DatabaseContext = createContext<DatabaseContextValue>({
  ready: false,
  refreshKey: 0,
  refresh: () => {},
});

async function bootstrapAppData(): Promise<void> {
  await syncRideDetection();
  const [rules, records, odometer] = await Promise.all([
    getServiceReminderRules(),
    getServiceRecords(),
    getLatestOdometer(),
  ]);
  await refreshServiceNotifications(rules, records, odometer);
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const rideStateRef = useRef<RideRecordingState>('idle');

  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (isNative) {
        await import('@/lib/background-ride-task');
      }
      await getDatabase();
      try {
        const { getActiveRide } = await import('./db');
        const active = await getActiveRide();
        await rideTracker.restore({ startGps: active != null });
      } catch {
        // Keep app usable even if ride restore fails.
      }
      await requestRideLocationPermissions();
      await requestNotificationPermissions();
      await bootstrapAppData();
      if (mounted) setReady(true);
    })();

    const unsubscribe = rideTracker.subscribe((snapshot) => {
      if (snapshot.state === rideStateRef.current) return;
      rideStateRef.current = snapshot.state;
      if (snapshot.state === 'recording' || snapshot.state === 'idle') {
        setRefreshKey((k) => k + 1);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
      void rideTracker.dispose();
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <DatabaseContext.Provider value={{ ready, refreshKey, refresh }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  return useContext(DatabaseContext);
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121212',
  },
});
