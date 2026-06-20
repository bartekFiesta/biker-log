import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useI18n } from '@/lib/i18n/context';
import type { ServiceReminderStatus } from '@/lib/types';

interface ReminderCardProps {
  reminder: ServiceReminderStatus;
}

export default function ReminderCard({ reminder }: ReminderCardProps) {
  const accent =
    reminder.level === 'overdue'
      ? Colors.dark.danger
      : reminder.level === 'due_soon'
        ? Colors.dark.tint
        : reminder.level === 'unknown'
          ? Colors.dark.muted
          : Colors.dark.success;

  return (
    <View style={[styles.card, { borderColor: accent }]}>
      <Text style={styles.title}>{reminder.label}</Text>
      <Text style={[styles.message, { color: accent }]}>{reminder.message}</Text>
    </View>
  );
}

interface ReminderListProps {
  reminders: ServiceReminderStatus[];
}

export function ReminderList({ reminders }: ReminderListProps) {
  const { t } = useI18n();
  const actionable = reminders.filter((item) => item.level !== 'ok');
  if (actionable.length === 0) {
    return (
      <View style={styles.okBox}>
        <Text style={styles.okText}>{t('reminders.allUpToDate')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {actionable.map((reminder) => (
        <ReminderCard key={reminder.type} reminder={reminder} />
      ))}
    </View>
  );
}

interface ToggleRowProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
}

export function ToggleRow({ label, value, onChange, hint }: ToggleRowProps) {
  return (
    <View style={styles.toggleBlock}>
      <View style={styles.toggleHeader}>
        <View style={styles.toggleText}>
          <Text style={styles.toggleLabel}>{label}</Text>
          {hint ? <Text style={styles.toggleHint}>{hint}</Text> : null}
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: Colors.dark.border, true: Colors.dark.tint }}
          thumbColor="#f5f5f5"
          ios_backgroundColor={Colors.dark.border}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  card: {
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
  },
  okBox: {
    backgroundColor: '#1B2A1B',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.success,
  },
  okText: {
    color: Colors.dark.success,
    fontSize: 13,
  },
  toggleBlock: {
    gap: 6,
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleText: {
    flex: 1,
    gap: 4,
  },
  toggleLabel: {
    fontSize: 14,
    color: Colors.dark.muted,
  },
  toggleHint: {
    fontSize: 12,
    color: Colors.dark.muted,
    lineHeight: 17,
  },
});
