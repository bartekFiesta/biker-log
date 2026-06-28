export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDurationMs(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

export function formatDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return '—';
  return formatDurationMs(new Date(endIso).getTime() - new Date(startIso).getTime());
}

export function formatNumber(value: number, decimals = 1): string {
  return value.toFixed(decimals);
}

export function formatCurrency(value: number, currency: string): string {
  return `${formatNumber(value, 2)} ${currency}`;
}
