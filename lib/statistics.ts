import type { PeriodStats, Refueling, Ride, StatsPeriod } from './types';
import { getStatsPeriodLabel, type AppLanguage } from './i18n';

function periodStart(period: StatsPeriod, reference = new Date()): Date {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);

  if (period === 'week') {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    return start;
  }

  if (period === 'month') {
    start.setDate(1);
    return start;
  }

  start.setMonth(0, 1);
  return start;
}

function periodLabel(period: StatsPeriod, language: AppLanguage): string {
  return getStatsPeriodLabel(language, period);
}

function rideMovingMs(ride: Ride): number {
  if (!ride.ended_at) return 0;
  const total = new Date(ride.ended_at).getTime() - new Date(ride.started_at).getTime();
  return Math.max(0, total - ride.paused_duration_ms);
}

export function computePeriodStats(
  period: StatsPeriod,
  rides: Ride[],
  refuelings: Refueling[],
  reference = new Date(),
  language: AppLanguage = 'en'
): PeriodStats {
  const start = periodStart(period, reference);
  const startMs = start.getTime();

  const periodRides = rides.filter(
    (ride) => ride.ended_at && new Date(ride.started_at).getTime() >= startMs
  );
  const periodRefuelings = refuelings.filter(
    (refueling) => new Date(refueling.date).getTime() >= startMs
  );

  return {
    period,
    label: periodLabel(period, language),
    ride_count: periodRides.length,
    total_distance_km: periodRides.reduce((sum, ride) => sum + ride.distance_gps_km, 0),
    total_moving_time_ms: periodRides.reduce((sum, ride) => sum + rideMovingMs(ride), 0),
    refuel_count: periodRefuelings.length,
    liters_total: periodRefuelings.reduce((sum, refueling) => sum + refueling.liters, 0),
    fuel_spent: periodRefuelings.reduce((sum, refueling) => sum + refueling.total_price, 0),
  };
}

export function computeAllPeriodStats(
  rides: Ride[],
  refuelings: Refueling[],
  reference = new Date(),
  language: AppLanguage = 'en'
): PeriodStats[] {
  return (['week', 'month', 'year'] as StatsPeriod[]).map((period) =>
    computePeriodStats(period, rides, refuelings, reference, language)
  );
}
