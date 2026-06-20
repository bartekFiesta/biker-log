import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import PrimaryButton from '@/components/PrimaryButton';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { deleteRide, getActiveBike, getActiveRide, getLatestOdometer, getRefuelings, getRides, getSettings } from '@/lib/db';
import { useDatabase } from '@/lib/database-context';
import { formatDateTime, formatDuration, formatCurrency } from '@/lib/format';
import { computeFuelStatus, computeRideFuelEstimate } from '@/lib/fuel-calculations';
import { useI18n } from '@/lib/i18n/context';
import { formatDistance, formatVolume } from '@/lib/units';
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
  const [volumeUnit, setVolumeUnit] = useState<'L' | 'gal'>('L');
  const [currency, setCurrency] = useState('USD');
  const [consumptionLPer100km, setConsumptionLPer100km] = useState<number | null>(null);
  const [refuelings, setRefuelings] = useState<Awaited<ReturnType<typeof getRefuelings>>>([]);

  const load = useCallback(async () => {
    const [data, settings, fuelRecords, bike, odometer] = await Promise.all([
      getRides(),
      getSettings(),
      getRefuelings(),
      getActiveBike(),
      getLatestOdometer(),
    ]);
    const fuelStatus = computeFuelStatus(
      bike.tank_capacity_l,
      fuelRecords,
      data,
      odometer,
      bike.default_consumption_l_per_100km,
      bike.baseline_odometer_km
    );
    setRides(data.filter((ride) => ride.ended_at != null));
    setDistanceUnit(settings.distance_unit);
    setVolumeUnit(settings.volume_unit);
    setCurrency(settings.currency);
    setConsumptionLPer100km(fuelStatus.avg_consumption_l_per_100km);
    setRefuelings(fuelRecords);
    const activeFromDb = await getActiveRide();
    if (activeFromDb && rideTracker.getRideId() == null) {
      await rideTracker.restore({ startGps: false });
    }
    setActiveRide(rideTracker.getRideId() != null || activeFromDb != null);
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

  const handleDiscard = () => {
    Alert.alert(t('rides.discardTitle'), t('rides.discardMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await rideTracker.discardActiveRide();
              refresh();
            } catch (error) {
              Alert.alert(
                t('common.error'),
                error instanceof Error ? error.message : t('rides.discardFailed')
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
          <PrimaryButton
            label={t('rides.discardRide')}
            onPress={handleDiscard}
            variant="secondary"
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
        ListHeaderComponent={
          rides.length > 0 ? (
            <Text style={styles.listHint}>{t('rides.deleteHint')}</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const fuel = computeRideFuelEstimate(item, refuelings, consumptionLPer100km);
          return (
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
            {fuel ? (
              <Text style={styles.cardMeta}>
                {formatVolume(fuel.liters, volumeUnit, 1)} ·{' '}
                {t('rides.fuelCost', { cost: formatCurrency(fuel.cost, currency) })}
              </Text>
            ) : null}
            {item.odometer_end != null ? (
              <Text style={styles.cardMeta}>
                {t('rides.odometer', {
                  value: formatDistance(item.odometer_end, distanceUnit, 0),
                })}
              </Text>
            ) : null}
          </Pressable>
          );
        }}
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
  listHint: {
    fontSize: 12,
    color: Colors.dark.muted,
    marginBottom: 8,
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
