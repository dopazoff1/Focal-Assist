import 'zone.js';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { getStoredUiLanguage } from './app/utils/locale';

registerLocaleData(localeFr);

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const raw = (localStorage.getItem('ui_scale_mode_v2') || 'CLASSIC').toString().trim().toUpperCase();
  document.documentElement.classList.toggle('ui-scale-compact', raw === 'COMPACT');
  document.documentElement.lang = getStoredUiLanguage();
  document.documentElement.dir = 'ltr';
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
