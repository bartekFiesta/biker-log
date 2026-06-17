import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { getRefuelings, getRides, getServiceRecords } from './db';
import { SERVICE_TYPE_LABELS } from './types';

function csvEscape(value: string | number | boolean | null | undefined): string {
  const text = value == null ? '' : String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(headers: string[], rows: Array<Array<string | number | boolean | null>>): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  return lines.join('\n');
}

export async function exportAllDataCsv(): Promise<void> {
  const [rides, refuelings, services] = await Promise.all([
    getRides(),
    getRefuelings(),
    getServiceRecords(),
  ]);

  const ridesCsv = toCsv(
    ['id', 'started_at', 'ended_at', 'distance_gps_km', 'odometer_start', 'odometer_end', 'paused_duration_ms', 'label', 'tolls_cost'],
    rides.map((ride) => [
      ride.id,
      ride.started_at,
      ride.ended_at,
      ride.distance_gps_km,
      ride.odometer_start,
      ride.odometer_end,
      ride.paused_duration_ms,
      ride.label,
      ride.tolls_cost,
    ])
  );

  const fuelCsv = toCsv(
    ['id', 'date', 'odometer_km', 'liters', 'total_price', 'price_per_liter', 'is_full_tank'],
    refuelings.map((item) => [
      item.id,
      item.date,
      item.odometer_km,
      item.liters,
      item.total_price,
      item.price_per_liter,
      item.is_full_tank,
    ])
  );

  const serviceCsv = toCsv(
    ['id', 'type', 'date', 'odometer_km', 'notes'],
    services.map((item) => [
      item.id,
      SERVICE_TYPE_LABELS[item.type],
      item.date,
      item.odometer_km,
      item.notes,
    ])
  );

  const content = `# Biker Log export ${new Date().toISOString()}\n\n# RIDES\n${ridesCsv}\n\n# FUEL\n${fuelCsv}\n\n# SERVICE\n${serviceCsv}\n`;

  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `biker-log-export-${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const uri = `${FileSystem.cacheDirectory}biker-log-export-${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export Biker Log data',
  });
}
