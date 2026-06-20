import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import PrimaryButton from '@/components/PrimaryButton';
import CurrencyPicker from '@/components/CurrencyPicker';
import { ToggleRow } from '@/components/ReminderCard';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { getAppVersionLabel } from '@/lib/app-info';
import { autoRideDetector } from '@/lib/auto-ride-detector';
import { syncRideDetection } from '@/lib/ride-detection';
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
import { useI18n } from '@/lib/i18n/context';
import type { AppLanguage } from '@/lib/i18n';
import { refreshServiceNotifications } from '@/lib/notifications';
import {
  REMINDER_SERVICE_TYPES,
  type DistanceUnit,
  type ReminderServiceType,
  type ServiceReminderRule,
  type VolumeUnit,
} from '@/lib/types';

export default function SettingsScreen() {
  const router = useRouter();
  const { refreshKey, refresh } = useDatabase();
  const { t, language, setLanguage } = useI18n();
  const [bikeName, setBikeName] = useState('');
  const [tankCapacity, setTankCapacity] = useState('17');
  const [defaultConsumption, setDefaultConsumption] = useState('');
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
    setDefaultConsumption(
      bike.default_consumption_l_per_100km != null ? String(bike.default_consumption_l_per_100km) : ''
    );
    setCurrency(settings.currency);
    setReserveThreshold(String(bike.reserve_threshold_l));
    setDistanceUnit(settings.distance_unit);
    setVolumeUnit(settings.volume_unit);
    setAutoStartRides(settings.auto_start_rides);
    setBackgroundAutoStart(settings.background_auto_start);
    setNotificationsEnabled(settings.notifications_enabled);
    setReminderRules(rules);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const persistToggleSettings = async (
    patch: Partial<{
      auto_start_rides: boolean;
      background_auto_start: boolean;
      notifications_enabled: boolean;
    }>
  ) => {
    await updateSettings(patch);
    if ('auto_start_rides' in patch || 'background_auto_start' in patch) {
      await autoRideDetector.sync();
      await syncRideDetection();
    }
    if ('notifications_enabled' in patch) {
      const [rules, records, odometer] = await Promise.all([
        getServiceReminderRules(),
        getServiceRecords(),
        getLatestOdometer(),
      ]);
      await refreshServiceNotifications(rules, records, odometer);
    }
  };

  const handleAutoStartRidesChange = (value: boolean) => {
    setAutoStartRides(value);
    void persistToggleSettings({ auto_start_rides: value }).catch(() => {
      void load();
      Alert.alert(t('common.error'), t('settings.saveFailed'));
    });
  };

  const handleBackgroundAutoStartChange = (value: boolean) => {
    setBackgroundAutoStart(value);
    void persistToggleSettings({ background_auto_start: value }).catch(() => {
      void load();
      Alert.alert(t('common.error'), t('settings.saveFailed'));
    });
  };

  const handleNotificationsChange = (value: boolean) => {
    setNotificationsEnabled(value);
    void persistToggleSettings({ notifications_enabled: value }).catch(() => {
      void load();
      Alert.alert(t('common.error'), t('settings.saveFailed'));
    });
  };

  const updateRule = (type: ReminderServiceType, patch: Partial<ServiceReminderRule>) => {
    setReminderRules((current) =>
      current.map((rule) => (rule.type === type ? { ...rule, ...patch } : rule))
    );
  };

  const handleSave = async () => {
    const tank = Number(tankCapacity.replace(',', '.'));
    const reserve = Number(reserveThreshold.replace(',', '.'));

    if (!Number.isFinite(tank) || tank <= 0) {
      Alert.alert(t('common.error'), t('settings.tankInvalid'));
      return;
    }
    if (!Number.isFinite(reserve) || reserve < 0) {
      Alert.alert(t('common.error'), t('settings.reserveInvalid'));
      return;
    }
    const consumptionValue = defaultConsumption.trim()
      ? Number(defaultConsumption.replace(',', '.'))
      : null;
    if (
      defaultConsumption.trim() &&
      (!Number.isFinite(consumptionValue) || consumptionValue! <= 0)
    ) {
      Alert.alert(t('common.error'), t('settings.consumptionInvalid'));
      return;
    }
    if (!currency.trim() || normalizeCurrency(currency).length < 3) {
      Alert.alert(t('common.error'), t('settings.currencyInvalid'));
      return;
    }

    setSaving(true);
    const bike = await getActiveBike();
    await updateBike(bike.id, {
      name: bikeName.trim() || bike.name,
      tank_capacity_l: tank,
      reserve_threshold_l: reserve,
      default_consumption_l_per_100km: consumptionValue,
    });
    await updateSettings({
      currency: normalizeCurrency(currency),
      distance_unit: distanceUnit,
      volume_unit: volumeUnit,
      auto_start_rides: autoStartRides,
      background_auto_start: backgroundAutoStart,
      notifications_enabled: notificationsEnabled,
      app_language: language,
    });
    for (const rule of reminderRules) {
      await updateServiceReminderRule({
        ...rule,
        interval_km: parseOptionalNumber(rule.interval_km),
        interval_days: parseOptionalInt(rule.interval_days),
      });
    }
    await autoRideDetector.sync();
    await syncRideDetection();
    const [rules, records, odometer] = await Promise.all([
      getServiceReminderRules(),
      getServiceRecords(),
      getLatestOdometer(),
    ]);
    await refreshServiceNotifications(rules, records, odometer);
    setSaving(false);
    refresh();
    Alert.alert(t('settings.saved'));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportAllDataCsv();
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('settings.exportFailed')
      );
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
      Alert.alert(
        t('settings.importComplete', { fuel: result.fuel, service: result.service })
      );
    } catch (error) {
      Alert.alert(
        t('common.error'),
        error instanceof Error ? error.message : t('settings.importFailed')
      );
    } finally {
      setImporting(false);
    }
  };

  const handleLanguageChange = (next: AppLanguage) => {
    void setLanguage(next);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>{t('settings.motorcycle')}</Text>
      <PrimaryButton
        label={t('settings.manageBikes')}
        onPress={() => router.push('/bikes')}
        variant="secondary"
      />
      <Field
        label={t('settings.bikeName')}
        value={bikeName}
        onChangeText={setBikeName}
        placeholder={t('onboarding.placeholderName')}
      />
      <Field
        label={t('settings.tankSize')}
        value={tankCapacity}
        onChangeText={setTankCapacity}
        keyboardType="decimal-pad"
        placeholder={t('onboarding.placeholderTank')}
      />
      <Field
        label={t('settings.avgConsumption')}
        value={defaultConsumption}
        onChangeText={setDefaultConsumption}
        keyboardType="decimal-pad"
        placeholder={t('onboarding.placeholderConsumption')}
        hint={t('settings.consumptionHint')}
      />

      <View style={styles.languageRow}>
        <Text style={styles.fieldLabel}>{t('settings.language')}</Text>
        <View style={styles.unitButtons}>
          <Pressable
            style={[styles.unitButton, language === 'en' && styles.unitButtonActive]}
            onPress={() => handleLanguageChange('en')}>
            <Text style={[styles.unitButtonText, language === 'en' && styles.unitButtonTextActive]}>
              {t('settings.languageEn')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.unitButton, language === 'es' && styles.unitButtonActive]}
            onPress={() => handleLanguageChange('es')}>
            <Text style={[styles.unitButtonText, language === 'es' && styles.unitButtonTextActive]}>
              {t('settings.languageEs')}
            </Text>
          </Pressable>
        </View>
      </View>

      <Field
        label={t('settings.reserve')}
        value={reserveThreshold}
        onChangeText={setReserveThreshold}
        hint={t('settings.reserveHint')}
        keyboardType="decimal-pad"
      />

      <Text style={styles.sectionTitle}>{t('settings.unitsCurrency')}</Text>
      <UnitPicker label={t('settings.distance')} value={distanceUnit} options={['km', 'mi']} onChange={setDistanceUnit} />
      <UnitPicker label={t('settings.volume')} value={volumeUnit} options={['L', 'gal']} onChange={setVolumeUnit} />
      <CurrencyPicker value={currency} onChange={setCurrency} />

      <Text style={styles.sectionTitle}>{t('settings.rideDetection')}</Text>
      <ToggleRow
        label={t('settings.autoStartFg')}
        hint={t('settings.autoStartFgHint')}
        value={autoStartRides}
        onChange={handleAutoStartRidesChange}
      />
      <ToggleRow
        label={t('settings.autoStartBg')}
        hint={t('settings.autoStartBgHint')}
        value={backgroundAutoStart}
        onChange={handleBackgroundAutoStartChange}
      />

      <Text style={styles.sectionTitle}>{t('settings.notifications')}</Text>
      <ToggleRow
        label={t('settings.serviceReminders')}
        hint={t('settings.notificationsHint')}
        value={notificationsEnabled}
        onChange={handleNotificationsChange}
      />

      <Text style={styles.sectionTitle}>{t('settings.serviceReminders')}</Text>
      {REMINDER_SERVICE_TYPES.map((type) => {
        const rule = reminderRules.find((item) => item.type === type);
        if (!rule) return null;
        return (
          <ReminderRuleEditor
            key={type}
            label={t(`serviceTypes.${type}`)}
            rule={rule}
            onChange={(patch) => updateRule(type, patch)}
            t={t}
          />
        );
      })}

      <PrimaryButton
        label={saving ? t('common.saving') : t('settings.saveSettings')}
        onPress={handleSave}
        disabled={saving}
      />

      <Text style={styles.sectionTitle}>{t('settings.data')}</Text>
      <PrimaryButton
        label={exporting ? t('settings.exporting') : t('settings.exportCsv')}
        onPress={handleExport}
        variant="secondary"
        disabled={exporting}
      />
      <PrimaryButton
        label={importing ? t('settings.importing') : t('settings.importCsv')}
        onPress={handleImport}
        variant="secondary"
        disabled={importing}
      />

      <View style={styles.versionBox}>
        <Text style={styles.versionLabel}>{t('settings.appVersion')}</Text>
        <Text style={styles.versionValue}>{getAppVersionLabel()}</Text>
      </View>
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
  t,
}: {
  label: string;
  rule: ServiceReminderRule;
  onChange: (patch: Partial<ServiceReminderRule>) => void;
  t: (key: string) => string;
}) {
  return (
    <View style={styles.ruleBox}>
      <View style={styles.ruleHeader}>
        <Text style={styles.ruleTitle}>{label}</Text>
        <Pressable onPress={() => onChange({ enabled: !rule.enabled })}>
          <Text style={[styles.ruleToggle, rule.enabled && styles.ruleToggleOn]}>
            {rule.enabled ? t('common.on') : t('common.off')}
          </Text>
        </Pressable>
      </View>
      <Field
        label={t('settings.everyKm')}
        value={rule.interval_km != null ? String(rule.interval_km) : ''}
        onChangeText={(value) => onChange({ interval_km: value.trim() ? Number(value.replace(',', '.')) : null })}
        keyboardType="decimal-pad"
        placeholder="e.g. 5000"
      />
      <Field
        label={t('settings.everyDays')}
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
  languageRow: { gap: 8 },
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
  versionBox: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    alignItems: 'center',
    gap: 4,
  },
  versionLabel: { fontSize: 12, color: Colors.dark.muted },
  versionValue: { fontSize: 14, fontWeight: '600', color: Colors.dark.text },
});
