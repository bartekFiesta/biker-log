import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { addRefueling, addServiceRecord, getActiveBikeId } from './db';
import { SERVICE_TYPE_LABELS, type ServiceType } from './types';

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
}

function reverseServiceLabel(label: string): ServiceType {
  const entry = Object.entries(SERVICE_TYPE_LABELS).find(([, value]) => value === label);
  return (entry?.[0] as ServiceType) ?? 'other';
}

export async function importCsvFromPicker(): Promise<{ fuel: number; service: number }> {
  const pick = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'text/plain'],
    copyToCacheDirectory: true,
  });

  if (pick.canceled || !pick.assets[0]) {
    return { fuel: 0, service: 0 };
  }

  const content = await FileSystem.readAsStringAsync(pick.assets[0].uri);
  const bikeId = await getActiveBikeId();
  let section: 'none' | 'fuel' | 'service' = 'none';
  let fuelCount = 0;
  let serviceCount = 0;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      if (line.includes('# FUEL')) section = 'fuel';
      else if (line.includes('# SERVICE')) section = 'service';
      continue;
    }

    const cells = parseCsvLine(line);
    if (cells[0] === 'id') continue;

    if (section === 'fuel' && cells.length >= 7) {
      await addRefueling({
        bike_id: bikeId,
        date: cells[1],
        odometer_km: Number(cells[2]),
        liters: Number(cells[3]),
        total_price: Number(cells[4]),
        price_per_liter: Number(cells[5]),
        is_full_tank: cells[6] === 'true' || cells[6] === '1',
      });
      fuelCount++;
    }

    if (section === 'service' && cells.length >= 5) {
      await addServiceRecord({
        bike_id: bikeId,
        type: reverseServiceLabel(cells[1]),
        date: cells[2],
        odometer_km: Number(cells[3]),
        notes: cells[4] || null,
      });
      serviceCount++;
    }
  }

  return { fuel: fuelCount, service: serviceCount };
}
