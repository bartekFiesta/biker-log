import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  accent?: 'default' | 'warning' | 'success';
}

export default function StatCard({ label, value, hint, accent = 'default' }: StatCardProps) {
  const valueColor =
    accent === 'warning'
      ? Colors.dark.danger
      : accent === 'success'
        ? Colors.dark.success
        : Colors.dark.tint;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
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
    flex: 1,
    minWidth: '45%',
  },
  label: {
    fontSize: 13,
    color: Colors.dark.muted,
    marginBottom: 6,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    color: Colors.dark.muted,
    marginTop: 4,
  },
});
