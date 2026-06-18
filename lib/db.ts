import * as SQLite from 'expo-sqlite';

import type {
  Bike,
  Refueling,
  Ride,
  RoutePoint,
  ServiceRecord,
  ServiceReminderRule,
  ServiceType,
  Settings,
} from './types';

const DB_NAME = 'bikerecord.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = initDatabase();
  }
  return dbPromise;
}

async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      tank_capacity_l REAL NOT NULL DEFAULT 17,
      currency TEXT NOT NULL DEFAULT 'USD',
      reserve_threshold_l REAL NOT NULL DEFAULT 2.5
    );

    CREATE TABLE IF NOT EXISTS refuelings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      odometer_km REAL NOT NULL,
      liters REAL NOT NULL,
      total_price REAL NOT NULL,
      price_per_liter REAL NOT NULL,
      is_full_tank INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS rides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      distance_gps_km REAL NOT NULL DEFAULT 0,
      odometer_start REAL,
      odometer_end REAL,
      route_points TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS service_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      odometer_km REAL NOT NULL,
      notes TEXT
    );
  `);

  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM settings'
  );
  if (!existing || existing.count === 0) {
    await db.runAsync(
      `INSERT INTO settings (id, tank_capacity_l, currency, reserve_threshold_l) VALUES (1, ?, ?, ?)`,
      17,
      'USD',
      2.5
    );
  }

  await migrateRidesTable(db);
  await migrateSettingsTable(db);
  await migrateServiceReminderRules(db);
  await migrateMultiBike(db);
  await migrateBikeConsumption(db);
  await migrateAppLanguage(db);

  return db;
}

async function migrateBikeConsumption(db: SQLite.SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(bikes)');
  if (!cols.some((column) => column.name === 'default_consumption_l_per_100km')) {
    await db.execAsync('ALTER TABLE bikes ADD COLUMN default_consumption_l_per_100km REAL');
  }
}

async function migrateAppLanguage(db: SQLite.SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(settings)');
  if (!cols.some((column) => column.name === 'app_language')) {
    await db.execAsync("ALTER TABLE settings ADD COLUMN app_language TEXT NOT NULL DEFAULT 'en'");
  }
}

async function migrateSettingsTable(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(settings)');
  const names = new Set(columns.map((column) => column.name));

  const addCol = async (sql: string) => {
    if (!names.has(sql.match(/ADD COLUMN (\w+)/)?.[1] ?? '')) {
      await db.execAsync(sql);
    }
  };

  if (!names.has('auto_start_rides')) {
    await db.execAsync('ALTER TABLE settings ADD COLUMN auto_start_rides INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('onboarding_complete')) {
    await db.execAsync('ALTER TABLE settings ADD COLUMN onboarding_complete INTEGER NOT NULL DEFAULT 0');
    await db.runAsync('UPDATE settings SET onboarding_complete = 1 WHERE id = 1');
  }
  if (!names.has('active_bike_id')) {
    await db.execAsync('ALTER TABLE settings ADD COLUMN active_bike_id INTEGER NOT NULL DEFAULT 1');
  }
  if (!names.has('distance_unit')) {
    await db.execAsync("ALTER TABLE settings ADD COLUMN distance_unit TEXT NOT NULL DEFAULT 'km'");
  }
  if (!names.has('volume_unit')) {
    await db.execAsync("ALTER TABLE settings ADD COLUMN volume_unit TEXT NOT NULL DEFAULT 'L'");
  }
  if (!names.has('background_auto_start')) {
    await db.execAsync('ALTER TABLE settings ADD COLUMN background_auto_start INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('notifications_enabled')) {
    await db.execAsync('ALTER TABLE settings ADD COLUMN notifications_enabled INTEGER NOT NULL DEFAULT 1');
  }
  if (!names.has('parked_lat')) {
    await db.execAsync('ALTER TABLE settings ADD COLUMN parked_lat REAL');
  }
  if (!names.has('parked_lng')) {
    await db.execAsync('ALTER TABLE settings ADD COLUMN parked_lng REAL');
  }
  if (!names.has('parked_at')) {
    await db.execAsync('ALTER TABLE settings ADD COLUMN parked_at TEXT');
  }
}

async function migrateMultiBike(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS bikes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      tank_capacity_l REAL NOT NULL DEFAULT 17,
      reserve_threshold_l REAL NOT NULL DEFAULT 2.5,
      baseline_odometer_km REAL
    );
  `);

  const bikeCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM bikes');
  if (!bikeCount || bikeCount.count === 0) {
    const settings = await db.getFirstAsync<{ tank_capacity_l: number; reserve_threshold_l: number }>(
      'SELECT tank_capacity_l, reserve_threshold_l FROM settings WHERE id = 1'
    );
    await db.runAsync(
      `INSERT INTO bikes (id, name, tank_capacity_l, reserve_threshold_l) VALUES (1, ?, ?, ?)`,
      'My motorcycle',
      settings?.tank_capacity_l ?? 17,
      settings?.reserve_threshold_l ?? 2.5
    );
  }

  for (const table of ['refuelings', 'rides', 'service_records'] as const) {
    const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    if (!cols.some((c) => c.name === 'bike_id')) {
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN bike_id INTEGER NOT NULL DEFAULT 1`);
    }
  }

  const rideCols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(rides)');
  const rideNames = new Set(rideCols.map((c) => c.name));
  if (!rideNames.has('label')) {
    await db.execAsync('ALTER TABLE rides ADD COLUMN label TEXT');
  }
  if (!rideNames.has('tolls_cost')) {
    await db.execAsync('ALTER TABLE rides ADD COLUMN tolls_cost REAL');
  }
}

async function migrateServiceReminderRules(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS service_reminder_rules (
      type TEXT PRIMARY KEY,
      interval_km REAL,
      interval_days INTEGER,
      enabled INTEGER NOT NULL DEFAULT 1
    );
  `);

  const defaults: Array<[string, number | null, number | null]> = [
    ['oil', 5000, 365],
    ['brake_front', 15000, null],
    ['brake_rear', 15000, null],
    ['tyre_front', 8000, null],
    ['tyre_rear', 12000, null],
    ['insurance', null, 365],
    ['road_tax', null, 365],
  ];

  for (const [type, km, days] of defaults) {
    await db.runAsync(
      `INSERT OR IGNORE INTO service_reminder_rules (type, interval_km, interval_days, enabled) VALUES (?, ?, ?, 1)`,
      type,
      km,
      days
    );
  }
}

async function migrateRidesTable(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(rides)');
  const names = new Set(columns.map((column) => column.name));

  if (!names.has('is_paused')) {
    await db.execAsync('ALTER TABLE rides ADD COLUMN is_paused INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('paused_duration_ms')) {
    await db.execAsync('ALTER TABLE rides ADD COLUMN paused_duration_ms INTEGER NOT NULL DEFAULT 0');
  }
}

function mapBike(row: Record<string, unknown>): Bike {
  return {
    id: row.id as number,
    name: row.name as string,
    tank_capacity_l: row.tank_capacity_l as number,
    reserve_threshold_l: row.reserve_threshold_l as number,
    baseline_odometer_km: (row.baseline_odometer_km as number | null) ?? null,
    default_consumption_l_per_100km: (row.default_consumption_l_per_100km as number | null) ?? null,
  };
}

function mapRefueling(row: Record<string, unknown>): Refueling {
  return {
    id: row.id as number,
    bike_id: (row.bike_id as number | undefined) ?? 1,
    date: row.date as string,
    odometer_km: row.odometer_km as number,
    liters: row.liters as number,
    total_price: row.total_price as number,
    price_per_liter: row.price_per_liter as number,
    is_full_tank: Boolean(row.is_full_tank),
  };
}

function mapRide(row: Record<string, unknown>): Ride {
  return {
    id: row.id as number,
    bike_id: (row.bike_id as number | undefined) ?? 1,
    started_at: row.started_at as string,
    ended_at: (row.ended_at as string | null) ?? null,
    distance_gps_km: row.distance_gps_km as number,
    odometer_start: (row.odometer_start as number | null) ?? null,
    odometer_end: (row.odometer_end as number | null) ?? null,
    route_points: JSON.parse((row.route_points as string) || '[]') as RoutePoint[],
    is_paused: Boolean(row.is_paused),
    paused_duration_ms: (row.paused_duration_ms as number | undefined) ?? 0,
    label: (row.label as string | null) ?? null,
    tolls_cost: (row.tolls_cost as number | null) ?? null,
  };
}

function mapService(row: Record<string, unknown>): ServiceRecord {
  return {
    id: row.id as number,
    bike_id: (row.bike_id as number | undefined) ?? 1,
    type: row.type as ServiceType,
    date: row.date as string,
    odometer_km: row.odometer_km as number,
    notes: (row.notes as string | null) ?? null,
  };
}

function mapSettings(row: Record<string, unknown>): Settings {
  return {
    id: row.id as number,
    active_bike_id: (row.active_bike_id as number | undefined) ?? 1,
    currency: row.currency as string,
    distance_unit: ((row.distance_unit as string) ?? 'km') as Settings['distance_unit'],
    volume_unit: ((row.volume_unit as string) ?? 'L') as Settings['volume_unit'],
    app_language: ((row.app_language as string) ?? 'en') as Settings['app_language'],
    auto_start_rides: Boolean(row.auto_start_rides ?? 0),
    background_auto_start: Boolean(row.background_auto_start ?? 0),
    notifications_enabled: Boolean(row.notifications_enabled ?? 1),
    onboarding_complete: Boolean(row.onboarding_complete ?? 0),
    parked_lat: (row.parked_lat as number | null) ?? null,
    parked_lng: (row.parked_lng as number | null) ?? null,
    parked_at: (row.parked_at as string | null) ?? null,
    tank_capacity_l: row.tank_capacity_l as number | undefined,
    reserve_threshold_l: row.reserve_threshold_l as number | undefined,
  };
}

export async function getSettings(): Promise<Settings> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM settings WHERE id = 1');
  if (!row) throw new Error('Settings not found');
  return mapSettings(row);
}

export async function getActiveBikeId(): Promise<number> {
  const settings = await getSettings();
  return settings.active_bike_id;
}

export async function getActiveBike(): Promise<Bike> {
  const bike = await getBike(await getActiveBikeId());
  if (!bike) throw new Error('Active bike not found');
  return bike;
}

export async function getBikes(): Promise<Bike[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>('SELECT * FROM bikes ORDER BY id');
  return rows.map(mapBike);
}

export async function getBike(id: number): Promise<Bike | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM bikes WHERE id = ?', id);
  return row ? mapBike(row) : null;
}

export async function addBike(
  data: Omit<Bike, 'id'>
): Promise<Bike> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO bikes (name, tank_capacity_l, reserve_threshold_l, baseline_odometer_km, default_consumption_l_per_100km)
     VALUES (?, ?, ?, ?, ?)`,
    data.name,
    data.tank_capacity_l,
    data.reserve_threshold_l,
    data.baseline_odometer_km,
    data.default_consumption_l_per_100km ?? null
  );
  return { id: result.lastInsertRowId, ...data };
}

export async function updateBike(id: number, partial: Partial<Omit<Bike, 'id'>>): Promise<Bike> {
  const current = await getBike(id);
  if (!current) throw new Error('Bike not found');
  const next = { ...current, ...partial };
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE bikes SET name = ?, tank_capacity_l = ?, reserve_threshold_l = ?, baseline_odometer_km = ?,
     default_consumption_l_per_100km = ? WHERE id = ?`,
    next.name,
    next.tank_capacity_l,
    next.reserve_threshold_l,
    next.baseline_odometer_km,
    next.default_consumption_l_per_100km,
    id
  );
  return next;
}

export async function setActiveBike(id: number): Promise<void> {
  await updateSettings({ active_bike_id: id });
}

export async function updateSettings(partial: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const db = await getDatabase();
  const current = await getSettings();
  const next = { ...current, ...partial };

  await db.runAsync(
    `UPDATE settings SET active_bike_id = ?, currency = ?, distance_unit = ?, volume_unit = ?,
     app_language = ?, auto_start_rides = ?, background_auto_start = ?, notifications_enabled = ?, onboarding_complete = ?,
     parked_lat = ?, parked_lng = ?, parked_at = ? WHERE id = 1`,
    next.active_bike_id,
    next.currency,
    next.distance_unit,
    next.volume_unit,
    next.app_language,
    next.auto_start_rides ? 1 : 0,
    next.background_auto_start ? 1 : 0,
    next.notifications_enabled ? 1 : 0,
    next.onboarding_complete ? 1 : 0,
    next.parked_lat,
    next.parked_lng,
    next.parked_at
  );
  return next;
}

export async function saveParkedLocation(lat: number, lng: number): Promise<void> {
  await updateSettings({
    parked_lat: lat,
    parked_lng: lng,
    parked_at: new Date().toISOString(),
  });
}

export async function getRefuelings(bikeId?: number): Promise<Refueling[]> {
  const db = await getDatabase();
  const id = bikeId ?? (await getActiveBikeId());
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM refuelings WHERE bike_id = ? ORDER BY date DESC',
    id
  );
  return rows.map(mapRefueling);
}

export async function getRefueling(id: number): Promise<Refueling | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM refuelings WHERE id = ?', id);
  return row ? mapRefueling(row) : null;
}

export async function addRefueling(
  data: Omit<Refueling, 'id' | 'bike_id'> & { bike_id?: number }
): Promise<Refueling> {
  const db = await getDatabase();
  const bikeId = data.bike_id ?? (await getActiveBikeId());
  const result = await db.runAsync(
    `INSERT INTO refuelings (bike_id, date, odometer_km, liters, total_price, price_per_liter, is_full_tank)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    bikeId,
    data.date,
    data.odometer_km,
    data.liters,
    data.total_price,
    data.price_per_liter,
    data.is_full_tank ? 1 : 0
  );
  return { id: result.lastInsertRowId, ...data, bike_id: bikeId };
}

export async function updateRefueling(id: number, data: Omit<Refueling, 'id'>): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE refuelings SET date = ?, odometer_km = ?, liters = ?, total_price = ?, price_per_liter = ?, is_full_tank = ? WHERE id = ?`,
    data.date,
    data.odometer_km,
    data.liters,
    data.total_price,
    data.price_per_liter,
    data.is_full_tank ? 1 : 0,
    id
  );
}

export async function deleteRefueling(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM refuelings WHERE id = ?', id);
}

export async function getRides(bikeId?: number): Promise<Ride[]> {
  const db = await getDatabase();
  const id = bikeId ?? (await getActiveBikeId());
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM rides WHERE bike_id = ? ORDER BY started_at DESC',
    id
  );
  return rows.map(mapRide);
}

export async function getRide(id: number): Promise<Ride | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM rides WHERE id = ?', id);
  return row ? mapRide(row) : null;
}

export async function getActiveRide(): Promise<Ride | null> {
  const bikeId = await getActiveBikeId();
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM rides WHERE ended_at IS NULL AND bike_id = ? ORDER BY started_at DESC LIMIT 1',
    bikeId
  );
  return row ? mapRide(row) : null;
}

export async function createRide(odometerStart: number | null, bikeId?: number): Promise<Ride> {
  const db = await getDatabase();
  const activeBikeId = bikeId ?? (await getActiveBikeId());
  const startedAt = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO rides (bike_id, started_at, distance_gps_km, odometer_start, route_points)
     VALUES (?, ?, 0, ?, '[]')`,
    activeBikeId,
    startedAt,
    odometerStart
  );
  return {
    id: result.lastInsertRowId,
    bike_id: activeBikeId,
    started_at: startedAt,
    ended_at: null,
    distance_gps_km: 0,
    odometer_start: odometerStart,
    odometer_end: null,
    route_points: [],
    is_paused: false,
    paused_duration_ms: 0,
    label: null,
    tolls_cost: null,
  };
}

export async function updateRideRoute(
  id: number,
  routePoints: RoutePoint[],
  distanceGpsKm: number
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE rides SET route_points = ?, distance_gps_km = ? WHERE id = ?',
    JSON.stringify(routePoints),
    distanceGpsKm,
    id
  );
}

export async function updateRidePauseState(
  id: number,
  isPaused: boolean,
  pausedDurationMs: number
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE rides SET is_paused = ?, paused_duration_ms = ? WHERE id = ?',
    isPaused ? 1 : 0,
    pausedDurationMs,
    id
  );
}

export async function updateRideDetails(
  id: number,
  partial: {
    odometer_start?: number | null;
    odometer_end?: number | null;
    label?: string | null;
    tolls_cost?: number | null;
  }
): Promise<void> {
  const ride = await getRide(id);
  if (!ride) throw new Error('Ride not found');
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE rides SET odometer_start = ?, odometer_end = ?, label = ?, tolls_cost = ? WHERE id = ?`,
    partial.odometer_start !== undefined ? partial.odometer_start : ride.odometer_start,
    partial.odometer_end !== undefined ? partial.odometer_end : ride.odometer_end,
    partial.label !== undefined ? partial.label : ride.label,
    partial.tolls_cost !== undefined ? partial.tolls_cost : ride.tolls_cost,
    id
  );
}

export async function finishRide(
  id: number,
  routePoints: RoutePoint[],
  distanceGpsKm: number,
  odometerEnd: number | null,
  pausedDurationMs: number,
  label: string | null = null,
  tollsCost: number | null = null
): Promise<void> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `UPDATE rides SET ended_at = ?, route_points = ?, distance_gps_km = ?, odometer_end = ?,
     is_paused = 0, paused_duration_ms = ?, label = ?, tolls_cost = ? WHERE id = ? AND ended_at IS NULL`,
    new Date().toISOString(),
    JSON.stringify(routePoints),
    distanceGpsKm,
    odometerEnd,
    pausedDurationMs,
    label,
    tollsCost,
    id
  );
  if (result.changes === 0) {
    throw new Error('Ride already finished or not found');
  }

  const last = routePoints[routePoints.length - 1];
  if (last) {
    await saveParkedLocation(last.lat, last.lng);
  }
}

export async function deleteRide(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM rides WHERE id = ?', id);
}

export async function getServiceRecords(bikeId?: number): Promise<ServiceRecord[]> {
  const db = await getDatabase();
  const id = bikeId ?? (await getActiveBikeId());
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM service_records WHERE bike_id = ? ORDER BY date DESC',
    id
  );
  return rows.map(mapService);
}

export async function getServiceRecord(id: number): Promise<ServiceRecord | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM service_records WHERE id = ?',
    id
  );
  return row ? mapService(row) : null;
}

export async function addServiceRecord(
  data: Omit<ServiceRecord, 'id' | 'bike_id'> & { bike_id?: number }
): Promise<ServiceRecord> {
  const db = await getDatabase();
  const bikeId = data.bike_id ?? (await getActiveBikeId());
  const result = await db.runAsync(
    `INSERT INTO service_records (bike_id, type, date, odometer_km, notes) VALUES (?, ?, ?, ?, ?)`,
    bikeId,
    data.type,
    data.date,
    data.odometer_km,
    data.notes
  );
  return { id: result.lastInsertRowId, ...data, bike_id: bikeId };
}

export async function updateServiceRecord(id: number, data: Omit<ServiceRecord, 'id'>): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE service_records SET type = ?, date = ?, odometer_km = ?, notes = ? WHERE id = ?`,
    data.type,
    data.date,
    data.odometer_km,
    data.notes,
    id
  );
}

export async function deleteServiceRecord(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM service_records WHERE id = ?', id);
}

export async function getLatestOdometer(bikeId?: number): Promise<number | null> {
  const id = bikeId ?? (await getActiveBikeId());
  const bike = await getBike(id);
  const refuelings = await getRefuelings(id);
  const rides = await getRides(id);
  const services = await getServiceRecords(id);

  const values = [
    bike?.baseline_odometer_km,
    ...refuelings.map((r) => r.odometer_km),
    ...rides.map((r) => r.odometer_end).filter((v): v is number => v != null),
    ...rides.map((r) => r.odometer_start).filter((v): v is number => v != null),
    ...services.map((s) => s.odometer_km),
  ].filter((v): v is number => v != null && Number.isFinite(v));

  return values.length > 0 ? Math.max(...values) : null;
}

export async function getServiceReminderRules(): Promise<ServiceReminderRule[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM service_reminder_rules ORDER BY type'
  );
  return rows.map((row) => ({
    type: row.type as ServiceReminderRule['type'],
    interval_km: (row.interval_km as number | null) ?? null,
    interval_days: (row.interval_days as number | null) ?? null,
    enabled: Boolean(row.enabled),
  }));
}

export async function updateServiceReminderRule(rule: ServiceReminderRule): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE service_reminder_rules SET interval_km = ?, interval_days = ?, enabled = ? WHERE type = ?`,
    rule.interval_km,
    rule.interval_days,
    rule.enabled ? 1 : 0,
    rule.type
  );
}

export async function completeOnboarding(
  bikeName: string,
  tankCapacityL: number,
  currency: string,
  baselineOdometer: number | null,
  defaultConsumptionLPer100km: number
): Promise<void> {
  await updateBike(1, {
    name: bikeName,
    tank_capacity_l: tankCapacityL,
    reserve_threshold_l: Math.max(1, tankCapacityL * 0.15),
    baseline_odometer_km: baselineOdometer,
    default_consumption_l_per_100km: defaultConsumptionLPer100km,
  });
  await updateSettings({
    active_bike_id: 1,
    currency,
    onboarding_complete: true,
  });
}
