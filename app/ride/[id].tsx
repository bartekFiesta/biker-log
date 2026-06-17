import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import MapRoute from '@/components/MapRoute';
import PrimaryButton from '@/components/PrimaryButton';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { getRide, getSettings } from '@/lib/db';
import { formatCurrency, formatDateTime, formatDuration, formatDurationMs } from '@/lib/format';
import { useI18n } from '@/lib/i18n/context';
import { computeRideSpeedStats } from '@/lib/ride-speed';
import { formatDistance } from '@/lib/units';
import type { Ride } from '@/lib/types';

export default function RideDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const [ride, setRide] = useState<Ride | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'mi'>('km');

  useEffect(() => {
    void (async () => {
      const rideId = Number(id);
      if (!Number.isFinite(rideId)) return;
      const [rideData, settings] = await Promise.all([getRide(rideId), getSettings()]);
      setRide(rideData);
      setCurrency(settings.currency);
      setDistanceUnit(settings.distance_unit);
    })();
  }, [id]);

  if (!ride) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>{t('rideDetails.loading')}</Text>
      </View>
    );
  }

  const speedStats = computeRideSpeedStats(ride.route_points);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <MapRoute points={ride.route_points} height={280} />

      <View style={styles.stats}>
        {ride.label ? <Stat label={t('rideDetails.label')} value={ride.label} /> : null}
        <Stat label={t('rideDetails.start')} value={formatDateTime(ride.started_at)} />
        <Stat label={t('rideDetails.duration')} value={formatDuration(ride.started_at, ride.ended_at)} />
        <Stat
          label={t('rideDetails.gpsDistance')}
          value={formatDistance(ride.distance_gps_km, distanceUnit, 2)}
        />
        {speedStats ? (
          <>
            <Stat
              label={t('rideDetails.avgSpeed')}
              value={t('rideDetails.speedKmh', { value: Math.round(speedStats.avg_kmh) })}
            />
            <Stat
              label={t('rideDetails.maxSpeed')}
              value={t('rideDetails.speedKmh', { value: Math.round(speedStats.max_kmh) })}
            />
          </>
        ) : null}
        {ride.odometer_start != null ? (
          <Stat
            label={t('rideDetails.odometerStart')}
            value={formatDistance(ride.odometer_start, distanceUnit, 0)}
          />
        ) : null}
        {ride.odometer_end != null ? (
          <Stat
            label={t('rideDetails.odometerEnd')}
            value={formatDistance(ride.odometer_end, distanceUnit, 0)}
          />
        ) : null}
        {ride.tolls_cost != null ? (
          <Stat label={t('rideDetails.tolls')} value={formatCurrency(ride.tolls_cost, currency)} />
        ) : null}
        {ride.paused_duration_ms > 0 ? (
          <Stat
            label={t('rideDetails.pausedTime')}
            value={formatDurationMs(ride.paused_duration_ms)}
          />
        ) : null}
        <Stat label={t('rideDetails.gpsPoints')} value={String(ride.route_points.length)} />
      </View>

      <PrimaryButton
        label={t('rideDetails.edit')}
        onPress={() => router.push(`/ride/edit/${ride.id}`)}
        variant="secondary"
      />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  empty: {
    padding: 24,
    textAlign: 'center',
    color: Colors.dark.muted,
  },
  stats: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    color: Colors.dark.muted,
    fontSize: 14,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
  },
});
