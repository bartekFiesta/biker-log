import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'secondary';
  disabled?: boolean;
  emphasized?: boolean;
}

export default function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  emphasized = false,
}: PrimaryButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        variant === 'danger' && styles.danger,
        variant === 'secondary' && styles.secondary,
        emphasized && styles.emphasized,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled}>
      <Text
        style={[
          styles.label,
          variant === 'secondary' && styles.secondaryLabel,
          disabled && styles.disabledLabel,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.dark.tint,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  danger: {
    backgroundColor: Colors.dark.danger,
  },
  secondary: {
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  emphasized: {
    borderColor: Colors.dark.tint,
    backgroundColor: '#2A1F18',
  },
  disabled: {
    opacity: 0.65,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    color: '#121212',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryLabel: {
    color: Colors.dark.text,
  },
  disabledLabel: {
    color: Colors.dark.muted,
  },
});
