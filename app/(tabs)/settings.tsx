import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import PrimaryButton from '@/components/PrimaryButton';
import CurrencyPicker from '@/components/CurrencyPicker';
import { ToggleRow } from '@/components/ReminderCard';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { autoRideDetector } from '@/lib/auto-ride-detector';
import { syncBackgroundRideDetection } from '@/lib/background-location';
import { normalizeCurrency } from '@/lib/currencies';
import {
  getActiveBike,
  getLatestOdometer,
  getServiceRecords,
  getServiceReminderRules,
  getSettings,
  updateBike,
  updateServiceReminderRule,
  updateSettings,
} from '@/lib/db';
import { useDatabase } from '@/lib/database-context';
import { exportAllDataCsv } from '@/lib/export';
import { importCsvFromPicker } from '@/lib/import-csv';
import { refreshServiceNotifications } from '@/lib/notifications';
import {
  REMINDER_SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  type DistanceUnit,
  type ReminderServiceType,
  type ServiceReminderRule,
  type VolumeUnit,
} from '@/lib/types';

export default function SettingsScreen() {
  const router = useRouter();
  const { refreshKey, refresh } = useDatabase();
  const [bikeName, setBikeName] = useState('');
  const [tankCapacity, setTankCapacity] = useState('17');
  const [currency, setCurrency] = useState('USD');
  const [reserveThreshold, setReserveThreshold] = useState('2.5');
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km');
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>('L');
  const [autoStartRides, setAutoStartRides] = useState(false);
  const [backgroundAutoStart, setBackgroundAutoStart] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [reminderRules, setReminderRules] = useState<ServiceReminderRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    const [settings, bike, rules] = await Promise.all([
      getSettings(),
      getActiveBike(),
      getServiceReminderRules(),
    ]);
    setBikeName(bike.name);
    setTankCapacity(String(bike.tank_capacity_l));
    setCurrency(settings.currency);
    setReserveThreshold(String(bike.reserve_threshold_l));
    setDistanceUnit(settings.distance_unit);
    setVolumeUnit(settings.volume_unit);
    setAutoStartRides(settings.auto_start_rides);
    setBackgroundAutoStart(settings.background_auto_start);
    setNotificationsEnabled(settings.notifications_enabled);
    setReminderRules(rules);
  }, [refreshKey]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const updateRule = (type: ReminderServiceType, patch: Partial<ServiceReminderRule>) => {
    setReminderRules((current) =>
      current.map((rule) => (rule.type === type ? { ...rule, ...patch } : rule))
    );
  };

  const handleSave = async () => {
    const tank = Number(tankCapacity.replace(',', '.'));
    const reserve = Number(reserveThreshold.replace(',', '.'));

    if (!Number.isFinite(tank) || tank <= 0) {
      Alert.alert('Error', 'Enter a valid tank capacity.');
      return;
    }
    if (!Number.isFinite(reserve) || reserve < 0) {
      Alert.alert('Error', 'Enter a valid reserve threshold.');
      return;
    }
    if (!currency.trim() || normalizeCurrency(currency).length < 3) {
      Alert.alert('Error', 'Choose a currency (e.g. USD).');
      return;
    }

    setSaving(true);
    const bike = await getActiveBike();
    await updateBike(bike.id, {
      name: bikeName.trim() || bike.name,
      tank_capacity_l: tank,
      reserve_threshold_l: reserve,
    });
    await updateSettings({
      currency: normalizeCurrency(currency),
      distance_unit: distanceUnit,
      volume_unit: volumeUnit,
      auto_start_rides: autoStartRides,
      background_auto_start: backgroundAutoStart,
      notifications_enabled: notificationsEnabled,
    });
    for (const rule of reminderRules) {
      await updateServiceReminderRule({
        ...rule,
        interval_km: parseOptionalNumber(rule.interval_km),
        interval_days: parseOptionalInt(rule.interval_days),
      });
    }
    await autoRideDetector.sync();
    await syncBackgroundRideDetection(backgroundAutoStart);
    const [rules, records, odometer] = await Promise.all([
      getServiceReminderRules(),
      getServiceRecords(),
      getLatestOdometer(),
    ]);
    await refreshServiceNotifications(rules, records, odometer);
    setSaving(false);
    refresh();
    Alert.alert('Saved', 'Settings updated.');
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportAllDataCsv();
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Could not export data.');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await importCsvFromPicker();
      if (result.fuel === 0 && result.service === 0) return;
      refresh();
      Alert.alert('Import complete', `Imported ${result.fuel} refuelings and ${result.service} service records.`);
    } catch (error) {
      Alert.alert('Import failed', error instanceof Error ? error.message : 'Could not import data.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Motorcycle</Text>
      <PrimaryButton
        label="Manage motorcycles"
        onPress={() => router.push('/bikes')}
        variant="secondary"
      />
      <Field label="Active motorcycle name" value={bikeName} onChangeText={setBikeName} placeholder="My motorcycle" />
      <Field
        label="Tank size (liters)"
        value={tankCapacity}
        onChangeText={setTankCapacity}
        keyboardType="decimal-pad"
        placeholder="e.g. 17"
      />
      <Field
        label="Reserve threshold (liters)"
        value={reserveThreshold}
        onChangeText={setReserveThreshold}
        hint="Dashboard shows a low-fuel warning below this level."
        keyboardType="decimal-pad"
      />

      <Text style={styles.sectionTitle}>Units & currency</Text>
      <UnitPicker label="Distance" value={distanceUnit} options={['km', 'mi']} onChange={setDistanceUnit} />
      <UnitPicker label="Volume" value={volumeUnit} options={['L', 'gal']} onChange={setVolumeUnit} />
      <CurrencyPicker value={currency} onChange={setCurrency} />

      <Text style={styles.sectionTitle}>Ride detection</Text>
      <ToggleRow
        label="Auto-start rides (foreground)"
        hint="Starts recording when speed stays above 25 km/h for 20 seconds while the app is open."
        value={autoStartRides}
        onChange={setAutoStartRides}
      />
      <ToggleRow
        label="Auto-start rides (background)"
        hint="Same detection while the app is in the background. Requires location permission."
        value={backgroundAutoStart}
        onChange={setBackgroundAutoStart}
      />

      <Text style={styles.sectionTitle}>Notifications</Text>
      <ToggleRow
        label="Service reminders"
        hint="Local notifications when service is due soon or overdue."
        value={notificationsEnabled}
        onChange={setNotificationsEnabled}
      />

      <Text style={styles.sectionTitle}>Service reminders</Text>
      {REMINDER_SERVICE_TYPES.map((type) => {
        const rule = reminderRules.find((item) => item.type === type);
        if (!rule) return null;
        return (
          <ReminderRuleEditor
            key={type}
            label={SERVICE_TYPE_LABELS[type]}
            rule={rule}
            onChange={(patch) => updateRule(type, patch)}
          />
        );
      })}

      <PrimaryButton label={saving ? 'Saving...' : 'Save settings'} onPress={handleSave} disabled={saving} />

      <Text style={styles.sectionTitle}>Data</Text>
      <PrimaryButton
        label={exporting ? 'Exporting...' : 'Export CSV'}
        onPress={handleExport}
        variant="secondary"
        disabled={exporting}
      />
      <PrimaryButton
        label={importing ? 'Importing...' : 'Import CSV'}
        onPress={handleImport}
        variant="secondary"
        disabled={importing}
      />
    </ScrollView>
  );
}

function UnitPicker<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.unitRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.unitButtons}>
        {options.map((option) => (
          <Pressable
            key={option}
            style={[styles.unitButton, value === option && styles.unitButtonActive]}
            onPress={() => onChange(option)}>
            <Text style={[styles.unitButtonText, value === option && styles.unitButtonTextActive]}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ReminderRuleEditor({
  label,
  rule,
  onChange,
}: {
  label: string;
  rule: ServiceReminderRule;
  onChange: (patch: Partial<ServiceReminderRule>) => void;
}) {
  return (
    <View style={styles.ruleBox}>
      <View style={styles.ruleHeader}>
        <Text style={styles.ruleTitle}>{label}</Text>
        <Pressable onPress={() => onChange({ enabled: !rule.enabled })}>
          <Text style={[styles.ruleToggle, rule.enabled && styles.ruleToggleOn]}>
            {rule.enabled ? 'On' : 'Off'}
          </Text>
        </Pressable>
      </View>
      <Field
        label="Every (km)"
        value={rule.interval_km != null ? String(rule.interval_km) : ''}
        onChangeText={(value) => onChange({ interval_km: value.trim() ? Number(value.replace(',', '.')) : null })}
        keyboardType="decimal-pad"
        placeholder="e.g. 5000"
      />
      <Field
        label="Every (days)"
        value={rule.interval_days != null ? String(rule.interval_days) : ''}
        onChangeText={(value) => onChange({ interval_days: value.trim() ? Number(value) : null })}
        keyboardType="number-pad"
        placeholder="e.g. 365"
      />
    </View>
  );
}

function parseOptionalNumber(value: number | null): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function parseOptionalInt(value: number | null): number | null {
  return value != null && Number.isFinite(value) ? Math.round(value) : null;
}

function Field({
  label,
  value,
  onChangeText,
  hint,
  keyboardType,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  hint?: string;
  keyboardType?: 'decimal-pad' | 'number-pad' | 'default';
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={Colors.dark.muted}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 14, color: Colors.dark.muted },
  fieldHint: { fontSize: 12, color: Colors.dark.muted },
  input: {
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.dark.text,
    fontSize: 16,
  },
  unitRow: { gap: 8 },
  unitButtons: { flexDirection: 'row', gap: 8 },
  unitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
  },
  unitButtonActive: { backgroundColor: Colors.dark.tint, borderColor: Colors.dark.tint },
  unitButtonText: { color: Colors.dark.text, fontWeight: '600' },
  unitButtonTextActive: { color: '#121212' },
  ruleBox: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 10,
  },
  ruleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ruleTitle: { fontSize: 15, fontWeight: '600' },
  ruleToggle: { color: Colors.dark.muted, fontWeight: '700' },
  ruleToggleOn: { color: Colors.dark.tint },
});
