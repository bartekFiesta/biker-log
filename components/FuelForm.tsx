import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { resolveFuelTriplet } from '@/lib/fuel-calculations';
import { formatNumber } from '@/lib/format';
import { useI18n } from '@/lib/i18n/context';

interface FuelFormProps {
  liters: string;
  totalPrice: string;
  pricePerLiter: string;
  odometer: string;
  isFullTank: boolean;
  onLitersChange: (v: string) => void;
  onTotalPriceChange: (v: string) => void;
  onPricePerLiterChange: (v: string) => void;
  onOdometerChange: (v: string) => void;
  onFullTankChange: (v: boolean) => void;
  currency: string;
  tankCapacityL?: number;
}

function parseOptionalFloat(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function FuelForm({
  liters,
  totalPrice,
  pricePerLiter,
  odometer,
  isFullTank,
  onLitersChange,
  onTotalPriceChange,
  onPricePerLiterChange,
  onOdometerChange,
  onFullTankChange,
  currency,
  tankCapacityL,
}: FuelFormProps) {
  const { t } = useI18n();
  const resolved = resolveFuelTriplet({
    liters: parseOptionalFloat(liters),
    total_price: parseOptionalFloat(totalPrice),
    price_per_liter: parseOptionalFloat(pricePerLiter),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('fuelForm.details')}</Text>
      <Text style={styles.hint}>{t('fuelForm.hint')}</Text>

      <Field label={t('fuelForm.odometer')} value={odometer} onChangeText={onOdometerChange} keyboardType="decimal-pad" />

      <Field label={t('fuelForm.liters')} value={liters} onChangeText={onLitersChange} keyboardType="decimal-pad" />
      <Field
        label={t('fuelForm.totalPrice', { currency })}
        value={totalPrice}
        onChangeText={onTotalPriceChange}
        keyboardType="decimal-pad"
      />
      <Field
        label={t('fuelForm.pricePerLiter', { currency })}
        value={pricePerLiter}
        onChangeText={onPricePerLiterChange}
        keyboardType="decimal-pad"
      />

      {resolved ? (
        <View style={styles.resolvedBox}>
          <Text style={styles.resolvedTitle}>{t('fuelForm.calculated')}</Text>
          <Text style={styles.resolvedLine}>
            {formatNumber(resolved.liters!, 2)} L · {formatNumber(resolved.total_price!, 2)} {currency} ·{' '}
            {formatNumber(resolved.price_per_liter!, 2)} {currency}/L
          </Text>
        </View>
      ) : (
        <Text style={styles.error}>{t('fuelForm.valuesError')}</Text>
      )}

      <View style={styles.toggleRow}>
        <Text style={styles.sectionTitle}>{t('fuelForm.type')}</Text>
        <Text style={styles.hint}>{t('fuelForm.typeHint')}</Text>
        <View style={styles.toggleButtons}>
          <ToggleButton label={t('fuel.fullTank')} active={isFullTank} onPress={() => onFullTankChange(true)} />
          <ToggleButton label={t('fuel.partial')} active={!isFullTank} onPress={() => onFullTankChange(false)} />
        </View>

        <View style={[styles.infoBox, isFullTank ? styles.infoBoxFull : styles.infoBoxPartial]}>
          <Text style={styles.infoTitle}>
            {isFullTank ? t('fuelForm.fullTitle') : t('fuelForm.partialTitle')}
          </Text>
          <Text style={styles.infoText}>
            {isFullTank
              ? tankCapacityL != null
                ? t('fuelForm.fullInfoSettings', { liters: formatNumber(tankCapacityL, 1) })
                : t('fuelForm.fullInfo')
              : t('fuelForm.partialInfo')}
          </Text>
        </View>

        {isFullTank && tankCapacityL != null ? (
          <Pressable
            style={styles.fillButton}
            onPress={() => onLitersChange(String(tankCapacityL))}>
            <Text style={styles.fillButtonText}>
              {t('fuelForm.insertTank', { liters: formatNumber(tankCapacityL, 1) })}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'decimal-pad' | 'default';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor={Colors.dark.muted}
        placeholder="0"
      />
    </View>
  );
}

function ToggleButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.toggleButton, active && styles.toggleButtonActive]}
      onPress={onPress}>
      <Text style={[styles.toggleButtonText, active && styles.toggleButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

export { parseOptionalFloat };

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    color: Colors.dark.muted,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    color: Colors.dark.muted,
  },
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
  resolvedBox: {
    backgroundColor: '#1B2A1B',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.success,
  },
  resolvedTitle: {
    fontSize: 13,
    color: Colors.dark.success,
    marginBottom: 4,
  },
  resolvedLine: {
    fontSize: 14,
  },
  error: {
    fontSize: 13,
    color: Colors.dark.danger,
  },
  toggleRow: {
    marginTop: 8,
    gap: 10,
  },
  infoBox: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  infoBoxFull: {
    backgroundColor: '#1B2A1B',
    borderColor: Colors.dark.success,
  },
  infoBoxPartial: {
    backgroundColor: '#2A2418',
    borderColor: Colors.dark.tint,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: Colors.dark.muted,
    lineHeight: 19,
  },
  toggleButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: Colors.dark.tint,
    borderColor: Colors.dark.tint,
  },
  toggleButtonText: {
    color: Colors.dark.text,
  },
  toggleButtonTextActive: {
    color: '#121212',
    fontWeight: '700',
  },
  fillButton: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.tint,
  },
  fillButtonText: {
    fontSize: 13,
    color: Colors.dark.tint,
    textAlign: 'center',
  },
});
