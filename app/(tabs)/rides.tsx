import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import PrimaryButton from '@/components/PrimaryButton';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { deleteRide, getRides, getSettings } from '@/lib/db';
import { useDatabase } from '@/lib/database-context';
import { formatDateTime, formatDuration } from '@/lib/format';
import { useI18n } from '@/lib/i18n/context';
import { formatDistance } from '@/lib/units';
import { rideTracker } from '@/lib/ride-tracker';
import type { Ride } from '@/lib/types';

export default function RidesScreen() {
  const router = useRouter();
  const { refreshKey, refresh } = useDatabase();
  const { t } = useI18n();
  const [rides, setRides] = useState<Ride[]>([]);
  const [activeRide, setActiveRide] = useState(false);
  const [activeRidePaused, setActiveRidePaused] = useState(false);
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'mi'>('km');

  const load = useCallback(async () => {
    const [data, settings] = await Promise.all([getRides(), getSettings()]);
    setRides(data.filter((ride) => ride.ended_at != null));
    setDistanceUnit(settings.distance_unit);
    const activeId = rideTracker.getRideId() ?? (await rideTracker.ensureRestored());
    setActiveRide(activeId != null);
    setActiveRidePaused(rideTracker.isPaused());
  }, [refreshKey]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleDelete = (ride: Ride) => {
    Alert.alert(t('rides.deleteTitle'), t('rides.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteRide(ride.id);
          refresh();
        },
      },
    ]);
  };

  const handleQuickStop = () => {
    Alert.alert(t('rides.stopTitle'), t('rides.stopMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('rideActive.stop'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await rideTracker.stopQuick();
              refresh();
            } catch (error) {
              Alert.alert(
                t('common.error'),
                error instanceof Error ? error.message : t('rideActive.stopFailed')
              );
            }
          })();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {activeRide ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {activeRidePaused ? t('rides.pausedBanner') : t('rides.recordingBanner')}
          </Text>
          <PrimaryButton label={t('common.open')} onPress={() => router.push('/ride/active')} />
          <PrimaryButton
            label={t('dashboard.stopRide')}
            onPress={handleQuickStop}
            variant="danger"
          />
        </View>
      ) : (
        <View style={styles.header}>
          <PrimaryButton label={t('rides.startRide')} onPress={() => router.push('/ride/active')} />
        </View>
      )}

      <FlatList
        data={rides}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{t('rides.empty')}</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/ride/${item.id}`)}
            onLongPress={() => handleDelete(item)}>
            <Text style={styles.cardTitle}>
              {item.label?.trim() ? item.label : formatDateTime(item.started_at)}
            </Text>
            <Text style={styles.cardMeta}>
              {formatDistance(item.distance_gps_km, distanceUnit, 1)} ·{' '}
              {formatDuration(item.started_at, item.ended_at)}
            </Text>
            {item.odometer_end != null ? (
              <Text style={styles.cardMeta}>
                {t('rides.odometer', {
                  value: formatDistance(item.odometer_end, distanceUnit, 0),
                })}
              </Text>
            ) : null}
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
  banner: {
    padding: 16,
    gap: 8,
    backgroundColor: '#2A2218',
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  bannerText: {
    color: Colors.dark.tint,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  empty: {
    textAlign: 'center',
    color: Colors.dark.muted,
    marginTop: 40,
  },
  card: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 14,
    color: Colors.dark.muted,
  },
});
