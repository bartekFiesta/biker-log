export const DEFAULT_CURRENCY = 'USD';

export const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'PLN', 'CHF', 'CAD', 'AUD'] as const;

export type CurrencyOption = (typeof CURRENCY_OPTIONS)[number];

export function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase().slice(0, 6);
}

export function isKnownCurrency(value: string): boolean {
  return CURRENCY_OPTIONS.includes(normalizeCurrency(value) as CurrencyOption);
}
