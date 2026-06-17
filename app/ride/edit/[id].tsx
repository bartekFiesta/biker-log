import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import PrimaryButton from '@/components/PrimaryButton';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { getRide, getSettings, updateRideDetails } from '@/lib/db';
import { useDatabase } from '@/lib/database-context';
import { useI18n } from '@/lib/i18n/context';

export default function EditRideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { refresh } = useDatabase();
  const { t } = useI18n();
  const [label, setLabel] = useState('');
  const [tolls, setTolls] = useState('');
  const [odometerStart, setOdometerStart] = useState('');
  const [odometerEnd, setOdometerEnd] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const rideId = Number(id);
      if (!Number.isFinite(rideId)) return;
      const [ride, settings] = await Promise.all([getRide(rideId), getSettings()]);
      if (!ride) {
        Alert.alert(t('common.notFound'), t('rideEdit.notFound'));
        router.back();
        return;
      }
      setCurrency(settings.currency);
      setLabel(ride.label ?? '');
      setTolls(ride.tolls_cost != null ? String(ride.tolls_cost) : '');
      setOdometerStart(ride.odometer_start != null ? String(Math.round(ride.odometer_start)) : '');
      setOdometerEnd(ride.odometer_end != null ? String(Math.round(ride.odometer_end)) : '');
    })();
  }, [id, router, t]);

  const handleSave = async () => {
    const rideId = Number(id);
    const startValue = odometerStart.trim() ? Number(odometerStart.replace(',', '.')) : null;
    const endValue = odometerEnd.trim() ? Number(odometerEnd.replace(',', '.')) : null;
    const tollsValue = tolls.trim() ? Number(tolls.replace(',', '.')) : null;

    if (odometerStart.trim() && !Number.isFinite(startValue)) {
      Alert.alert(t('common.error'), t('rideEdit.odometerStartInvalid'));
      return;
    }
    if (odometerEnd.trim() && !Number.isFinite(endValue)) {
      Alert.alert(t('common.error'), t('rideEdit.odometerEndInvalid'));
      return;
    }
    if (tolls.trim() && !Number.isFinite(tollsValue)) {
      Alert.alert(t('common.error'), t('rideEdit.tollsInvalid'));
      return;
    }

    setSaving(true);
    await updateRideDetails(rideId, {
      label: label.trim() || null,
      tolls_cost: tollsValue,
      odometer_start: startValue,
      odometer_end: endValue,
    });
    setSaving(false);
    refresh();
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Field
        label={t('rideEdit.label')}
        value={label}
        onChangeText={setLabel}
        placeholder={t('rideEdit.placeholderLabel')}
      />
      <Field
        label={t('rideEdit.tolls', { currency })}
        value={tolls}
        onChangeText={setTolls}
        keyboardType="decimal-pad"
        placeholder="0"
      />
      <Field
        label={t('rideEdit.odometerStart')}
        value={odometerStart}
        onChangeText={setOdometerStart}
        keyboardType="decimal-pad"
      />
      <Field
        label={t('rideEdit.odometerEnd')}
        value={odometerEnd}
        onChangeText={setOdometerEnd}
        keyboardType="decimal-pad"
      />
      <PrimaryButton
        label={saving ? t('common.saving') : t('rideEdit.save')}
        onPress={handleSave}
        disabled={saving}
      />
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'decimal-pad' | 'default';
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 14, color: Colors.dark.muted },
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
});
