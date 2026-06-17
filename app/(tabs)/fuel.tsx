import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import PrimaryButton from '@/components/PrimaryButton';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { deleteRefueling, getRefuelings, getSettings } from '@/lib/db';
import { useDatabase } from '@/lib/database-context';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { formatDistance, formatVolume } from '@/lib/units';
import type { Refueling } from '@/lib/types';

export default function FuelScreen() {
  const router = useRouter();
  const { refreshKey, refresh } = useDatabase();
  const [refuelings, setRefuelings] = useState<Refueling[]>([]);
  const [currency, setCurrency] = useState('USD');

  const [distanceUnit, setDistanceUnit] = useState<'km' | 'mi'>('km');
  const [volumeUnit, setVolumeUnit] = useState<'L' | 'gal'>('L');

  const load = useCallback(async () => {
    const [data, settings] = await Promise.all([getRefuelings(), getSettings()]);
    setRefuelings(data);
    setCurrency(settings.currency);
    setDistanceUnit(settings.distance_unit);
    setVolumeUnit(settings.volume_unit);
  }, [refreshKey]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleDelete = (item: Refueling) => {
    Alert.alert('Delete refueling', 'Are you sure you want to delete this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteRefueling(item.id);
          refresh();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <PrimaryButton label="Add refueling" onPress={() => router.push('/fuel/add')} />
      </View>

      <FlatList
        data={refuelings}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No refuelings yet. Add your first refueling with odometer reading.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/fuel/${item.id}`)}
            onLongPress={() => handleDelete(item)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{formatDateTime(item.date)}</Text>
              <Text style={[styles.badge, item.is_full_tank ? styles.badgeFull : styles.badgePartial]}>
                {item.is_full_tank ? 'Full tank' : 'Partial'}
              </Text>
            </View>
            <Text style={styles.cardMeta}>
              {formatVolume(item.liters, volumeUnit, 2)} · {formatCurrency(item.total_price, currency)} ·{' '}
              {formatCurrency(item.price_per_liter, currency)}/{volumeUnit === 'gal' ? 'gal' : 'L'}
            </Text>
            <Text style={styles.cardMeta}>
              Odometer: {formatDistance(item.odometer_km, distanceUnit, 0)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    padding: 16,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  empty: {
    textAlign: 'center',
    color: Colors.dark.muted,
    marginTop: 40,
    lineHeight: 22,
  },
  card: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeFull: {
    color: Colors.dark.success,
  },
  badgePartial: {
    color: Colors.dark.tint,
  },
  cardMeta: {
    fontSize: 14,
    color: Colors.dark.muted,
    marginTop: 2,
  },
});
