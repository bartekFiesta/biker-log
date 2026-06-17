import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import PrimaryButton from '@/components/PrimaryButton';
import ServiceForm from '@/components/ServiceForm';
import { addServiceRecord, getLatestOdometer } from '@/lib/db';
import { useDatabase } from '@/lib/database-context';
import { useI18n } from '@/lib/i18n/context';
import type { ServiceType } from '@/lib/types';

export default function AddServiceScreen() {
  const router = useRouter();
  const { refresh } = useDatabase();
  const { t } = useI18n();
  const [type, setType] = useState<ServiceType>('oil');
  const [odometer, setOdometer] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const latest = await getLatestOdometer();
      if (latest != null) setOdometer(String(Math.round(latest)));
    })();
  }, []);

  const handleSave = async () => {
    const odometerValue = Number(odometer.replace(',', '.'));
    if (!Number.isFinite(odometerValue) || odometerValue <= 0) {
      Alert.alert(t('common.error'), t('service.odometerInvalid'));
      return;
    }

    setSaving(true);
    await addServiceRecord({
      type,
      date: new Date().toISOString(),
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
      <PrimaryButton
        label={saving ? t('common.saving') : t('service.save')}
        onPress={handleSave}
        disabled={saving}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    padding: 16,
    gap: 20,
    paddingBottom: 32,
  },
});
