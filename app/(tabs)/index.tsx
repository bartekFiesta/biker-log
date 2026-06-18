import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View, Alert } from 'react-native';

import PrimaryButton from '@/components/PrimaryButton';
import { ReminderList } from '@/components/ReminderCard';
import StatCard from '@/components/StatCard';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import {
  getActiveBike,
  getLatestOdometer,
  getRefuelings,
  getRides,
  getServiceRecords,
  getServiceReminderRules,
  getSettings,
} from '@/lib/db';
import { useDatabase } from '@/lib/database-context';
import { computeFuelStatus } from '@/lib/fuel-calculations';
import { formatDate, formatDateTime } from '@/lib/format';
import { useI18n } from '@/lib/i18n/context';
import { refreshServiceNotifications } from '@/lib/notifications';
import { rideTracker } from '@/lib/ride-tracker';
import { computeServiceReminders } from '@/lib/service-reminders';
import {
  formatConsumption,
  formatDistance,
  formatVolume,
} from '@/lib/units';
import type { ServiceReminderStatus } from '@/lib/types';

export default function DashboardScreen() {
  const router = useRouter();
  const { refreshKey, refresh } = useDatabase();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [activeRide, setActiveRide] = useState(false);
  const [activeRidePaused, setActiveRidePaused] = useState(false);
  const [bikeName, setBikeName] = useState('');
  const [parkedAt, setParkedAt] = useState<string | null>(null);
  const [parkedCoords, setParkedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [reminders, setReminders] = useState<ServiceReminderStatus[]>([]);
  const [stats, setStats] = useState({
    consumption: '—',
    fuelRemaining: '—',
    kmToEmpty: '—',
    tankCapacity: '—',
    sampleHint: '',
    lastRefuel: '',
    lastService: '',
    lowFuel: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [settings, bike, refuelings, rides, services, rules] = await Promise.all([
      getSettings(),
      getActiveBike(),
      getRefuelings(),
      getRides(),
      getServiceRecords(),
      getServiceReminderRules(),
    ]);
    const odometer = await getLatestOdometer();
    const fuelStatus = computeFuelStatus(
      bike.tank_capacity_l,
      refuelings,
      rides,
      odometer,
      bike.default_consumption_l_per_100km,
      bike.baseline_odometer_km
    );
    const reminderList = computeServiceReminders(rules, services, odometer, t);
    setReminders(reminderList);
    void refreshServiceNotifications(rules, services, odometer);

    const lastRefuel = refuelings[0];
    const lastService = services[0];
    const activeId = rideTracker.getRideId() ?? (await rideTracker.ensureRestored());

    setBikeName(bike.name);
    setParkedAt(settings.parked_at);
    setParkedCoords(
      settings.parked_lat != null && settings.parked_lng != null
        ? { lat: settings.parked_lat, lng: settings.parked_lng }
        : null
    );
    setActiveRide(activeId != null);
    setActiveRidePaused(rideTracker.isPaused());
    setStats({
      consumption:
        fuelStatus.avg_consumption_l_per_100km != null
          ? formatConsumption(
              fuelStatus.avg_consumption_l_per_100km,
              settings.volume_unit,
              settings.distance_unit
            )
          : '—',
      fuelRemaining:
        fuelStatus.fuel_remaining_l != null
          ? `${formatVolume(fuelStatus.fuel_remaining_l, settings.volume_unit)} (${Math.round(fuelStatus.fuel_remaining_pct ?? 0)}%)`
          : '—',
      kmToEmpty:
        fuelStatus.km_to_empty != null
          ? formatDistance(fuelStatus.km_to_empty, settings.distance_unit, 0)
          : '—',
      tankCapacity: formatVolume(bike.tank_capacity_l, settings.volume_unit),
      sampleHint:
        fuelStatus.consumption_source === 'measured'
          ? fuelStatus.gps_assisted_sample_count > 0
            ? t('dashboard.measuredGps', { count: fuelStatus.sample_count })
            : t('dashboard.measured', { count: fuelStatus.sample_count })
          : fuelStatus.consumption_source === 'default'
            ? fuelStatus.sample_count > 0
              ? t('dashboard.defaultPartial', { count: fuelStatus.sample_count })
              : t('dashboard.defaultCalibrate')
            : t('dashboard.setInSettings'),
      lastRefuel: lastRefuel
        ? `${formatDate(lastRefuel.date)} · ${formatVolume(lastRefuel.liters, settings.volume_unit)}`
        : t('dashboard.noRefuelings'),
      lastService: lastService
        ? `${t(`serviceTypes.${lastService.type}`)} · ${formatDate(lastService.date)}`
        : t('dashboard.noService'),
      lowFuel:
        fuelStatus.fuel_remaining_l != null &&
        fuelStatus.fuel_remaining_l <= bike.reserve_threshold_l,
    });
    setLoading(false);
  }, [refreshKey, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const openParkedLocation = () => {
    if (!parkedCoords) return;
    void Linking.openURL(
      `https://maps.google.com/?q=${parkedCoords.lat},${parkedCoords.lng}`
    );
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{t('dashboard.title')}</Text>
      <Text style={styles.subheading}>
        {t('dashboard.subtitle', { bike: bikeName || t('dashboard.yourMotorcycle') })}
      </Text>

      <View style={styles.statsRow}>
        <StatCard label={t('dashboard.avgConsumption')} value={stats.consumption} hint={stats.sampleHint} />
        <StatCard
          label={t('dashboard.fuelInTank')}
          value={stats.fuelRemaining}
          accent={stats.lowFuel ? 'warning' : 'default'}
        />
      </View>

      <View style={styles.statsRow}>
        <StatCard label={t('dashboard.untilEmpty')} value={stats.kmToEmpty} />
        <StatCard label={t('dashboard.lastService')} value={stats.lastService} />
      </View>

      {parkedCoords ? (
        <Pressable style={styles.infoBox} onPress={openParkedLocation}>
          <Text style={styles.infoLabel}>{t('dashboard.findMyBike')}</Text>
          <Text style={styles.infoValue}>{t('dashboard.openParkedMaps')}</Text>
          {parkedAt ? (
            <Text style={styles.infoHint}>
              {t('dashboard.parkedAt', { datetime: formatDateTime(parkedAt) })}
            </Text>
          ) : null}
        </Pressable>
      ) : null}

      <View style={styles.infoBox}>
        <Text style={styles.infoLabel}>{t('dashboard.serviceReminders')}</Text>
        <ReminderList reminders={reminders} />
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoLabel}>{t('dashboard.tankSize')}</Text>
        <Text style={styles.infoValue}>{stats.tankCapacity}</Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoLabel}>{t('dashboard.lastRefueling')}</Text>
        <Text style={styles.infoValue}>{stats.lastRefuel}</Text>
      </View>

      <PrimaryButton
        label={
          activeRide
            ? activeRidePaused
              ? t('dashboard.returnPaused')
              : t('dashboard.returnActive')
            : t('dashboard.startRide')
        }
        onPress={() => router.push('/ride/active')}
        disabled={loading}
      />
      {activeRide ? (
        <PrimaryButton
          label={t('dashboard.stopRide')}
          onPress={handleQuickStop}
          variant="danger"
          disabled={loading}
        />
      ) : null}
    </ScrollView>
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
    paddingBottom: 32,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
  },
  subheading: {
    fontSize: 14,
    color: Colors.dark.muted,
    marginTop: -8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  infoBox: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.dark.muted,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoHint: {
    fontSize: 12,
    color: Colors.dark.muted,
    marginTop: 4,
  },
});
