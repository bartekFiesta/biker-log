import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { CURRENCY_OPTIONS, isKnownCurrency, normalizeCurrency } from '@/lib/currencies';

interface CurrencyPickerProps {
  value: string;
  onChange: (currency: string) => void;
}

export default function CurrencyPicker({ value, onChange }: CurrencyPickerProps) {
  const normalized = normalizeCurrency(value);
  const showCustom = value.length > 0 && !isKnownCurrency(value);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Currency</Text>
      <View style={styles.grid}>
        {CURRENCY_OPTIONS.map((code) => (
          <Pressable
            key={code}
            style={[styles.chip, normalized === code && styles.chipActive]}
            onPress={() => onChange(code)}>
            <Text style={[styles.chipText, normalized === code && styles.chipTextActive]}>{code}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.customLabel}>Other (3-letter code)</Text>
      <TextInput
        style={[styles.input, showCustom && styles.inputActive]}
        value={showCustom ? normalized : ''}
        onChangeText={(text) => onChange(normalizeCurrency(text))}
        autoCapitalize="characters"
        maxLength={6}
        placeholder="e.g. JPY"
        placeholderTextColor={Colors.dark.muted}
      />
      <Text style={styles.hint}>Used for refueling prices. Default is USD.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: Colors.dark.muted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    minWidth: 56,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: Colors.dark.tint,
    borderColor: Colors.dark.tint,
  },
  chipText: {
    color: Colors.dark.text,
    fontWeight: '600',
    fontSize: 14,
  },
  chipTextActive: {
    color: '#121212',
  },
  customLabel: {
    fontSize: 13,
    color: Colors.dark.muted,
    marginTop: 4,
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
  inputActive: {
    borderColor: Colors.dark.tint,
  },
  hint: {
    fontSize: 12,
    color: Colors.dark.muted,
  },
});
