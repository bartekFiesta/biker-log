import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import FuelForm, { parseOptionalFloat } from '@/components/FuelForm';
import PrimaryButton from '@/components/PrimaryButton';
import Colors from '@/constants/Colors';
import { getActiveBike, getRefueling, getSettings, updateRefueling } from '@/lib/db';
import { useDatabase } from '@/lib/database-context';
import { resolveFuelTriplet } from '@/lib/fuel-calculations';

export default function EditFuelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { refresh } = useDatabase();
  const [liters, setLiters] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState('');
  const [odometer, setOdometer] = useState('');
  const [isFullTank, setIsFullTank] = useState(true);
  const [currency, setCurrency] = useState('USD');
  const [tankCapacityL, setTankCapacityL] = useState<number | undefined>();
  const [bikeId, setBikeId] = useState(1);
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const refuelId = Number(id);
      if (!Number.isFinite(refuelId)) return;
      const [refueling, settings, bike] = await Promise.all([
        getRefueling(refuelId),
        getSettings(),
        getActiveBike(),
      ]);
      if (!refueling) {
        Alert.alert('Not found', 'Refueling entry not found.');
        router.back();
        return;
      }
      setCurrency(settings.currency);
      setTankCapacityL(bike.tank_capacity_l);
      setBikeId(refueling.bike_id);
      setDate(refueling.date);
      setLiters(String(refueling.liters));
      setTotalPrice(String(refueling.total_price));
      setPricePerLiter(String(refueling.price_per_liter));
      setOdometer(String(Math.round(refueling.odometer_km)));
      setIsFullTank(refueling.is_full_tank);
    })();
  }, [id, router]);

  const handleSave = async () => {
    const refuelId = Number(id);
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
    await updateRefueling(refuelId, {
      bike_id: bikeId,
      date,
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
      <PrimaryButton label={saving ? 'Saving...' : 'Save changes'} onPress={handleSave} disabled={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 16, gap: 20, paddingBottom: 32 },
});
