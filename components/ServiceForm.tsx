import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { SERVICE_TYPE_LABELS, SERVICE_TYPES, type ServiceType } from '@/lib/types';

interface ServiceFormProps {
  type: ServiceType;
  odometer: string;
  notes: string;
  onTypeChange: (type: ServiceType) => void;
  onOdometerChange: (v: string) => void;
  onNotesChange: (v: string) => void;
}

export default function ServiceForm({
  type,
  odometer,
  notes,
  onTypeChange,
  onOdometerChange,
  onNotesChange,
}: ServiceFormProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Service type</Text>
      <View style={styles.typeGrid}>
        {SERVICE_TYPES.map((serviceType) => (
          <Pressable
            key={serviceType}
            style={[styles.typeButton, type === serviceType && styles.typeButtonActive]}
            onPress={() => onTypeChange(serviceType)}>
            <Text style={[styles.typeButtonText, type === serviceType && styles.typeButtonTextActive]}>
              {SERVICE_TYPE_LABELS[serviceType]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Odometer (km)</Text>
      <TextInput
        style={styles.input}
        value={odometer}
        onChangeText={onOdometerChange}
        keyboardType="decimal-pad"
        placeholderTextColor={Colors.dark.muted}
        placeholder="0"
      />

      <Text style={styles.fieldLabel}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        value={notes}
        onChangeText={onNotesChange}
        multiline
        placeholderTextColor={Colors.dark.muted}
        placeholder="e.g. oil brand, remarks..."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  typeGrid: {
    gap: 8,
  },
  typeButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  typeButtonActive: {
    backgroundColor: Colors.dark.tint,
    borderColor: Colors.dark.tint,
  },
  typeButtonText: {
    color: Colors.dark.text,
  },
  typeButtonTextActive: {
    color: '#121212',
    fontWeight: '700',
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
  notesInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
});
