import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  Optional,
  Output,
  forwardRef
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator
} from '@angular/forms';
import { LucideAngularModule, ChevronDown, Search } from 'lucide-angular';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { TranslationService } from '@services/translation.service';

type Primitive = string | number | boolean | null | undefined;

const PANEL_GAP_PX = 8;
const VIEWPORT_PAD_PX = 10;

function overflowYClipsVertically(overflowY: string): boolean {
  return overflowY === 'hidden' || overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'clip';
}

export interface DropdownOption<T = Primitive> {
  label: string;
  value: T;
  disabled?: boolean;
  description?: string;
}

@Component({
  selector: 'app-dropdown',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule],
  templateUrl: './dropdown.component.html',
  styleUrls: ['./dropdown.component.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DropdownComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => DropdownComponent),
      multi: true
    }
  ]
})
export class DropdownComponent<T = Primitive>
  implements ControlValueAccessor, Validator, OnDestroy {
  readonly ChevronDown = ChevronDown;
  readonly Search = Search;

  @Input() options: Array<DropdownOption<T> | T> = [];
  @Input() optionLabel?: string;
  @Input() optionLabelFn?: (option: DropdownOption<T> | T) => string;
  @Input() optionValue?: string;
  @Input() placeholder = 'Select';
  @Input() placeholderSelectable = false;
  @Input() placeholderValue: T | null = null;
  @Input() disabled = false;
  @Input() multiple = false;
  @Input() noDataText = 'No options available';
  @Input() panelClass = '';
  @Input() translateLabels = false;
  @Input() showSearch = true;

  @Input()
  set required(value: boolean | string) {
    const coerced =
      value === '' || value === true || value === 'true' || value === 'required';
    if (coerced !== this._required) {
      this._required = coerced;
      this.onValidatorChange();
    }
  }
  get required(): boolean {
    return this._required;
  }

  @Input() trackByFn?: (option: DropdownOption<T> | T, index: number) => unknown;
  @Input() error = false;
  @Input() name: string | null = null;
  @Input() addActionLabel?: string;
  /** When true with {@link multiple}, render the trigger as compact chips (first 3) plus overflow via {@link badgeOverflowTranslateKey}. */
  @Input() multiTriggerBadges = false;
  /** ngx-translate key with param `count` for remaining selections after the first 3 labels (e.g. inventoryDashboard.filter.depotsMore). */
  @Input() badgeOverflowTranslateKey?: string;
  /** When set and selection count >= this value, show one summary chip instead of many badges (large multi-selects). */
  @Input() multiBadgeCollapseAt: number | null = null;
  /** Translate key with `{ count }` when collapsed and not all options are selected. */
  @Input() multiBadgeCollapsedTranslateKey?: string;
  /** Translate key with `{ count }` when collapsed and every option is selected (e.g. all depots). */
  @Input() multiBadgeCollapsedAllTranslateKey?: string;

  @Output() openedChange = new EventEmitter<boolean>();
  @Output() selectionChange = new EventEmitter<T | null | T[]>();
  @Output() addActionClick = new EventEmitter<void>();

  isOpen = false;
  hoveredIndex: number | null = null;
  searchTerm = '';

  private innerValue: T | null | T[] = null;
  private _required = false;
  private onChange: (value: T | null | T[]) => void = () => { };
  private onTouched: () => void = () => { };
  private onValidatorChange: () => void = () => { };

  private appMainEl: HTMLElement | null = null;
  private openMainScrollTop: number | null = null;
  private static readonly mainScrollJitterThresholdPx = 4;

  private getAppMain(): HTMLElement | null {
    if (!this.appMainEl || !this.appMainEl.isConnected) {
      this.appMainEl = document.querySelector('main[data-onboarding="main-content"]');
    }
    return this.appMainEl;
  }

  private syncOpenMainScrollTop(): void {
    if (!this.isOpen) {
      return;
    }
    const main = this.getAppMain();
    this.openMainScrollTop = main != null ? main.scrollTop : null;
  }

  private scrollHandler = (event: Event): void => {
    if (!this.isOpen) {
      return;
    }
    const target = event.target as Node;
    if (this.host.nativeElement.contains(target)) {
      return;
    }
    const main = this.getAppMain();
    if (main && target === main) {
      if (this.openMainScrollTop === null) {
        this.syncOpenMainScrollTop();
        return;
      }
      if (Math.abs(main.scrollTop - this.openMainScrollTop) <= DropdownComponent.mainScrollJitterThresholdPx) {
        return;
      }
    }
    this.close();
    this.onTouched();
  };

  @HostBinding('attr.name')
  get attrName(): string | null {
    return this.name;
  }

  constructor(
    private host: ElementRef<HTMLElement>,
    @Optional() private translate?: TranslateService,
    @Optional() private translationService?: TranslationService
  ) { }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.scrollHandler, { capture: true });
  }

  get isRTL(): boolean {
    return this.translationService?.isRTL() ?? false;
  }

  get computedOptions(): Array<DropdownOption<T> | T> {
    let baseOptions = this.options ?? [];

    // Apply search filter
    if (this.searchTerm && this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase().trim();
      baseOptions = baseOptions.filter(option => {
        const label = this.getOptionLabel(option).toLowerCase();
        return label.includes(searchLower);
      });
    }

    if (this.placeholderSelectable) {
      const placeholderOption: DropdownOption<T> = {
        label: this.placeholder,
        value: this.placeholderValue as T,
        disabled: false
      };
      return [placeholderOption, ...baseOptions];
    }
    return baseOptions;
  }

  get hasSelection(): boolean {
    if (this.multiple) {
      return Array.isArray(this.innerValue) && this.innerValue.length > 0;
    }
    return this.innerValue !== null && this.innerValue !== undefined && this.innerValue !== '';
  }

  /** Resolved labels for selected values (multiple mode), for badge-style triggers. */
  get selectedLabelsForBadges(): string[] {
    if (!this.multiple || !Array.isArray(this.innerValue) || this.innerValue.length === 0) {
      return [];
    }
    return this.innerValue
      .map(value => {
        const option = this.findOptionByValue(value);
        return option ? this.getOptionLabel(option) : this.formatLabel(value);
      })
      .filter(label => label && String(label).trim() !== '');
  }

  get badgeOverflowCount(): number {
    const n = this.selectedLabelsForBadges.length;
    return n > 3 ? n - 3 : 0;
  }

  /** Single-line summary instead of per-depot chips when selection count is large. */
  get multiBadgeUseCollapsedSummary(): boolean {
    const min = this.multiBadgeCollapseAt;
    return !!(
      this.multiTriggerBadges &&
      this.multiple &&
      this.hasSelection &&
      min != null &&
      this.selectedLabelsForBadges.length >= min
    );
  }

  get multiBadgeCollapsedSummaryKey(): string | undefined {
    const n = this.selectedLabelsForBadges.length;
    const total = (this.options ?? []).length;
    if (
      this.multiBadgeCollapsedAllTranslateKey &&
      total > 0 &&
      n === total &&
      n > 0
    ) {
      return this.multiBadgeCollapsedAllTranslateKey;
    }
    return this.multiBadgeCollapsedTranslateKey;
  }

  get displayLabel(): string {
    if (!this.hasSelection) {
      return this.placeholder;
    }

    if (this.multiple && Array.isArray(this.innerValue)) {
      if (this.innerValue.length === 0) {
        return this.placeholder;
      }

      // Get labels for all selected options
      const selectedLabels = this.innerValue
        .map(value => {
          const option = this.findOptionByValue(value);
          return option ? this.getOptionLabel(option) : this.formatLabel(value);
        })
        .filter(label => label && label.trim() !== '');

      if (selectedLabels.length === 0) {
        return this.placeholder;
      }

      if (selectedLabels.length <= 3) {
        return selectedLabels.join(', ');
      }
      return `${selectedLabels.slice(0, 3).join(', ')} +${selectedLabels.length - 3} more`;
    }

    const option = this.findOptionByValue(this.innerValue as T);
    if (!option) {
      return this.formatLabel(this.innerValue);
    }

    return this.getOptionLabel(option);
  }

  writeValue(value: T | null | T[]): void {
    if (this.multiple) {
      this.innerValue = Array.isArray(value) ? value : (value !== null && value !== undefined ? [value] : []);
    } else {
      this.innerValue = value as T | null;
    }
  }

  registerOnChange(fn: (value: T | null | T[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  validate(_: AbstractControl): ValidationErrors | null {
    if (!this._required) {
      return null;
    }

    if (this.multiple) {
      const hasValue = Array.isArray(this.innerValue) && this.innerValue.length > 0;
      return hasValue ? null : { required: true };
    }

    const hasValue = this.innerValue !== null && this.innerValue !== undefined && this.innerValue !== '';
    return hasValue ? null : { required: true };
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  /** Prevents the browser from focusing the trigger in a way that scrolls the app `main` (jostles the whole page, especially filters above a footer control). */
  onTriggerMouseDown(event: MouseEvent): void {
    if (this.disabled || event.button !== 0) {
      return;
    }
    event.preventDefault();
  }

  private ensureTriggerFocusNoScroll(): void {
    requestAnimationFrame(() => {
      const btn = this.host.nativeElement.querySelector(
        '.app-dropdown-trigger'
      ) as HTMLButtonElement | null;
      btn?.focus({ preventScroll: true });
    });
  }

  toggleDropdown(): void {
    if (this.disabled) {
      return;
    }

    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.syncOpenMainScrollTop();
      setTimeout(() => this.adjustPanelPosition(), 0);
      document.addEventListener('scroll', this.scrollHandler, { passive: true, capture: true });
    } else {
      this.openMainScrollTop = null;
      document.removeEventListener('scroll', this.scrollHandler, { capture: true });
    }
    this.openedChange.emit(this.isOpen);
    this.ensureTriggerFocusNoScroll();
  }

  open(): void {
    if (this.disabled || this.isOpen) {
      return;
    }
    this.isOpen = true;
    this.searchTerm = '';
    this.syncOpenMainScrollTop();
    setTimeout(() => this.adjustPanelPosition(), 0);
    document.addEventListener('scroll', this.scrollHandler, { passive: true, capture: true });
    this.openedChange.emit(true);
    this.ensureTriggerFocusNoScroll();
  }

  private adjustPanelPosition(): void {
    const panel = this.host.nativeElement.querySelector('.app-dropdown-panel') as HTMLElement;
    const trigger = this.host.nativeElement.querySelector('.app-dropdown-trigger') as HTMLElement;
    if (!panel || !trigger) {
      return;
    }

    if (!this.isInsideVerticallyClippingScroller(trigger)) {
      this.positionPanelAnchored(panel);
      this.syncOpenMainScrollTop();
      return;
    }

    const rect = trigger.getBoundingClientRect();
    this.positionPanelFixedToTrigger(panel, rect);
    requestAnimationFrame(() => {
      this.clampFixedPanelVertically(panel, rect);
      this.syncOpenMainScrollTop();
    });
  }

  /** Normal case: panel under trigger, CSS handles width. */
  private positionPanelAnchored(panel: HTMLElement): void {
    panel.style.cssText =
      'position:absolute;top:calc(100% + 0.5rem);bottom:auto;left:0;right:0;z-index:99999';
  }

  /** Escape overflow:hidden ancestors (e.g. table scroll regions). */
  private positionPanelFixedToTrigger(panel: HTMLElement, rect: DOMRect): void {
    const w = `${rect.width}px`;
    if (this.isRTL) {
      panel.style.cssText =
        `position:fixed;top:${rect.bottom + PANEL_GAP_PX}px;bottom:auto;left:auto;right:${window.innerWidth - rect.right}px;` +
        `width:${w};min-width:${w};max-width:;z-index:99999`;
    } else {
      panel.style.cssText =
        `position:fixed;top:${rect.bottom + PANEL_GAP_PX}px;bottom:auto;left:${rect.left}px;right:auto;` +
        `width:${w};min-width:${w};max-width:;z-index:99999`;
    }
  }

  private clampFixedPanelVertically(panel: HTMLElement, triggerRect: DOMRect): void {
    if (!panel.isConnected) {
      return;
    }
    const panelRect = panel.getBoundingClientRect();
    const list = panel.querySelector('.app-dropdown-list') as HTMLElement;
    const spaceBelow =
      window.innerHeight - triggerRect.bottom - PANEL_GAP_PX - VIEWPORT_PAD_PX;
    const spaceAbove = triggerRect.top - PANEL_GAP_PX - VIEWPORT_PAD_PX;
    const listRect = list?.getBoundingClientRect();
    const chromeHeight = listRect ? panelRect.height - listRect.height : 0;

    if (panelRect.bottom <= window.innerHeight - VIEWPORT_PAD_PX) {
      this.syncOpenMainScrollTop();
      return;
    }

    if (spaceAbove > spaceBelow && spaceAbove > 100) {
      panel.style.top = 'auto';
      panel.style.bottom = `${window.innerHeight - triggerRect.top + PANEL_GAP_PX}px`;
      if (list) {
        const maxH = spaceAbove - chromeHeight;
        if (maxH < 240) {
          list.style.maxHeight = `${Math.max(maxH, 80)}px`;
        }
      }
    } else if (list) {
      list.style.maxHeight = `${Math.max(spaceBelow - chromeHeight, 80)}px`;
    }
  }

  private isInsideVerticallyClippingScroller(from: HTMLElement): boolean {
    for (let el = from.parentElement; el && el !== document.body; el = el.parentElement) {
      if (overflowYClipsVertically(getComputedStyle(el).overflowY)) {
        return true;
      }
    }
    return false;
  }

  /** Close the panel from parent components (e.g. after confirming a multi-select). */
  closePanel(): void {
    this.close();
  }

  close(): void {
    if (!this.isOpen) {
      return;
    }
    this.isOpen = false;
    this.hoveredIndex = null;
    this.searchTerm = '';
    this.openMainScrollTop = null;
    document.removeEventListener('scroll', this.scrollHandler, { capture: true });

    const panel = this.host.nativeElement.querySelector('.app-dropdown-panel') as HTMLElement;
    if (panel) {
      panel.style.cssText = '';
      const list = panel.querySelector('.app-dropdown-list') as HTMLElement;
      if (list) {
        list.style.maxHeight = '';
      }
    }

    this.openedChange.emit(false);
  }

  onSearchChange(event: Event): void {
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value;
  }

  onSearchClick(event: Event): void {
    event.stopPropagation();
  }

  selectOption(option: DropdownOption<T> | T): void {
    if (this.isOptionDisabled(option)) {
      return;
    }

    const value = this.getOptionValue(option);

    // Handle placeholder option (value may be undefined when optionValue is set but placeholder has no such prop)
    const isPlaceholderSelection =
      this.placeholderSelectable &&
      (value === this.placeholderValue ||
        (this.placeholderValue == null && (value === undefined || value === null)));
    if (isPlaceholderSelection) {
      if (this.multiple) {
        this.innerValue = [] as T[];
      } else {
        this.innerValue = null;
      }
      this.onChange(this.innerValue);
      this.selectionChange.emit(this.innerValue);
      this.close();
      this.onTouched();
      return;
    }

    if (this.multiple) {
      const currentValues = Array.isArray(this.innerValue) ? [...this.innerValue] : [];
      const index = currentValues.findIndex(v => v === value);

      if (index > -1) {
        // Remove if already selected
        currentValues.splice(index, 1);
      } else {
        // Add if not selected
        currentValues.push(value);
      }

      this.innerValue = currentValues as T[];
      this.onChange(this.innerValue);
      this.selectionChange.emit(this.innerValue);
      // Don't close dropdown in multiple mode
    } else {
      this.innerValue = value;
      this.onChange(this.innerValue);
      this.selectionChange.emit(this.innerValue);
      this.close();
    }

    this.onTouched();
  }

  isSelected(option: DropdownOption<T> | T): boolean {
    const optionValue = this.getOptionValue(option);

    if (this.multiple) {
      if (!Array.isArray(this.innerValue) || this.innerValue.length === 0) {
        return false;
      }
      return this.innerValue.some(val => this.samePrimitive(val, optionValue));
    }
    return this.samePrimitive(this.innerValue, optionValue);
  }

  private samePrimitive(a: unknown, b: unknown): boolean {
    if (a === b) {
      return true;
    }
    if (typeof a === 'number' && typeof b === 'string') {
      return a === Number(b);
    }
    if (typeof a === 'string' && typeof b === 'number') {
      return Number(a) === b;
    }
    return false;
  }

  isOptionDisabled(option: DropdownOption<T> | T): boolean {
    if (option && typeof option === 'object' && 'disabled' in option) {
      return !!option.disabled;
    }
    return false;
  }

  getOptionLabel(option: DropdownOption<T> | T): string {
    if (this.optionLabelFn) {
      const computed = this.optionLabelFn(option);
      if (computed !== undefined && computed !== null && String(computed).trim() !== '') {
        return this.formatLabel(computed);
      }
    }

    if (option && typeof option === 'object' && !Array.isArray(option)) {
      if ('label' in option) {
        const label = (option as { label?: unknown }).label;
        if (label !== undefined && label !== null) {
          return this.formatLabel(label);
        }
      }
      if (this.optionLabel) {
        return this.formatLabel((option as Record<string, unknown>)[this.optionLabel]);
      }
    }

    if (typeof option === 'string' || typeof option === 'number') {
      return this.formatLabel(option);
    }
    if (typeof option === 'boolean') {
      return this.formatLabel(option ? 'Yes' : 'No');
    }
    return this.formatLabel('');
  }

  getOptionValue(option: DropdownOption<T> | T): T {
    if (
      this.optionValue &&
      option &&
      typeof option === 'object' &&
      !Array.isArray(option)
    ) {
      const raw = (option as Record<string, unknown>)[this.optionValue];
      return raw as T;
    }

    if (option && typeof option === 'object' && 'value' in option) {
      return (option as DropdownOption<T>).value;
    }

    return option as T;
  }

  findOptionByValue(value: T | null): DropdownOption<T> | T | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    return this.options?.find((option, index) => {
      const optionValue = this.getOptionValue(option);
      if (this.trackByFn) {
        return this.trackByFn(option, index) === value;
      }
      return optionValue === value;
    });
  }

  trackOption = (index: number, option: DropdownOption<T> | T): unknown => {
    if (this.trackByFn) {
      return this.trackByFn(option, index);
    }
    const value = this.getOptionValue(option);
    return value !== undefined ? value : index;
  };

  private formatLabel(raw: unknown): string {
    if (raw === null || raw === undefined) {
      return '';
    }

    let label =
      typeof raw === 'string'
        ? raw
        : typeof raw === 'number'
          ? String(raw)
          : String(raw ?? '');

    if (this.translateLabels && this.translate) {
      label = this.translate.instant(label);
    }

    return label;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) {
      return;
    }

    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
      this.onTouched();
    }
  }

  onTriggerBlur(): void {
    this.onTouched();
  }

  onAddActionClick(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.addActionClick.emit();
    this.close();
  }
}

