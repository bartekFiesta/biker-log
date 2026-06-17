import en from './translations/en';
import es from './translations/es';

export type AppLanguage = 'en' | 'es';

const translations = { en, es } as const;

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const value = path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
  return typeof value === 'string' ? value : undefined;
}

export function translate(
  language: AppLanguage,
  key: string,
  params?: Record<string, string | number>
): string {
  let text = getNested(translations[language] as Record<string, unknown>, key);
  if (text == null) {
    text = getNested(en as Record<string, unknown>, key) ?? key;
  }

  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), String(value));
    }
  }

  return text;
}

export function getServiceTypeLabel(language: AppLanguage, type: string): string {
  return translate(language, `serviceTypes.${type}`);
}

export function getStatsPeriodLabel(language: AppLanguage, period: 'week' | 'month' | 'year'): string {
  return translate(language, `statsPeriod.${period}`);
}

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export function createTranslator(language: AppLanguage): TranslateFn {
  return (key, params) => translate(language, key, params);
}
