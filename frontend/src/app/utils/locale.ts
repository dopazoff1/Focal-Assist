export type UiLanguage = 'en' | 'fr';

export const UI_LANGUAGE_STORAGE_KEY = 'focal.ui.language';
const LEGACY_UI_LANGUAGE_STORAGE_KEY = 'focalassist.ui.language';
export const DEFAULT_UI_LANGUAGE: UiLanguage = 'en';

export interface UiLanguageOption {
  code: UiLanguage;
  label: string;
}

export const UI_LANGUAGE_OPTIONS: UiLanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' }
];

export function normalizeUiLanguage(value: unknown): UiLanguage {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'fr' || raw.startsWith('fr-')) {
    return 'fr';
  }
  return 'en';
}

export function getStoredUiLanguage(): UiLanguage {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    return normalizeUiLanguage(localStorage.getItem(UI_LANGUAGE_STORAGE_KEY) || localStorage.getItem(LEGACY_UI_LANGUAGE_STORAGE_KEY));
  }
  if (typeof navigator !== 'undefined') {
    return normalizeUiLanguage(navigator.language || navigator.languages?.[0] || DEFAULT_UI_LANGUAGE);
  }
  return DEFAULT_UI_LANGUAGE;
}

export function storeUiLanguage(language: UiLanguage): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, language);
}

export function languageToLocale(language: UiLanguage): string {
  return language === 'fr' ? 'fr-FR' : 'en-US';
}

export function getActiveLocale(): string {
  return languageToLocale(getStoredUiLanguage());
}

export function isRtlLanguage(_language: UiLanguage): boolean {
  return false;
}
