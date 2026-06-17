import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useI18n } from '@/lib/i18n/context';

interface SimpleBarChartProps {
  title: string;
  data: { label: string; value: number }[];
  unit?: string;
  formatValue?: (value: number) => string;
}

export default function SimpleBarChart({
  title,
  data,
  unit = '',
  formatValue,
}: SimpleBarChartProps) {
  const { t } = useI18n();

  if (data.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.empty}>{t('stats.notEnoughData')}</Text>
      </View>
    );
  }

  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {data.map((item) => (
        <View key={item.label} style={styles.row}>
          <Text style={styles.label}>{item.label}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(item.value / max) * 100}%` }]} />
          </View>
          <Text style={styles.value}>
            {formatValue ? formatValue(item.value) : `${item.value.toFixed(1)}${unit ? ` ${unit}` : ''}`}
          </Text>
        </View>
      ))}
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
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  empty: {
    color: Colors.dark.muted,
    fontSize: 13,
  },
  row: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: Colors.dark.muted,
  },
  barTrack: {
    height: 10,
    backgroundColor: Colors.dark.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.dark.tint,
    borderRadius: 999,
  },
  value: {
    fontSize: 12,
    fontWeight: '600',
  },
});
