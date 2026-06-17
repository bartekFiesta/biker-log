import * as Notifications from 'expo-notifications';

import { getSettings } from './db';
import { isWeb } from './platform';
import { computeServiceReminders } from './service-reminders';
import type { ServiceReminderStatus } from './types';

if (!isWeb) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (isWeb) return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function syncServiceNotifications(
  reminders: ServiceReminderStatus[]
): Promise<void> {
  if (isWeb) return;

  const settings = await getSettings();
  if (!settings.notifications_enabled) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return;
  }

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const reminder of reminders) {
    if (reminder.level !== 'due_soon' && reminder.level !== 'overdue') continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.level === 'overdue' ? 'Service overdue' : 'Service due soon',
        body: `${reminder.label}: ${reminder.message}`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: reminder.level === 'overdue' ? 5 : 60,
        repeats: false,
      },
    });
  }
}

export async function refreshServiceNotifications(
  rules: Awaited<ReturnType<typeof import('./db').getServiceReminderRules>>,
  records: Awaited<ReturnType<typeof import('./db').getServiceRecords>>,
  odometer: number | null
): Promise<void> {
  const reminders = computeServiceReminders(rules, records, odometer);
  await syncServiceNotifications(reminders);
}
