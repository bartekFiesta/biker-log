import type { Refueling, Ride } from './types';

export function buildMonthlyDistanceChart(rides: Ride[]): { label: string; value: number }[] {
  const buckets = new Map<string, number>();

  for (const ride of rides) {
    if (!ride.ended_at) continue;
    const date = new Date(ride.started_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, (buckets.get(key) ?? 0) + ride.distance_gps_km);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([label, value]) => ({ label, value }));
}

export function buildMonthlyFuelChart(refuelings: Refueling[]): { label: string; value: number }[] {
  const buckets = new Map<string, number>();

  for (const refueling of refuelings) {
    const date = new Date(refueling.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, (buckets.get(key) ?? 0) + refueling.liters);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([label, value]) => ({ label, value }));
}

export function buildMonthlySpendChart(refuelings: Refueling[]): { label: string; value: number }[] {
  const buckets = new Map<string, number>();

  for (const refueling of refuelings) {
    const date = new Date(refueling.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, (buckets.get(key) ?? 0) + refueling.total_price);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([label, value]) => ({ label, value }));
}
