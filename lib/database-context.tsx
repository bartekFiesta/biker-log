import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { isNative } from './platform';
import { autoRideDetector } from './auto-ride-detector';
import { syncRideDetection, setRideDetectionPaused, requestRideLocationPermissions } from './ride-detection';
import { createTranslator } from './i18n';
import {
  getLatestOdometer,
  getServiceRecords,
  getServiceReminderRules,
  getSettings,
  getDatabase,
} from './db';
import { refreshServiceNotifications } from './notifications';
import { rideTracker } from './ride-tracker';

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
      await bootstrapAppData();
      if (mounted) setReady(true);
    })();

    const unsubscribe = autoRideDetector.subscribe(() => {
      void (async () => {
        const settings = await getSettings();
        const t = createTranslator(settings.app_language ?? 'en');
        Alert.alert(t('reminders.rideStartedTitle'), t('reminders.rideStartedBody'));
        setRefreshKey((k) => k + 1);
      })();
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
