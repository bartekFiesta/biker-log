import type {
  ConsumptionSample,
  ConsumptionSource,
  FuelStatus,
  FuelTriplet,
  Refueling,
  Ride,
  TravelDistanceSource,
} from './types';

const MAX_SAMPLES = 5;
/** Max relative gap before odometer and GPS are treated as agreeing. */
const ODOMETER_GPS_TOLERANCE = 0.15;

export interface ResolvedTravelDistance {
  distance_km: number;
  source: TravelDistanceSource;
}

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

export function gpsDistanceInPeriod(
  rides: Ride[],
  periodStartMs: number,
  periodEndMs?: number
): number {
  return rides
    .filter((ride) => {
      if (!ride.ended_at) return false;
      const startMs = new Date(ride.started_at).getTime();
      if (startMs < periodStartMs) return false;
      if (periodEndMs != null && startMs > periodEndMs) return false;
      return true;
    })
    .reduce((acc, ride) => acc + ride.distance_gps_km, 0);
}

/**
 * Picks the best distance estimate from odometer readings and recorded GPS rides.
 * Odometer is preferred when it agrees with GPS; GPS fills gaps when the odometer
 * was not updated; combined average handles moderate disagreement.
 */
export function resolveTravelDistanceKm(
  rides: Ride[],
  periodStartMs: number,
  odometerStartKm: number,
  odometerEndKm: number | null | undefined,
  periodEndMs?: number
): ResolvedTravelDistance {
  const gps = gpsDistanceInPeriod(rides, periodStartMs, periodEndMs);
  const odometerDelta =
    odometerEndKm != null && odometerEndKm > odometerStartKm
      ? odometerEndKm - odometerStartKm
      : null;

  if (odometerDelta == null || odometerDelta <= 0) {
    return { distance_km: gps, source: gps > 0 ? 'gps' : 'odometer' };
  }

  if (gps <= 0) {
    return { distance_km: odometerDelta, source: 'odometer' };
  }

  const maxDistance = Math.max(odometerDelta, gps);
  const ratioDiff = Math.abs(odometerDelta - gps) / maxDistance;

  if (ratioDiff <= ODOMETER_GPS_TOLERANCE) {
    return { distance_km: odometerDelta, source: 'odometer' };
  }

  if (gps > odometerDelta * (1 + ODOMETER_GPS_TOLERANCE)) {
    return { distance_km: gps, source: 'gps' };
  }

  if (odometerDelta > gps * (1 + ODOMETER_GPS_TOLERANCE)) {
    return { distance_km: odometerDelta, source: 'odometer' };
  }

  return {
    distance_km: odometerDelta * 0.6 + gps * 0.4,
    source: 'combined',
  };
}

export function computeConsumptionSamples(
  refuelings: Refueling[],
  rides: Ride[] = []
): ConsumptionSample[] {
  const sorted = [...refuelings].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const samples: ConsumptionSample[] = [];
  let prevFull: Refueling | null = null;

  for (const refueling of sorted) {
    if (!refueling.is_full_tank) continue;

    if (prevFull) {
      const periodStart = new Date(prevFull.date).getTime();
      const periodEnd = new Date(refueling.date).getTime();
      const resolved = resolveTravelDistanceKm(
        rides,
        periodStart,
        prevFull.odometer_km,
        refueling.odometer_km,
        periodEnd
      );

      if (resolved.distance_km > 0 && refueling.liters > 0) {
        samples.push({
          consumption_l_per_100km: (refueling.liters / resolved.distance_km) * 100,
          distance_km: resolved.distance_km,
          date: refueling.date,
          distance_source: resolved.source,
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

interface FuelBaseline {
  odometer_km: number;
  periodStartMs: number;
  fuelLiters: number;
}

function resolveFuelBaseline(
  lastRefueling: Refueling | undefined,
  tankCapacityL: number,
  baselineOdometerKm?: number | null
): FuelBaseline | null {
  if (lastRefueling) {
    return {
      odometer_km: lastRefueling.odometer_km,
      periodStartMs: new Date(lastRefueling.date).getTime(),
      fuelLiters: fuelAtRefueling(lastRefueling, tankCapacityL),
    };
  }

  if (baselineOdometerKm != null) {
    return {
      odometer_km: baselineOdometerKm,
      periodStartMs: 0,
      fuelLiters: tankCapacityL,
    };
  }

  return {
    odometer_km: 0,
    periodStartMs: 0,
    fuelLiters: tankCapacityL,
  };
}

export function distanceSinceRefueling(
  lastRefueling: Refueling,
  rides: Ride[],
  currentOdometer?: number | null
): number {
  return distanceSinceRefuelingResolved(lastRefueling, rides, currentOdometer).distance_km;
}

export function distanceSinceRefuelingResolved(
  lastRefueling: Refueling,
  rides: Ride[],
  currentOdometer?: number | null
): ResolvedTravelDistance {
  const refuelTime = new Date(lastRefueling.date).getTime();
  return resolveTravelDistanceKm(
    rides,
    refuelTime,
    lastRefueling.odometer_km,
    currentOdometer ?? null
  );
}

export function computeFuelStatus(
  tankCapacityL: number,
  refuelings: Refueling[],
  rides: Ride[],
  currentOdometer?: number | null,
  defaultConsumptionLPer100km?: number | null,
  baselineOdometerKm?: number | null
): FuelStatus {
  const samples = computeConsumptionSamples(refuelings, rides);
  const measuredConsumption = averageConsumption(samples);
  const effectiveConsumption = measuredConsumption ?? defaultConsumptionLPer100km ?? null;
  const consumptionSource: ConsumptionSource | null =
    measuredConsumption != null
      ? 'measured'
      : defaultConsumptionLPer100km != null
        ? 'default'
        : null;
  const gpsAssistedSampleCount = samples.filter((s) => s.distance_source !== 'odometer').length;

  const sorted = [...refuelings].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const lastRefueling = sorted[0];
  const baseline = resolveFuelBaseline(lastRefueling, tankCapacityL, baselineOdometerKm);

  if (!baseline || effectiveConsumption == null) {
    return {
      avg_consumption_l_per_100km: effectiveConsumption,
      consumption_source: consumptionSource,
      sample_count: samples.length,
      gps_assisted_sample_count: gpsAssistedSampleCount,
      fuel_remaining_l: null,
      fuel_remaining_pct: null,
      km_to_empty: null,
      distance_since_last_fill_km: 0,
      distance_since_last_fill_source: null,
    };
  }

  const distanceSince = resolveTravelDistanceKm(
    rides,
    baseline.periodStartMs,
    baseline.odometer_km,
    currentOdometer ?? null
  );
  const fuelUsed = (distanceSince.distance_km * effectiveConsumption) / 100;
  const fuelRemaining = Math.max(0, baseline.fuelLiters - fuelUsed);
  const fuelPct = (fuelRemaining / tankCapacityL) * 100;
  const kmToEmpty = effectiveConsumption > 0 ? (fuelRemaining / effectiveConsumption) * 100 : null;

  return {
    avg_consumption_l_per_100km: effectiveConsumption,
    consumption_source: consumptionSource,
    sample_count: samples.length,
    gps_assisted_sample_count: gpsAssistedSampleCount,
    fuel_remaining_l: fuelRemaining,
    fuel_remaining_pct: fuelPct,
    km_to_empty: kmToEmpty,
    distance_since_last_fill_km: distanceSince.distance_km,
    distance_since_last_fill_source: distanceSince.source,
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

export interface RideFuelEstimate {
  liters: number;
  cost: number;
  consumption_l_per_100km: number;
  price_per_liter: number;
}

/** Estimated fuel used and cost for a completed ride. */
export function computeRideFuelEstimate(
  ride: Ride,
  refuelings: Refueling[],
  consumptionLPer100km: number | null | undefined
): RideFuelEstimate | null {
  if (ride.distance_gps_km <= 0 || consumptionLPer100km == null || consumptionLPer100km <= 0) {
    return null;
  }

  const rideEndMs = ride.ended_at ? new Date(ride.ended_at).getTime() : Date.now();
  const priceRefueling =
    [...refuelings]
      .filter((item) => new Date(item.date).getTime() <= rideEndMs && item.price_per_liter > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ??
    refuelings.find((item) => item.price_per_liter > 0);

  if (!priceRefueling) return null;

  const liters = (ride.distance_gps_km * consumptionLPer100km) / 100;
  return {
    liters,
    cost: liters * priceRefueling.price_per_liter,
    consumption_l_per_100km: consumptionLPer100km,
    price_per_liter: priceRefueling.price_per_liter,
  };
}
