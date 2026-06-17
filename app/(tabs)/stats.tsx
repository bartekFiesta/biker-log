import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import PeriodStatsCard from '@/components/PeriodStatsCard';
import SimpleBarChart from '@/components/SimpleBarChart';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import {
  buildMonthlyDistanceChart,
  buildMonthlyFuelChart,
  buildMonthlySpendChart,
} from '@/lib/chart-data';
import { getRefuelings, getRides, getSettings } from '@/lib/db';
import { useDatabase } from '@/lib/database-context';
import { formatCurrency } from '@/lib/format';
import { useI18n } from '@/lib/i18n/context';
import { computeAllPeriodStats } from '@/lib/statistics';
import { formatDistance, formatVolume } from '@/lib/units';
import type { DistanceUnit, VolumeUnit } from '@/lib/types';

export default function StatsScreen() {
  const { refreshKey } = useDatabase();
  const { t, language } = useI18n();
  const [currency, setCurrency] = useState('USD');
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km');
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>('L');
  const [periods, setPeriods] = useState(() => computeAllPeriodStats([], [], undefined, language));
  const [distanceChart, setDistanceChart] = useState<{ label: string; value: number }[]>([]);
  const [fuelChart, setFuelChart] = useState<{ label: string; value: number }[]>([]);
  const [spendChart, setSpendChart] = useState<{ label: string; value: number }[]>([]);

  const load = useCallback(async () => {
    const [rides, refuelings, settings] = await Promise.all([
      getRides(),
      getRefuelings(),
      getSettings(),
    ]);
    setCurrency(settings.currency);
    setDistanceUnit(settings.distance_unit);
    setVolumeUnit(settings.volume_unit);
    setPeriods(computeAllPeriodStats(rides, refuelings, undefined, language));
    setDistanceChart(buildMonthlyDistanceChart(rides));
    setFuelChart(buildMonthlyFuelChart(refuelings));
    setSpendChart(buildMonthlySpendChart(refuelings));
  }, [refreshKey, language]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{t('stats.title')}</Text>
      <Text style={styles.subheading}>{t('stats.subtitle')}</Text>

      {periods.map((period) => (
        <PeriodStatsCard
          key={period.period}
          stats={period}
          currency={currency}
          distanceUnit={distanceUnit}
          volumeUnit={volumeUnit}
        />
      ))}

      <SimpleBarChart
        title={t('stats.chartDistance')}
        data={distanceChart}
        formatValue={(value) => formatDistance(value, distanceUnit)}
      />
      <SimpleBarChart
        title={t('stats.chartFuel')}
        data={fuelChart}
        formatValue={(value) => formatVolume(value, volumeUnit)}
      />
      <SimpleBarChart
        title={t('stats.chartSpend')}
        data={spendChart}
        formatValue={(value) => formatCurrency(value, currency)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  heading: { fontSize: 22, fontWeight: '800' },
  subheading: { fontSize: 14, color: Colors.dark.muted, marginTop: -8 },
});
