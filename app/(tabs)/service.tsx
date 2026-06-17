import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import PrimaryButton from '@/components/PrimaryButton';
import { ReminderList } from '@/components/ReminderCard';
import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import {
  deleteServiceRecord,
  getLatestOdometer,
  getServiceRecords,
  getServiceReminderRules,
  getSettings,
} from '@/lib/db';
import { useDatabase } from '@/lib/database-context';
import { formatDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n/context';
import { formatDistance } from '@/lib/units';
import { computeServiceReminders } from '@/lib/service-reminders';
import type { ServiceRecord, ServiceReminderStatus } from '@/lib/types';

export default function ServiceScreen() {
  const router = useRouter();
  const { refreshKey, refresh } = useDatabase();
  const { t } = useI18n();
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [reminders, setReminders] = useState<ServiceReminderStatus[]>([]);
  const [distanceUnit, setDistanceUnit] = useState<'km' | 'mi'>('km');

  const load = useCallback(async () => {
    const [data, rules, odometer, settings] = await Promise.all([
      getServiceRecords(),
      getServiceReminderRules(),
      getLatestOdometer(),
      getSettings(),
    ]);
    setRecords(data);
    setReminders(computeServiceReminders(rules, data, odometer, t));
    setDistanceUnit(settings.distance_unit);
  }, [refreshKey, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleDelete = (item: ServiceRecord) => {
    Alert.alert(t('service.deleteTitle'), t('service.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteServiceRecord(item.id);
          refresh();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <PrimaryButton label={t('service.add')} onPress={() => router.push('/service/add')} />
      </View>

      <FlatList
        data={records}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.reminderSection}>
            <Text style={styles.reminderTitle}>{t('service.reminderStatus')}</Text>
            <ReminderList reminders={reminders} />
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>{t('service.empty')}</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/service/${item.id}`)}
            onLongPress={() => handleDelete(item)}>
            <Text style={styles.cardTitle}>{t(`serviceTypes.${item.type}`)}</Text>
            <Text style={styles.cardMeta}>
              {formatDate(item.date)} · {formatDistance(item.odometer_km, distanceUnit, 0)}
            </Text>
            {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    padding: 16,
  },
  reminderSection: {
    marginBottom: 16,
    gap: 8,
  },
  reminderTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  empty: {
    textAlign: 'center',
    color: Colors.dark.muted,
    marginTop: 40,
    lineHeight: 22,
  },
  card: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 14,
    color: Colors.dark.muted,
  },
  notes: {
    fontSize: 14,
    marginTop: 8,
    color: Colors.dark.text,
  },
});
