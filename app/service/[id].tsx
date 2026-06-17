import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import PrimaryButton from '@/components/PrimaryButton';
import ServiceForm from '@/components/ServiceForm';
import Colors from '@/constants/Colors';
import { getServiceRecord, updateServiceRecord } from '@/lib/db';
import { useDatabase } from '@/lib/database-context';
import type { ServiceType } from '@/lib/types';

export default function EditServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { refresh } = useDatabase();
  const [type, setType] = useState<ServiceType>('oil');
  const [odometer, setOdometer] = useState('');
  const [notes, setNotes] = useState('');
  const [bikeId, setBikeId] = useState(1);
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const recordId = Number(id);
      if (!Number.isFinite(recordId)) return;
      const record = await getServiceRecord(recordId);
      if (!record) {
        Alert.alert('Not found', 'Service record not found.');
        router.back();
        return;
      }
      setBikeId(record.bike_id);
      setDate(record.date);
      setType(record.type);
      setOdometer(String(Math.round(record.odometer_km)));
      setNotes(record.notes ?? '');
    })();
  }, [id, router]);

  const handleSave = async () => {
    const recordId = Number(id);
    const odometerValue = Number(odometer.replace(',', '.'));
    if (!Number.isFinite(odometerValue) || odometerValue <= 0) {
      Alert.alert('Error', 'Enter a valid odometer reading.');
      return;
    }

    setSaving(true);
    await updateServiceRecord(recordId, {
      bike_id: bikeId,
      type,
      date,
      odometer_km: odometerValue,
      notes: notes.trim() || null,
    });
    setSaving(false);
    refresh();
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ServiceForm
        type={type}
        odometer={odometer}
        notes={notes}
        onTypeChange={setType}
        onOdometerChange={setOdometer}
        onNotesChange={setNotes}
      />
      <PrimaryButton label={saving ? 'Saving...' : 'Save changes'} onPress={handleSave} disabled={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 16, gap: 20, paddingBottom: 32 },
});
