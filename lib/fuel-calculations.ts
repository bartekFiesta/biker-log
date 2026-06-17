import type {
  ConsumptionSample,
  FuelStatus,
  FuelTriplet,
  Refueling,
  Ride,
} from './types';

const MAX_SAMPLES = 5;

export function resolveFuelTriplet(input: FuelTriplet): FuelTriplet | null {
  const { liters, total_price, price_per_liter } = input;
  const known = [liters, total_price, price_per_liter].filter((v) => v != null && v > 0);

  if (known.length < 2) return null;

  if (liters != null && liters > 0 && total_price != null && total_price > 0) {
    return {
      liters,
      total_price,
      price_per_liter: total_price / liters,
    };
  }

  if (liters != null && liters > 0 && price_per_liter != null && price_per_liter > 0) {
    return {
      liters,
      total_price: liters * price_per_liter,
      price_per_liter,
    };
  }

  if (total_price != null && total_price > 0 && price_per_liter != null && price_per_liter > 0) {
    return {
      liters: total_price / price_per_liter,
      total_price,
      price_per_liter,
    };
  }

  return null;
}

export function computeConsumptionSamples(refuelings: Refueling[]): ConsumptionSample[] {
  const sorted = [...refuelings].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const samples: ConsumptionSample[] = [];
  let prevFull: Refueling | null = null;

  for (const refueling of sorted) {
    if (!refueling.is_full_tank) continue;

    if (prevFull) {
      const distance = refueling.odometer_km - prevFull.odometer_km;
      if (distance > 0 && refueling.liters > 0) {
        samples.push({
          consumption_l_per_100km: (refueling.liters / distance) * 100,
          distance_km: distance,
          date: refueling.date,
        });
      }
    }

    prevFull = refueling;
  }

  return samples;
}

export function averageConsumption(samples: ConsumptionSample[]): number | null {
  if (samples.length === 0) return null;
  const recent = samples.slice(-MAX_SAMPLES);
  const sum = recent.reduce((acc, s) => acc + s.consumption_l_per_100km, 0);
  return sum / recent.length;
}

function fuelAtRefueling(refueling: Refueling, tankCapacity: number): number {
  return refueling.is_full_tank ? tankCapacity : refueling.liters;
}

export function distanceSinceRefueling(
  lastRefueling: Refueling,
  rides: Ride[],
  currentOdometer?: number | null
): number {
  const refuelTime = new Date(lastRefueling.date).getTime();

  if (currentOdometer != null && currentOdometer > lastRefueling.odometer_km) {
    return currentOdometer - lastRefueling.odometer_km;
  }

  const gpsDistance = rides
    .filter((ride) => ride.ended_at && new Date(ride.started_at).getTime() >= refuelTime)
    .reduce((acc, ride) => acc + ride.distance_gps_km, 0);

  return gpsDistance;
}

export function computeFuelStatus(
  tankCapacityL: number,
  refuelings: Refueling[],
  rides: Ride[],
  currentOdometer?: number | null
): FuelStatus {
  const samples = computeConsumptionSamples(refuelings);
  const avgConsumption = averageConsumption(samples);

  const sorted = [...refuelings].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const lastRefueling = sorted[0];

  if (!lastRefueling || avgConsumption == null) {
    return {
      avg_consumption_l_per_100km: avgConsumption,
      sample_count: samples.length,
      fuel_remaining_l: null,
      fuel_remaining_pct: null,
      km_to_empty: null,
      distance_since_last_fill_km: 0,
    };
  }

  const distanceSince = distanceSinceRefueling(lastRefueling, rides, currentOdometer);
  const fuelAtFill = fuelAtRefueling(lastRefueling, tankCapacityL);
  const fuelUsed = (distanceSince * avgConsumption) / 100;
  const fuelRemaining = Math.max(0, fuelAtFill - fuelUsed);
  const fuelPct = (fuelRemaining / tankCapacityL) * 100;
  const kmToEmpty = avgConsumption > 0 ? (fuelRemaining / avgConsumption) * 100 : null;

  return {
    avg_consumption_l_per_100km: avgConsumption,
    sample_count: samples.length,
    fuel_remaining_l: fuelRemaining,
    fuel_remaining_pct: fuelPct,
    km_to_empty: kmToEmpty,
    distance_since_last_fill_km: distanceSince,
  };
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function routeDistanceKm(points: { lat: number; lng: number }[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(
      points[i - 1].lat,
      points[i - 1].lng,
      points[i].lat,
      points[i].lng
    );
  }
  return total;
}
