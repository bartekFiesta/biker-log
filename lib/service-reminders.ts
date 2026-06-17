import type {
  ReminderServiceType,
  ServiceRecord,
  ServiceReminderRule,
  ServiceReminderStatus,
} from './types';
import type { TranslateFn } from './i18n';

const DUE_SOON_KM = 500;
const DUE_SOON_DAYS = 14;

function daysBetween(fromIso: string, toDate: Date): number {
  const from = new Date(fromIso).getTime();
  return Math.floor((toDate.getTime() - from) / 86400000);
}

export function computeServiceReminders(
  rules: ServiceReminderRule[],
  records: ServiceRecord[],
  currentOdometer: number | null,
  t: TranslateFn
): ServiceReminderStatus[] {
  const now = new Date();

  return rules
    .filter((rule) => rule.enabled)
    .map((rule) => {
      const label = t(`serviceTypes.${rule.type}`);
      const last = records
        .filter((record) => record.type === rule.type)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      if (!last) {
        return {
          type: rule.type,
          label,
          level: 'unknown' as const,
          message: t('reminders.noServiceYet'),
          km_remaining: null,
          days_remaining: null,
        };
      }

      let kmRemaining: number | null = null;
      let daysRemaining: number | null = null;

      if (rule.interval_km != null && currentOdometer != null) {
        kmRemaining = rule.interval_km - (currentOdometer - last.odometer_km);
      }
      if (rule.interval_days != null) {
        daysRemaining = rule.interval_days - daysBetween(last.date, now);
      }

      let level: ServiceReminderStatus['level'] = 'ok';
      let message = t('reminders.upToDate');

      const kmOverdue = kmRemaining != null && kmRemaining < 0;
      const daysOverdue = daysRemaining != null && daysRemaining < 0;
      const kmDueSoon = kmRemaining != null && kmRemaining >= 0 && kmRemaining <= DUE_SOON_KM;
      const daysDueSoon =
        daysRemaining != null && daysRemaining >= 0 && daysRemaining <= DUE_SOON_DAYS;

      if (kmOverdue || daysOverdue) {
        level = 'overdue';
        const parts: string[] = [];
        if (kmOverdue) parts.push(t('reminders.kmOverdue', { count: Math.abs(Math.round(kmRemaining!)) }));
        if (daysOverdue) parts.push(t('reminders.daysOverdue', { count: Math.abs(daysRemaining!) }));
        message = parts.join(' · ');
      } else if (kmDueSoon || daysDueSoon) {
        level = 'due_soon';
        const parts: string[] = [];
        if (kmRemaining != null) parts.push(t('reminders.kmLeft', { count: Math.round(kmRemaining) }));
        if (daysRemaining != null) parts.push(t('reminders.daysLeft', { count: daysRemaining }));
        message = parts.join(' · ');
      } else {
        const parts: string[] = [];
        if (kmRemaining != null) parts.push(t('reminders.kmLeft', { count: Math.round(kmRemaining) }));
        if (daysRemaining != null) parts.push(t('reminders.daysLeft', { count: daysRemaining }));
        if (parts.length > 0) message = parts.join(' · ');
      }

      return {
        type: rule.type,
        label,
        level,
        message,
        km_remaining: kmRemaining,
        days_remaining: daysRemaining,
      };
    });
}

export function emptyReminderRule(type: ReminderServiceType): ServiceReminderRule {
  return { type, interval_km: null, interval_days: null, enabled: false };
}
