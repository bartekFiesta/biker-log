import * as Notifications from 'expo-notifications';

import { getSettings } from './db';
import { createTranslator } from './i18n';
import { isWeb } from './platform';
import { computeServiceReminders } from './service-reminders';
import { formatDistance } from './units';
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

/** Shows immediately in the system notification center (works in background). */
export async function presentAppNotification(title: string, body: string): Promise<void> {
  if (isWeb) return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  await Notifications.presentNotificationAsync({
    title,
    body,
    sound: 'default',
  });
}

export async function syncServiceNotifications(
  reminders: ServiceReminderStatus[],
  language: Awaited<ReturnType<typeof getSettings>>['app_language']
): Promise<void> {
  if (isWeb) return;

  const settings = await getSettings();
  if (!settings.notifications_enabled) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return;
  }

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const t = createTranslator(language);

  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const reminder of reminders) {
    if (reminder.level !== 'due_soon' && reminder.level !== 'overdue') continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title:
          reminder.level === 'overdue' ? t('reminders.overdueTitle') : t('reminders.dueSoonTitle'),
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
  const settings = await getSettings();
  const t = createTranslator(settings.app_language);
  const reminders = computeServiceReminders(rules, records, odometer, t);
  await syncServiceNotifications(reminders, settings.app_language);
}

export async function sendRideStartedNotification(): Promise<void> {
  const settings = await getSettings();
  if (!settings.ride_notifications_enabled) return;

  const t = createTranslator(settings.app_language);
  await presentAppNotification(t('reminders.rideStartedTitle'), t('reminders.rideStartedBody'));
}

export async function sendRideEndedNotification(distanceKm: number): Promise<void> {
  const settings = await getSettings();
  if (!settings.ride_notifications_enabled) return;

  const t = createTranslator(settings.app_language);
  const distance = formatDistance(distanceKm, settings.distance_unit, 1);
  await presentAppNotification(
    t('reminders.rideEndedTitle'),
    t('reminders.rideEndedBody', { distance })
  );
}

export async function sendPassengerTransportNotification(
  language: Awaited<ReturnType<typeof getSettings>>['app_language'],
  context: 'detection' | 'recording'
): Promise<void> {
  const settings = await getSettings();
  if (!settings.transport_alerts_enabled) return;
  if (settings.ride_detection_paused) return;

  const t = createTranslator(language);
  await presentAppNotification(
    t('reminders.passengerTransportTitle'),
    context === 'recording'
      ? t('reminders.passengerTransportBodyRecording')
      : t('reminders.passengerTransportBody')
  );
}

export async function sendWalkingWhileRecordingNotification(
  language: Awaited<ReturnType<typeof getSettings>>['app_language']
): Promise<void> {
  const settings = await getSettings();
  if (!settings.transport_alerts_enabled) return;
  if (settings.ride_detection_paused) return;

  const t = createTranslator(language);
  await presentAppNotification(
    t('reminders.walkingWhileRecordingTitle'),
    t('reminders.walkingWhileRecordingBody')
  );
}
