import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import MapRoute from '@/components/MapRoute';
import PrimaryButton from '@/components/PrimaryButton';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { getLatestOdometer, getSettings } from '@/lib/db';
import { useDatabase } from '@/lib/database-context';
import { formatDurationMs } from '@/lib/format';
import { formatDistance } from '@/lib/units';
import { rideTracker, type RideTrackerSnapshot } from '@/lib/ride-tracker';
import type { RideRecordingState, RoutePoint } from '@/lib/types';

const STATE_LABELS: Record<RideRecordingState, string> = {
  idle: 'Ready to start',
  recording: 'Recording route',
  paused: 'Paused — not counting distance',
};

export default function ActiveRideScreen() {
  const router = useRouter();
  const { refresh } = useDatabase();
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

  useEffect(() => {
    void (async () => {
      const [latest, settings] = await Promise.all([getLatestOdometer(), getSettings()]);
      if (latest != null) setOdometerStart(String(Math.round(latest)));
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
        Alert.alert('Error', 'Enter a valid starting odometer reading.');
        return;
      }
      await rideTracker.start(startValue);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not start ride.');
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    setLoading(true);
    try {
      await rideTracker.pause();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not pause ride.');
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    setLoading(true);
    try {
      await rideTracker.resume();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not resume ride.');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const endValue = odometerEnd.trim() ? Number(odometerEnd.replace(',', '.')) : null;
      if (odometerEnd.trim() && !Number.isFinite(endValue)) {
        Alert.alert('Error', 'Enter a valid ending odometer reading.');
        return;
      }
      await rideTracker.stop(
        endValue,
        label.trim() || null,
        tolls.trim() ? Number(tolls.replace(',', '.')) : null
      );
      refresh();
      router.back();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not stop ride.');
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
          <Text style={styles.statusText}>{STATE_LABELS[state]}</Text>
        </View>
        {isActive ? (
          <Text style={styles.timing}>
            Riding: {formatDurationMs(movingDurationMs)}
            {pausedDurationMs > 0 ? ` · Paused: ${formatDurationMs(pausedDurationMs)}` : ''}
          </Text>
        ) : null}
      </View>

      <MapRoute points={points} height={240} />

      {!isActive ? (
        <View style={styles.form}>
          <Text style={styles.label}>Starting odometer (optional)</Text>
          <TextInput
            style={styles.input}
            value={odometerStart}
            onChangeText={setOdometerStart}
            keyboardType="decimal-pad"
            placeholderTextColor={Colors.dark.muted}
            placeholder="km"
          />
          <Text style={styles.hint}>
            Pause when you stop (rest area, traffic). Distance is only recorded while riding.
          </Text>
          <PrimaryButton label={loading ? 'Starting...' : 'Start ride'} onPress={handleStart} disabled={loading} />
        </View>
      ) : (
        <View style={styles.form}>
          {state === 'recording' ? (
            <PrimaryButton
              label={loading ? 'Pausing...' : 'Pause'}
              onPress={handlePause}
              variant="secondary"
              disabled={loading}
            />
          ) : (
            <PrimaryButton
              label={loading ? 'Resuming...' : 'Resume riding'}
              onPress={handleResume}
              disabled={loading}
            />
          )}

          <Text style={styles.label}>Trip label (optional)</Text>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Commute"
            placeholderTextColor={Colors.dark.muted}
          />
          <Text style={styles.label}>Tolls cost (optional)</Text>
          <TextInput
            style={styles.input}
            value={tolls}
            onChangeText={setTolls}
            keyboardType="decimal-pad"
            placeholderTextColor={Colors.dark.muted}
            placeholder="0"
          />
          <Text style={styles.label}>Ending odometer (optional)</Text>
          <TextInput
            style={styles.input}
            value={odometerEnd}
            onChangeText={setOdometerEnd}
            keyboardType="decimal-pad"
            placeholderTextColor={Colors.dark.muted}
            placeholder="km"
          />
          <PrimaryButton
            label={loading ? 'Stopping...' : 'Stop ride'}
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
