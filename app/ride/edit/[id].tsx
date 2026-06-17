import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import PrimaryButton from '@/components/PrimaryButton';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { getRide, getSettings, updateRideDetails } from '@/lib/db';
import { useDatabase } from '@/lib/database-context';

export default function EditRideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { refresh } = useDatabase();
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
        Alert.alert('Not found', 'Ride not found.');
        router.back();
        return;
      }
      setCurrency(settings.currency);
      setLabel(ride.label ?? '');
      setTolls(ride.tolls_cost != null ? String(ride.tolls_cost) : '');
      setOdometerStart(ride.odometer_start != null ? String(Math.round(ride.odometer_start)) : '');
      setOdometerEnd(ride.odometer_end != null ? String(Math.round(ride.odometer_end)) : '');
    })();
  }, [id, router]);

  const handleSave = async () => {
    const rideId = Number(id);
    const startValue = odometerStart.trim() ? Number(odometerStart.replace(',', '.')) : null;
    const endValue = odometerEnd.trim() ? Number(odometerEnd.replace(',', '.')) : null;
    const tollsValue = tolls.trim() ? Number(tolls.replace(',', '.')) : null;

    if (odometerStart.trim() && !Number.isFinite(startValue)) {
      Alert.alert('Error', 'Enter a valid starting odometer.');
      return;
    }
    if (odometerEnd.trim() && !Number.isFinite(endValue)) {
      Alert.alert('Error', 'Enter a valid ending odometer.');
      return;
    }
    if (tolls.trim() && !Number.isFinite(tollsValue)) {
      Alert.alert('Error', 'Enter a valid tolls amount.');
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
      <Field label="Trip label (optional)" value={label} onChangeText={setLabel} placeholder="e.g. Weekend trip" />
      <Field
        label={`Tolls cost (${currency}, optional)`}
        value={tolls}
        onChangeText={setTolls}
        keyboardType="decimal-pad"
        placeholder="0"
      />
      <Field
        label="Odometer start (km)"
        value={odometerStart}
        onChangeText={setOdometerStart}
        keyboardType="decimal-pad"
      />
      <Field
        label="Odometer end (km)"
        value={odometerEnd}
        onChangeText={setOdometerEnd}
        keyboardType="decimal-pad"
      />
      <PrimaryButton label={saving ? 'Saving...' : 'Save changes'} onPress={handleSave} disabled={saving} />
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
