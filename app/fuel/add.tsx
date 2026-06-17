import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import FuelForm, { parseOptionalFloat } from '@/components/FuelForm';
import PrimaryButton from '@/components/PrimaryButton';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { addRefueling, getActiveBike, getLatestOdometer, getSettings } from '@/lib/db';
import { useDatabase } from '@/lib/database-context';
import { resolveFuelTriplet } from '@/lib/fuel-calculations';

export default function AddFuelScreen() {
  const router = useRouter();
  const { refresh } = useDatabase();
  const [liters, setLiters] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState('');
  const [odometer, setOdometer] = useState('');
  const [isFullTank, setIsFullTank] = useState(true);
  const [currency, setCurrency] = useState('USD');
  const [tankCapacityL, setTankCapacityL] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const [settings, bike, latestOdometer] = await Promise.all([
        getSettings(),
        getActiveBike(),
        getLatestOdometer(),
      ]);
      setCurrency(settings.currency);
      setTankCapacityL(bike.tank_capacity_l);
      if (latestOdometer != null) setOdometer(String(Math.round(latestOdometer)));
    })();
  }, []);

  const handleSave = async () => {
    const odometerValue = Number(odometer.replace(',', '.'));
    if (!Number.isFinite(odometerValue) || odometerValue <= 0) {
      Alert.alert('Error', 'Enter a valid odometer reading.');
      return;
    }

    const resolved = resolveFuelTriplet({
      liters: parseOptionalFloat(liters),
      total_price: parseOptionalFloat(totalPrice),
      price_per_liter: parseOptionalFloat(pricePerLiter),
    });

    if (!resolved || resolved.liters == null || resolved.total_price == null || resolved.price_per_liter == null) {
      Alert.alert('Error', 'Enter at least 2 of 3 values: liters, total price, or price per liter.');
      return;
    }

    setSaving(true);
    await addRefueling({
      date: new Date().toISOString(),
      odometer_km: odometerValue,
      liters: resolved.liters,
      total_price: resolved.total_price,
      price_per_liter: resolved.price_per_liter,
      is_full_tank: isFullTank,
    });
    setSaving(false);
    refresh();
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Select refueling type: <Text style={styles.introBold}>full tank</Text> (for consumption tracking) or{' '}
        <Text style={styles.introBold}>partial</Text> (add liters to tank estimate only).
      </Text>
      <FuelForm
        liters={liters}
        totalPrice={totalPrice}
        pricePerLiter={pricePerLiter}
        odometer={odometer}
        isFullTank={isFullTank}
        onLitersChange={setLiters}
        onTotalPriceChange={setTotalPrice}
        onPricePerLiterChange={setPricePerLiter}
        onOdometerChange={setOdometer}
        onFullTankChange={setIsFullTank}
        currency={currency}
        tankCapacityL={tankCapacityL}
      />
      <PrimaryButton label={saving ? 'Saving...' : 'Save refueling'} onPress={handleSave} disabled={saving} />
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
  intro: {
    fontSize: 14,
    color: Colors.dark.muted,
    lineHeight: 20,
  },
  introBold: {
    color: Colors.dark.text,
    fontWeight: '600',
  },
});
