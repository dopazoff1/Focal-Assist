import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { AuthService } from '../../services/auth';
import {
  ThemeCategoryOption,
  ThemeKey,
  ThemeLayout,
  ThemeService,
  ThemeTypology
} from '../../services/theme';

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrls: ['./header.css'],
  standalone: true,
  imports: [RouterModule, NgIf, NgFor]
})
export class Header {
  typologies: ThemeCategoryOption[] = [];
  layouts: ThemeCategoryOption[] = [];
  funnelOptions: ThemeCategoryOption[] = [];
  selectedTypology: ThemeTypology = 'pro';
  selectedLayout: ThemeLayout = 'glass';
  selectedTheme: ThemeKey = 'pro-glass-azure';
  selectedFunnelValue = '';
  currentStep: 'typology' | 'layout' | 'theme' = 'typology';

  constructor(
    public auth: AuthService,
    private themeService: ThemeService
  ) {
    this.typologies = this.themeService.getTypologies();

    const activeTheme = this.themeService.getActiveThemeOption();
    this.selectedTypology = activeTheme.typology;
    this.selectedLayout = activeTheme.layout;
    this.selectedTheme = activeTheme.key;

    this.enterTypologyStep();
  }

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  get canManageStaff(): boolean {
    return this.auth.hasAnyRole('ADMIN');
  }

  get canUseBuilders(): boolean {
    return this.auth.hasAnyRole('ADMIN', 'HEAD_CS');
  }

  get canManageArticles(): boolean {
    return this.auth.hasAnyRole('ADMIN', 'HEAD_CS');
  }

  get currentThemeLabel(): string {
    const theme = this.themeService.getThemeByKey(this.selectedTheme);
    return theme ? theme.label : this.selectedTheme;
  }

  get stepLabel(): string {
    if (this.currentStep === 'typology') return '1. Typology';
    if (this.currentStep === 'layout') return '2. Layout';
    return '3. Color / Variant';
  }

  onFunnelChange(value: string): void {
    this.selectedFunnelValue = value;

    if (this.currentStep === 'typology') {
      this.selectedTypology = value as ThemeTypology;
      this.enterLayoutStep();
      return;
    }

    if (this.currentStep === 'layout') {
      this.selectedLayout = value as ThemeLayout;
      this.enterThemeStep();
      return;
    }

    this.selectedTheme = value as ThemeKey;
    this.themeService.applyTheme(this.selectedTheme);
  }

  goBackStep(): void {
    if (this.currentStep === 'theme') {
      this.enterLayoutStep();
      return;
    }

    if (this.currentStep === 'layout') {
      this.enterTypologyStep();
    }
  }

  resetFunnel(): void {
    this.enterTypologyStep();
  }

  private enterTypologyStep(): void {
    this.currentStep = 'typology';
    this.funnelOptions = this.typologies;
    this.selectedFunnelValue = '';
  }

  private enterLayoutStep(): void {
    this.currentStep = 'layout';
    this.layouts = this.themeService.getLayoutsByTypology(this.selectedTypology);
    this.funnelOptions = this.layouts;
    this.selectedFunnelValue = '';
  }

  private enterThemeStep(): void {
    this.currentStep = 'theme';
    this.funnelOptions = this.themeService
      .getThemesByTypologyAndLayout(this.selectedTypology, this.selectedLayout)
      .map(theme => ({
        key: theme.key,
        label: `${theme.color} - ${theme.label}`
      }));
    this.selectedFunnelValue = '';
  }

  logout(): void {
    this.auth.logout();
  }
}
