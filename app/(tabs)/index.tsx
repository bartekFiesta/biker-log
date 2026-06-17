import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

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
import { refreshServiceNotifications } from '@/lib/notifications';
import { rideTracker } from '@/lib/ride-tracker';
import { computeServiceReminders } from '@/lib/service-reminders';
import {
  formatConsumption,
  formatDistance,
  formatVolume,
} from '@/lib/units';
import { SERVICE_TYPE_LABELS, type ServiceReminderStatus } from '@/lib/types';

export default function DashboardScreen() {
  const router = useRouter();
  const { refreshKey } = useDatabase();
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
    lastRefuel: 'No refuelings yet',
    lastService: 'No service records',
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
    const reminderList = computeServiceReminders(rules, services, odometer);
    setReminders(reminderList);
    void refreshServiceNotifications(rules, services, odometer);

    const lastRefuel = refuelings[0];
    const lastService = services[0];
    const activeId = rideTracker.getRideId();

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
            ? `Measured from ${fuelStatus.sample_count} full-tank refuelings (odometer + GPS)`
            : `Measured from ${fuelStatus.sample_count} full-tank refuelings`
          : fuelStatus.consumption_source === 'default'
            ? fuelStatus.sample_count > 0
              ? `Default consumption until more full-tank data (${fuelStatus.sample_count}/2 samples)`
              : 'Default consumption — add full-tank refuelings to calibrate'
            : 'Set average consumption in Settings',
      lastRefuel: lastRefuel
        ? `${formatDate(lastRefuel.date)} · ${formatVolume(lastRefuel.liters, settings.volume_unit)}`
        : 'No refuelings yet',
      lastService: lastService
        ? `${SERVICE_TYPE_LABELS[lastService.type]} · ${formatDate(lastService.date)}`
        : 'No service records',
      lowFuel:
        fuelStatus.fuel_remaining_l != null &&
        fuelStatus.fuel_remaining_l <= bike.reserve_threshold_l,
    });
    setLoading(false);
  }, [refreshKey]);

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Biker Log</Text>
      <Text style={styles.subheading}>{bikeName || 'Your motorcycle'} — fuel, rides, service</Text>

      <View style={styles.statsRow}>
        <StatCard label="Avg. consumption" value={stats.consumption} hint={stats.sampleHint} />
        <StatCard
          label="Fuel in tank"
          value={stats.fuelRemaining}
          accent={stats.lowFuel ? 'warning' : 'default'}
        />
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Until empty" value={stats.kmToEmpty} />
        <StatCard label="Last service" value={stats.lastService} />
      </View>

      {parkedCoords ? (
        <Pressable style={styles.infoBox} onPress={openParkedLocation}>
          <Text style={styles.infoLabel}>Find my bike</Text>
          <Text style={styles.infoValue}>Open last parked location in Maps</Text>
          {parkedAt ? (
            <Text style={styles.infoHint}>Parked {formatDateTime(parkedAt)}</Text>
          ) : null}
        </Pressable>
      ) : null}

      <View style={styles.infoBox}>
        <Text style={styles.infoLabel}>Service reminders</Text>
        <ReminderList reminders={reminders} />
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoLabel}>Tank size</Text>
        <Text style={styles.infoValue}>{stats.tankCapacity}</Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoLabel}>Last refueling</Text>
        <Text style={styles.infoValue}>{stats.lastRefuel}</Text>
      </View>

      <PrimaryButton
        label={
          activeRide
            ? activeRidePaused
              ? 'Return to paused ride'
              : 'Return to active ride'
            : 'Start ride'
        }
        onPress={() => router.push('/ride/active')}
        disabled={loading}
      />
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
