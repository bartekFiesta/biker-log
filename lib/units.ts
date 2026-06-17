import type { DistanceUnit, VolumeUnit } from './types';

const KM_TO_MI = 0.621371;
const L_TO_GAL = 0.264172;

export function kmToDisplay(km: number, unit: DistanceUnit): number {
  return unit === 'mi' ? km * KM_TO_MI : km;
}

export function displayToKm(value: number, unit: DistanceUnit): number {
  return unit === 'mi' ? value / KM_TO_MI : value;
}

export function litersToDisplay(liters: number, unit: VolumeUnit): number {
  return unit === 'gal' ? liters * L_TO_GAL : liters;
}

export function displayToLiters(value: number, unit: VolumeUnit): number {
  return unit === 'gal' ? value / L_TO_GAL : value;
}

export function distanceUnitLabel(unit: DistanceUnit): string {
  return unit === 'mi' ? 'mi' : 'km';
}

export function volumeUnitLabel(unit: VolumeUnit): string {
  return unit === 'gal' ? 'gal' : 'L';
}

export function consumptionLabel(volumeUnit: VolumeUnit, distanceUnit: DistanceUnit): string {
  if (volumeUnit === 'gal' && distanceUnit === 'mi') return 'MPG';
  if (volumeUnit === 'L' && distanceUnit === 'km') return 'L/100 km';
  return `${volumeUnitLabel(volumeUnit)}/100 ${distanceUnitLabel(distanceUnit)}`;
}

export function formatConsumption(
  litersPer100Km: number,
  volumeUnit: VolumeUnit,
  distanceUnit: DistanceUnit,
  decimals = 1
): string {
  if (volumeUnit === 'gal' && distanceUnit === 'mi') {
    const mpg = litersPer100Km > 0 ? 235.214583 / litersPer100Km : 0;
    return `${mpg.toFixed(decimals)} MPG`;
  }
  const display = litersToDisplay(litersPer100Km, volumeUnit);
  return `${display.toFixed(decimals)} ${consumptionLabel(volumeUnit, distanceUnit)}`;
}

export function formatDistance(km: number, unit: DistanceUnit, decimals = 1): string {
  return `${kmToDisplay(km, unit).toFixed(decimals)} ${distanceUnitLabel(unit)}`;
}

export function formatVolume(liters: number, unit: VolumeUnit, decimals = 1): string {
  return `${litersToDisplay(liters, unit).toFixed(decimals)} ${volumeUnitLabel(unit)}`;
}
