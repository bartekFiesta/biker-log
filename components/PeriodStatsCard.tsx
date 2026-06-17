import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { formatCurrency, formatDurationMs } from '@/lib/format';
import { useI18n } from '@/lib/i18n/context';
import { formatDistance, formatVolume } from '@/lib/units';
import type { PeriodStats } from '@/lib/types';

interface PeriodStatsCardProps {
  stats: PeriodStats;
  currency: string;
  distanceUnit?: import('@/lib/types').DistanceUnit;
  volumeUnit?: import('@/lib/types').VolumeUnit;
}

export default function PeriodStatsCard({
  stats,
  currency,
  distanceUnit = 'km',
  volumeUnit = 'L',
}: PeriodStatsCardProps) {
  const { t } = useI18n();

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{stats.label}</Text>
      <Row label={t('stats.rides')} value={String(stats.ride_count)} />
      <Row
        label={t('stats.distance')}
        value={formatDistance(stats.total_distance_km, distanceUnit)}
      />
      <Row label={t('stats.ridingTime')} value={formatDurationMs(stats.total_moving_time_ms)} />
      <Row label={t('stats.refuelings')} value={String(stats.refuel_count)} />
      <Row label={t('stats.fuelUsed')} value={formatVolume(stats.liters_total, volumeUnit)} />
      <Row label={t('stats.fuelSpent')} value={formatCurrency(stats.fuel_spent, currency)} />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    color: Colors.dark.muted,
    fontSize: 14,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
  },
});
