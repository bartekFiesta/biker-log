export type ServiceType =
  | 'oil'
  | 'brake_front'
  | 'brake_rear'
  | 'tyre_front'
  | 'tyre_rear'
  | 'insurance'
  | 'road_tax'
  | 'other';

export type DistanceUnit = 'km' | 'mi';
export type VolumeUnit = 'L' | 'gal';

export interface Bike {
  id: number;
  name: string;
  tank_capacity_l: number;
  reserve_threshold_l: number;
  baseline_odometer_km: number | null;
  /** Used until consumption is calculated from two full-tank refuelings. */
  default_consumption_l_per_100km: number | null;
}

export type AppLanguage = 'en' | 'es';

export interface Settings {
  id: number;
  active_bike_id: number;
  currency: string;
  distance_unit: DistanceUnit;
  volume_unit: VolumeUnit;
  app_language: AppLanguage;
  auto_start_rides: boolean;
  background_auto_start: boolean;
  notifications_enabled: boolean;
  onboarding_complete: boolean;
  parked_lat: number | null;
  parked_lng: number | null;
  parked_at: string | null;
  /** @deprecated use active bike tank_capacity_l */
  tank_capacity_l?: number;
  reserve_threshold_l?: number;
}

export interface Refueling {
  id: number;
  bike_id: number;
  date: string;
  odometer_km: number;
  liters: number;
  total_price: number;
  price_per_liter: number;
  is_full_tank: boolean;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  ts: number;
  speed_kmh?: number;
}

export interface Ride {
  id: number;
  bike_id: number;
  started_at: string;
  ended_at: string | null;
  distance_gps_km: number;
  odometer_start: number | null;
  odometer_end: number | null;
  route_points: RoutePoint[];
  is_paused: boolean;
  paused_duration_ms: number;
  label: string | null;
  tolls_cost: number | null;
}

export type RideRecordingState = 'idle' | 'recording' | 'paused';

export interface ServiceRecord {
  id: number;
  bike_id: number;
  type: ServiceType;
  date: string;
  odometer_km: number;
  notes: string | null;
}

export type ReminderServiceType =
  | 'oil'
  | 'brake_front'
  | 'brake_rear'
  | 'tyre_front'
  | 'tyre_rear'
  | 'insurance'
  | 'road_tax';

export interface ServiceReminderRule {
  type: ReminderServiceType;
  interval_km: number | null;
  interval_days: number | null;
  enabled: boolean;
}

export type ReminderStatusLevel = 'ok' | 'due_soon' | 'overdue' | 'unknown';

export interface ServiceReminderStatus {
  type: ReminderServiceType;
  label: string;
  level: ReminderStatusLevel;
  message: string;
  km_remaining: number | null;
  days_remaining: number | null;
}

export type StatsPeriod = 'week' | 'month' | 'year';

export interface PeriodStats {
  period: StatsPeriod;
  label: string;
  ride_count: number;
  total_distance_km: number;
  total_moving_time_ms: number;
  refuel_count: number;
  liters_total: number;
  fuel_spent: number;
}

export interface RideSpeedStats {
  max_kmh: number;
  avg_kmh: number;
}

export interface FuelTriplet {
  liters: number | null;
  total_price: number | null;
  price_per_liter: number | null;
}

export type TravelDistanceSource = 'odometer' | 'gps' | 'combined';

export interface ConsumptionSample {
  consumption_l_per_100km: number;
  distance_km: number;
  date: string;
  distance_source: TravelDistanceSource;
}

export type ConsumptionSource = 'measured' | 'default';

export interface FuelStatus {
  avg_consumption_l_per_100km: number | null;
  consumption_source: ConsumptionSource | null;
  sample_count: number;
  gps_assisted_sample_count: number;
  fuel_remaining_l: number | null;
  fuel_remaining_pct: number | null;
  km_to_empty: number | null;
  distance_since_last_fill_km: number;
  distance_since_last_fill_source: TravelDistanceSource | null;
}

export interface ChartPoint {
  label: string;
  value: number;
}

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  oil: 'Oil change',
  brake_front: 'Front brake pads',
  brake_rear: 'Rear brake pads',
  tyre_front: 'Front tyre',
  tyre_rear: 'Rear tyre',
  insurance: 'Insurance',
  road_tax: 'Road tax',
  other: 'Other',
};

export const REMINDER_SERVICE_TYPES: ReminderServiceType[] = [
  'oil',
  'brake_front',
  'brake_rear',
  'tyre_front',
  'tyre_rear',
  'insurance',
  'road_tax',
];

export const SERVICE_TYPES: ServiceType[] = [
  'oil',
  'brake_front',
  'brake_rear',
  'tyre_front',
  'tyre_rear',
  'insurance',
  'road_tax',
  'other',
];
