import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import PrimaryButton from '@/components/PrimaryButton';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import {
  addBike,
  getBikes,
  getSettings,
  setActiveBike,
  updateBike,
} from '@/lib/db';
import { useDatabase } from '@/lib/database-context';
import { useI18n } from '@/lib/i18n/context';
import type { Bike } from '@/lib/types';

export default function BikesScreen() {
  const router = useRouter();
  const { refreshKey, refresh } = useDatabase();
  const { t } = useI18n();
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [activeBikeId, setActiveBikeIdState] = useState(1);
  const [newName, setNewName] = useState('');
  const [newTank, setNewTank] = useState('17');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const [bikeList, settings] = await Promise.all([getBikes(), getSettings()]);
    setBikes(bikeList);
    setActiveBikeIdState(settings.active_bike_id);
  }, [refreshKey]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleSwitch = async (id: number) => {
    await setActiveBike(id);
    refresh();
    setActiveBikeIdState(id);
  };

  const handleAdd = async () => {
    const tank = Number(newTank.replace(',', '.'));
    if (!newName.trim()) {
      Alert.alert(t('common.error'), t('bikes.nameInvalid'));
      return;
    }
    if (!Number.isFinite(tank) || tank <= 0) {
      Alert.alert(t('common.error'), t('bikes.tankInvalid'));
      return;
    }
    setAdding(true);
    const bike = await addBike({
      name: newName.trim(),
      tank_capacity_l: tank,
      reserve_threshold_l: Math.max(1, tank * 0.15),
      baseline_odometer_km: null,
      default_consumption_l_per_100km: null,
    });
    await setActiveBike(bike.id);
    setNewName('');
    setNewTank('17');
    setAdding(false);
    refresh();
  };

  const handleRename = async (bike: Bike) => {
    if (editingId === bike.id) {
      if (!editName.trim()) {
        Alert.alert(t('common.error'), t('bikes.nameInvalid'));
        return;
      }
      await updateBike(bike.id, { name: editName.trim() });
      setEditingId(null);
      refresh();
      return;
    }
    setEditingId(bike.id);
    setEditName(bike.name);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>{t('bikes.intro')}</Text>

      {bikes.map((bike) => (
        <View key={bike.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{bike.name}</Text>
            {bike.id === activeBikeId ? (
              <Text style={styles.activeBadge}>{t('common.active')}</Text>
            ) : (
              <Pressable onPress={() => void handleSwitch(bike.id)}>
                <Text style={styles.switchLink}>{t('common.switch')}</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.cardMeta}>
            {t('bikes.tank', { liters: bike.tank_capacity_l })} ·{' '}
            {t('bikes.reserve', { liters: bike.reserve_threshold_l })}
          </Text>
          {editingId === bike.id ? (
            <View style={styles.renameRow}>
              <TextInput
                style={styles.renameInput}
                value={editName}
                onChangeText={setEditName}
                placeholder={t('onboarding.bikeName')}
                placeholderTextColor={Colors.dark.muted}
              />
              <Pressable onPress={() => void handleRename(bike)}>
                <Text style={styles.renameLink}>{t('common.save')}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => void handleRename(bike)}>
              <Text style={styles.renameLink}>{t('common.rename')}</Text>
            </Pressable>
          )}
        </View>
      ))}

      <Text style={styles.sectionTitle}>{t('bikes.addBike')}</Text>
      <Field
        label={t('onboarding.bikeName')}
        value={newName}
        onChangeText={setNewName}
        placeholder={t('onboarding.placeholderName')}
      />
      <Field
        label={t('settings.tankSize')}
        value={newTank}
        onChangeText={setNewTank}
        keyboardType="decimal-pad"
        placeholder={t('onboarding.placeholderTank')}
      />
      <PrimaryButton
        label={adding ? t('bikes.adding') : t('bikes.addBike')}
        onPress={handleAdd}
        disabled={adding}
      />
      <PrimaryButton label={t('bikes.back')} onPress={() => router.back()} variant="secondary" />
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
  hint: { fontSize: 14, color: Colors.dark.muted, lineHeight: 20 },
  card: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  activeBadge: { color: Colors.dark.success, fontWeight: '700', fontSize: 13 },
  switchLink: { color: Colors.dark.tint, fontWeight: '700' },
  cardMeta: { fontSize: 13, color: Colors.dark.muted },
  renameLink: { color: Colors.dark.tint, fontSize: 13, marginTop: 4 },
  renameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  renameInput: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: Colors.dark.text,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
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
