import { ChangeDetectorRef, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { Subscription } from 'rxjs';
import { I18nService } from '../services/i18n';

@Pipe({
  name: 't',
  standalone: true,
  pure: false
})
export class I18nPipe implements PipeTransform, OnDestroy {
  private readonly languageSub: Subscription;

  constructor(
    private i18n: I18nService,
    private cdr: ChangeDetectorRef
  ) {
    this.languageSub = this.i18n.language$.subscribe(() => this.cdr.markForCheck());
  }

  transform(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  ngOnDestroy(): void {
    this.languageSub.unsubscribe();
  }
}
