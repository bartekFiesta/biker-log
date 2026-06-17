import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useI18n } from '@/lib/i18n/context';
import { SERVICE_TYPES, type ServiceType } from '@/lib/types';

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
  const { t } = useI18n();

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('service.type')}</Text>
      <View style={styles.typeGrid}>
        {SERVICE_TYPES.map((serviceType) => (
          <Pressable
            key={serviceType}
            style={[styles.typeButton, type === serviceType && styles.typeButtonActive]}
            onPress={() => onTypeChange(serviceType)}>
            <Text style={[styles.typeButtonText, type === serviceType && styles.typeButtonTextActive]}>
              {t(`serviceTypes.${serviceType}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>{t('service.odometer')}</Text>
      <TextInput
        style={styles.input}
        value={odometer}
        onChangeText={onOdometerChange}
        keyboardType="decimal-pad"
        placeholderTextColor={Colors.dark.muted}
        placeholder="0"
      />

      <Text style={styles.fieldLabel}>{t('service.notes')}</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        value={notes}
        onChangeText={onNotesChange}
        multiline
        placeholderTextColor={Colors.dark.muted}
        placeholder={t('service.notesPlaceholder')}
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
