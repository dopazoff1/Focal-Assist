import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';

export type ThemeKey = string;
export type ColorMode = 'light' | 'dark';

export type ThemeTypology = 'pro' | 'fun' | 'edgy' | 'calm' | 'premium';
export type ThemeLayout =
  | 'glass'
  | 'editorial'
  | 'playful'
  | 'arcade'
  | 'neon'
  | 'brutal'
  | 'soft'
  | 'royal';

export interface ThemeOption {
  key: ThemeKey;
  label: string;
  typology: ThemeTypology;
  layout: ThemeLayout;
  color: string;
}

export interface ThemeCategoryOption {
  key: string;
  label: string;
}

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly storageKey = 'ui-theme';
  private readonly colorModeStorageKey = 'ui-color-mode';
  private activeTheme: ThemeKey = 'pro-glass-azure';
  private activeColorMode: ColorMode = 'light';

  readonly themes: ThemeOption[] = [
    { key: 'pro-glass-azure', label: 'Pro Glass Azure', typology: 'pro', layout: 'glass', color: 'Azure' },
    { key: 'pro-glass-emerald', label: 'Pro Glass Emerald', typology: 'pro', layout: 'glass', color: 'Emerald' },
    { key: 'pro-editorial-graphite', label: 'Pro Editorial Graphite', typology: 'pro', layout: 'editorial', color: 'Graphite' },
    { key: 'pro-editorial-amber', label: 'Pro Editorial Amber', typology: 'pro', layout: 'editorial', color: 'Amber' },
    { key: 'fun-playful-candy', label: 'Fun Playful Candy', typology: 'fun', layout: 'playful', color: 'Candy' },
    { key: 'fun-playful-coral', label: 'Fun Playful Coral', typology: 'fun', layout: 'playful', color: 'Coral' },
    { key: 'fun-arcade-electric', label: 'Fun Arcade Electric', typology: 'fun', layout: 'arcade', color: 'Electric' },
    { key: 'fun-arcade-lime', label: 'Fun Arcade Lime', typology: 'fun', layout: 'arcade', color: 'Lime' },
    { key: 'edgy-neon-cyan', label: 'Edgy Neon Cyan', typology: 'edgy', layout: 'neon', color: 'Cyan' },
    { key: 'edgy-neon-magenta', label: 'Edgy Neon Magenta', typology: 'edgy', layout: 'neon', color: 'Magenta' },
    { key: 'edgy-brutal-sun', label: 'Edgy Brutal Sun', typology: 'edgy', layout: 'brutal', color: 'Sun' },
    { key: 'edgy-brutal-mono', label: 'Edgy Brutal Mono', typology: 'edgy', layout: 'brutal', color: 'Mono' },
    { key: 'calm-soft-sage', label: 'Calm Soft Sage', typology: 'calm', layout: 'soft', color: 'Sage' },
    { key: 'calm-soft-ocean', label: 'Calm Soft Ocean', typology: 'calm', layout: 'soft', color: 'Ocean' },
    { key: 'premium-royal-gold', label: 'Premium Royal Gold', typology: 'premium', layout: 'royal', color: 'Gold' },
    { key: 'premium-royal-ruby', label: 'Premium Royal Ruby', typology: 'premium', layout: 'royal', color: 'Ruby' }
  ];

  private readonly typologyLabels: Record<ThemeTypology, string> = {
    pro: 'Pro',
    fun: 'Fun',
    edgy: 'Edgy',
    calm: 'Calm',
    premium: 'Premium'
  };

  private readonly layoutLabels: Record<ThemeLayout, string> = {
    glass: 'Glass',
    editorial: 'Editorial',
    playful: 'Playful',
    arcade: 'Arcade',
    neon: 'Neon',
    brutal: 'Brutal',
    soft: 'Soft',
    royal: 'Royal'
  };

  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  initializeTheme(): void {
    this.applyTheme(this.getStoredTheme());
    this.applyColorMode(this.getStoredColorMode(), false);
  }

  applyTheme(theme: ThemeKey, persist = true): void {
    this.activeTheme = theme;

    if (!isPlatformBrowser(this.platformId)) return;

    this.document.documentElement.setAttribute('data-theme', theme);
    if (persist) {
      localStorage.setItem(this.storageKey, theme);
    }
  }

  getActiveTheme(): ThemeKey {
    return this.activeTheme;
  }

  isDarkMode(): boolean {
    return this.activeColorMode === 'dark';
  }

  toggleDarkMode(): boolean {
    this.applyColorMode(this.isDarkMode() ? 'light' : 'dark');
    return this.isDarkMode();
  }

  applyColorMode(mode: ColorMode, persist = true): void {
    this.activeColorMode = mode === 'dark' ? 'dark' : 'light';

    if (!isPlatformBrowser(this.platformId)) return;

    this.document.documentElement.setAttribute('data-color-mode', this.activeColorMode);
    if (persist) {
      localStorage.setItem(this.colorModeStorageKey, this.activeColorMode);
    }
  }

  getActiveThemeOption(): ThemeOption {
    return this.getThemeByKey(this.activeTheme) ?? this.themes[0];
  }

  getTypologies(): ThemeCategoryOption[] {
    const seen = new Set<ThemeTypology>();
    const options: ThemeCategoryOption[] = [];

    this.themes.forEach(theme => {
      if (!seen.has(theme.typology)) {
        seen.add(theme.typology);
        options.push({
          key: theme.typology,
          label: this.typologyLabels[theme.typology]
        });
      }
    });

    return options;
  }

  getLayoutsByTypology(typology: ThemeTypology): ThemeCategoryOption[] {
    const seen = new Set<ThemeLayout>();
    const options: ThemeCategoryOption[] = [];

    this.themes
      .filter(theme => theme.typology === typology)
      .forEach(theme => {
        if (!seen.has(theme.layout)) {
          seen.add(theme.layout);
          options.push({
            key: theme.layout,
            label: this.layoutLabels[theme.layout]
          });
        }
      });

    return options;
  }

  getThemesByTypologyAndLayout(
    typology: ThemeTypology,
    layout: ThemeLayout
  ): ThemeOption[] {
    return this.themes.filter(
      theme => theme.typology === typology && theme.layout === layout
    );
  }

  getThemeByKey(key: ThemeKey): ThemeOption | undefined {
    return this.themes.find(theme => theme.key === key);
  }

  private getStoredTheme(): ThemeKey {
    if (!isPlatformBrowser(this.platformId)) return 'pro-glass-azure';

    const savedTheme = localStorage.getItem(this.storageKey) as ThemeKey | null;
    const isKnownTheme = this.themes.some(theme => theme.key === savedTheme);
    return isKnownTheme && savedTheme ? savedTheme : 'pro-glass-azure';
  }

  private getStoredColorMode(): ColorMode {
    if (!isPlatformBrowser(this.platformId)) return 'light';

    return localStorage.getItem(this.colorModeStorageKey) === 'dark' ? 'dark' : 'light';
  }
}
