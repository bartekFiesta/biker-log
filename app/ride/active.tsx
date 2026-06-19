import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import MapRoute from '@/components/MapRoute';
import PrimaryButton from '@/components/PrimaryButton';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { getActiveRide, getLatestOdometer, getSettings } from '@/lib/db';
import { useDatabase } from '@/lib/database-context';
import { formatDurationMs } from '@/lib/format';
import { useI18n } from '@/lib/i18n/context';
import { formatDistance } from '@/lib/units';
import { rideTracker, type RideTrackerSnapshot } from '@/lib/ride-tracker';
import type { RideRecordingState, RoutePoint } from '@/lib/types';

export default function ActiveRideScreen() {
  const router = useRouter();
  const { refresh } = useDatabase();
  const { t } = useI18n();
  const [state, setState] = useState<RideRecordingState>('idle');
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [movingDurationMs, setMovingDurationMs] = useState(0);
  const [pausedDurationMs, setPausedDurationMs] = useState(0);
  const [odometerStart, setOdometerStart] = useState('');
  const [odometerEnd, setOdometerEnd] = useState('');
  const [label, setLabel] = useState('');
  const [tolls, setTolls] = useState('');
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'mi'>('km');
  const [loading, setLoading] = useState(false);
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);

  const stateLabel =
    state === 'recording'
      ? t('rideActive.recording')
      : state === 'paused'
        ? t('rideActive.paused')
        : t('rideActive.ready');

  useEffect(() => {
    void (async () => {
      const [latest, settings, active] = await Promise.all([
        getLatestOdometer(),
        getSettings(),
        getActiveRide(),
      ]);

      if (active && rideTracker.getRideId() == null) {
        await rideTracker.restore();
      }

      if (rideTracker.getRideId() != null) {
        await rideTracker.ensureTracking();
      }

      const permission = await Location.getForegroundPermissionsAsync();
      setLocationGranted(permission.granted);

      if (active?.odometer_start != null) {
        setOdometerStart(String(Math.round(active.odometer_start)));
      } else if (latest != null) {
        setOdometerStart(String(Math.round(latest)));
      }

      setDistanceUnit(settings.distance_unit);

      if (rideTracker.getRideId() != null) {
        setState(rideTracker.getState());
      }
    })();

    const applySnapshot = (snapshot: RideTrackerSnapshot) => {
      setPoints(snapshot.points);
      setDistanceKm(snapshot.distanceKm);
      setState(snapshot.state);
      setMovingDurationMs(snapshot.movingDurationMs);
      setPausedDurationMs(snapshot.pausedDurationMs);
    };

    const unsubscribe = rideTracker.subscribe(applySnapshot);
    const timer = setInterval(() => {
      applySnapshot(rideTracker.getSnapshot());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const handleStart = async () => {
    setLoading(true);
    try {
      const startValue = odometerStart.trim()
        ? Number(odometerStart.replace(',', '.'))
        : null;
      if (odometerStart.trim() && !Number.isFinite(startValue)) {
        Alert.alert(t('common.error'), t('rideActive.odometerStartInvalid'));
        return;
      }
      await rideTracker.start(startValue);
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('rideActive.startFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    setLoading(true);
    try {
      await rideTracker.pause();
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('rideActive.pauseFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    setLoading(true);
    try {
      await rideTracker.resume();
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('rideActive.resumeFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const endValue = odometerEnd.trim() ? Number(odometerEnd.replace(',', '.')) : null;
      if (odometerEnd.trim() && !Number.isFinite(endValue)) {
        Alert.alert(t('common.error'), t('rideActive.odometerEndInvalid'));
        return;
      }

      const tollsValue = tolls.trim() ? Number(tolls.replace(',', '.')) : null;
      if (tolls.trim() && !Number.isFinite(tollsValue)) {
        Alert.alert(t('common.error'), t('rideActive.tollsInvalid'));
        return;
      }

      let resolvedEnd = endValue;
      if (resolvedEnd == null && odometerStart.trim()) {
        const startValue = Number(odometerStart.replace(',', '.'));
        if (Number.isFinite(startValue)) {
          resolvedEnd = startValue + distanceKm;
        }
      }

      await rideTracker.stop(resolvedEnd, label.trim() || null, tollsValue);
      refresh();
      router.back();
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('rideActive.stopFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  const isActive = state === 'recording' || state === 'paused';

  return (
    <View style={styles.container}>
      <View style={styles.statsBox}>
        <Text style={styles.distance}>{formatDistance(distanceKm, distanceUnit, 2)}</Text>
        <View style={[styles.statusBadge, state === 'recording' && styles.statusRecording, state === 'paused' && styles.statusPaused]}>
          <Text style={styles.statusText}>{stateLabel}</Text>
        </View>
        {isActive ? (
          <Text style={styles.timing}>
            {t('rideActive.riding', { duration: formatDurationMs(movingDurationMs) })}
            {pausedDurationMs > 0
              ? ` · ${t('rideActive.pausedTime', { duration: formatDurationMs(pausedDurationMs) })}`
              : ''}
          </Text>
        ) : null}
        {isActive ? (
          <Text style={styles.gpsStatus}>
            {t('rideActive.gpsPoints', { count: points.length })}
            {locationGranted === false ? ` · ${t('rideActive.locationDenied')}` : ''}
            {locationGranted !== false && points.length === 0 ? ` · ${t('rideActive.gpsWaiting')}` : ''}
          </Text>
        ) : null}
      </View>

      <MapRoute points={points} height={240} />

      {!isActive ? (
        <View style={styles.form}>
          <Text style={styles.label}>{t('rideActive.odometerStart')}</Text>
          <TextInput
            style={styles.input}
            value={odometerStart}
            onChangeText={setOdometerStart}
            keyboardType="decimal-pad"
            placeholderTextColor={Colors.dark.muted}
            placeholder={t('common.km')}
          />
          <Text style={styles.hint}>{t('rideActive.pauseHint')}</Text>
          <PrimaryButton
            label={loading ? t('rideActive.starting') : t('rideActive.start')}
            onPress={handleStart}
            disabled={loading}
          />
        </View>
      ) : (
        <View style={styles.form}>
          {state === 'recording' ? (
            <PrimaryButton
              label={loading ? t('rideActive.pausing') : t('rideActive.pause')}
              onPress={handlePause}
              variant="secondary"
              disabled={loading}
            />
          ) : (
            <PrimaryButton
              label={loading ? t('rideActive.resuming') : t('rideActive.resume')}
              onPress={handleResume}
              disabled={loading}
            />
          )}

          <Text style={styles.label}>{t('rideActive.tripLabel')}</Text>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder={t('rideActive.placeholderLabel')}
            placeholderTextColor={Colors.dark.muted}
          />
          <Text style={styles.label}>{t('rideActive.tolls')}</Text>
          <TextInput
            style={styles.input}
            value={tolls}
            onChangeText={setTolls}
            keyboardType="decimal-pad"
            placeholderTextColor={Colors.dark.muted}
            placeholder="0"
          />
          <Text style={styles.label}>{t('rideActive.odometerEnd')}</Text>
          <TextInput
            style={styles.input}
            value={odometerEnd}
            onChangeText={setOdometerEnd}
            keyboardType="decimal-pad"
            placeholderTextColor={Colors.dark.muted}
            placeholder={t('common.km')}
          />
          <PrimaryButton
            label={loading ? t('rideActive.stopping') : t('rideActive.stop')}
            onPress={handleStop}
            variant="danger"
            disabled={loading}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    padding: 16,
    gap: 16,
  },
  statsBox: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  distance: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.dark.tint,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statusRecording: {
    backgroundColor: '#1B2A1B',
    borderColor: Colors.dark.success,
  },
  statusPaused: {
    backgroundColor: '#2A2418',
    borderColor: Colors.dark.tint,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  timing: {
    color: Colors.dark.muted,
    fontSize: 13,
  },
  gpsStatus: {
    color: Colors.dark.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  form: {
    gap: 10,
  },
  label: {
    fontSize: 14,
    color: Colors.dark.muted,
  },
  hint: {
    fontSize: 13,
    color: Colors.dark.muted,
    lineHeight: 18,
  },
  input: {
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.dark.text,
    fontSize: 16,
  },
});
