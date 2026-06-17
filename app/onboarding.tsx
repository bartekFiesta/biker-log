import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import CurrencyPicker from '@/components/CurrencyPicker';
import PrimaryButton from '@/components/PrimaryButton';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { normalizeCurrency } from '@/lib/currencies';
import { completeOnboarding } from '@/lib/db';
import { useDatabase } from '@/lib/database-context';
import { useI18n } from '@/lib/i18n/context';

export default function OnboardingScreen() {
  const router = useRouter();
  const { refresh } = useDatabase();
  const { t } = useI18n();
  const [bikeName, setBikeName] = useState('');
  const [tankCapacity, setTankCapacity] = useState('');
  const [odometer, setOdometer] = useState('');
  const [consumption, setConsumption] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    const tank = Number(tankCapacity.replace(',', '.'));
    if (!Number.isFinite(tank) || tank <= 0) {
      Alert.alert(t('common.required'), t('onboarding.tankRequired'));
      return;
    }

    const odometerValue = odometer.trim() ? Number(odometer.replace(',', '.')) : null;
    if (odometer.trim() && (!Number.isFinite(odometerValue) || odometerValue! <= 0)) {
      Alert.alert(t('common.error'), t('onboarding.odometerInvalid'));
      return;
    }

    const consumptionValue = Number(consumption.replace(',', '.'));
    if (!Number.isFinite(consumptionValue) || consumptionValue <= 0) {
      Alert.alert(t('common.required'), t('onboarding.consumptionRequired'));
      return;
    }

    setSaving(true);
    await completeOnboarding(
      bikeName.trim() || t('onboarding.placeholderName'),
      tank,
      normalizeCurrency(currency),
      odometerValue,
      consumptionValue
    );
    setSaving(false);
    refresh();
    router.replace('/(tabs)');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{t('onboarding.heading')}</Text>
      <Text style={styles.subheading}>{t('onboarding.subheading')}</Text>

      <Field
        label={t('onboarding.bikeName')}
        value={bikeName}
        onChangeText={setBikeName}
        placeholder={t('onboarding.placeholderName')}
      />
      <Field
        label={t('onboarding.tankCapacity')}
        value={tankCapacity}
        onChangeText={setTankCapacity}
        keyboardType="decimal-pad"
        placeholder={t('onboarding.placeholderTank')}
      />
      <Field
        label={t('onboarding.consumption')}
        value={consumption}
        onChangeText={setConsumption}
        keyboardType="decimal-pad"
        placeholder={t('onboarding.placeholderConsumption')}
        hint={t('onboarding.consumptionHint')}
      />
      <Field
        label={t('onboarding.odometer')}
        value={odometer}
        onChangeText={setOdometer}
        keyboardType="decimal-pad"
        placeholder={t('onboarding.placeholderOdometer')}
        hint={t('onboarding.odometerHint')}
      />
      <CurrencyPicker value={currency} onChange={setCurrency} />

      <PrimaryButton
        label={saving ? t('common.saving') : t('onboarding.continue')}
        onPress={handleContinue}
        disabled={saving}
      />
    </ScrollView>
  );
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
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 24, gap: 16, paddingBottom: 40, paddingTop: 48 },
  heading: { fontSize: 28, fontWeight: '800' },
  subheading: { fontSize: 15, color: Colors.dark.muted, lineHeight: 22, marginTop: -8 },
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
});
