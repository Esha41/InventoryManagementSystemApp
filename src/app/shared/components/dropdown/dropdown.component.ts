import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
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
import { LucideAngularModule, ChevronDown } from 'lucide-angular';
import { TranslateService } from '@ngx-translate/core';

type Primitive = string | number | boolean | null | undefined;

export interface DropdownOption<T = Primitive> {
  label: string;
  value: T;
  disabled?: boolean;
  description?: string;
}

@Component({
  selector: 'app-dropdown',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
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
  implements ControlValueAccessor, Validator {
  readonly ChevronDown = ChevronDown;

  /**
   * Collection of options to display. Accepts an array of primitives or objects.
   */
  @Input() options: Array<DropdownOption<T> | T> = [];

  /**
   * Optional key used to read the display label from complex option objects.
   * Falls back to `label` property or stringified value.
   */
  @Input() optionLabel?: string;

  /**
   * Custom function that returns the display label for a given option.
   * Overrides optionLabel/property-based resolution when provided.
   */
  @Input() optionLabelFn?: (option: DropdownOption<T> | T) => string;

  /**
   * Optional key used to read the value from complex option objects.
   * Falls back to `value` property or the option itself.
   */
  @Input() optionValue?: string;

  /**
   * Placeholder text shown when no value is selected.
   */
  @Input() placeholder = 'Select';

  /**
   * When true, renders the placeholder as a selectable option at the top of the list.
   */
  @Input() placeholderSelectable = false;

  /**
   * Value emitted when the placeholder option is chosen.
   */
  @Input() placeholderValue: T | null = null;

  /**
   * Disables user interactions.
   */
  @Input() disabled = false;

  /**
   * Message shown when no options are available.
   */
  @Input() noDataText = 'No options available';

  /**
   * Additional class(es) applied to the dropdown panel element.
   */
  @Input() panelClass = '';

  /**
   * When true, option labels are treated as translation keys.
   */
  @Input() translateLabels = false;

  /**
   * Marks the control as required for template-driven forms.
   */
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

  /**
   * Custom tracking function to optimise ngFor rendering.
   */
  @Input() trackByFn?: (option: DropdownOption<T> | T, index: number) => any;

  /**
   * When true, renders the trigger in an error state.
   */
  @Input() error = false;

  /**
   * Optional name attribute support for template-driven forms.
   */
  @Input() name: string | null = null;

  /**
   * Emits whenever the component opens or closes.
   */
  @Output() openedChange = new EventEmitter<boolean>();

  /**
   * Emits the value of the newly selected option.
   */
  @Output() selectionChange = new EventEmitter<T | null>();

  isOpen = false;
  hoveredIndex: number | null = null;

  private innerValue: T | null = null;
  private _required = false;
  private onChange: (value: T | null) => void = () => {};
  private onTouched: () => void = () => {};
  private onValidatorChange: () => void = () => {};

  @HostBinding('attr.name')
  get attrName(): string | null {
    return this.name;
  }

  constructor(
    private host: ElementRef<HTMLElement>,
    @Optional() private translate?: TranslateService
  ) {}

  /**
   * Computed list of options optionally prepending the placeholder option.
   */
  get computedOptions(): Array<DropdownOption<T> | T> {
    const baseOptions = this.options ?? [];
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

  /**
   * Indicates whether a non-null/undefined value is currently selected.
   */
  get hasSelection(): boolean {
    return this.innerValue !== null && this.innerValue !== undefined;
  }

  /**
   * Returns the label to display within the trigger button.
   */
  get displayLabel(): string {
    if (!this.hasSelection) {
      return this.placeholder;
    }

    const option = this.findOptionByValue(this.innerValue);
    if (!option) {
      return this.formatLabel(this.innerValue);
    }

    return this.getOptionLabel(option);
  }

  writeValue(value: T | null): void {
    this.innerValue = value;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  validate(_: AbstractControl): ValidationErrors | null {
    if (!this._required) {
      return null;
    }

    const hasValue = this.innerValue !== null && this.innerValue !== undefined && this.innerValue !== '';
    return hasValue ? null : { required: true };
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  toggleDropdown(): void {
    if (this.disabled) {
      return;
    }

    this.isOpen = !this.isOpen;
    this.openedChange.emit(this.isOpen);
  }

  open(): void {
    if (this.disabled || this.isOpen) {
      return;
    }
    this.isOpen = true;
    this.openedChange.emit(true);
  }

  close(): void {
    if (!this.isOpen) {
      return;
    }
    this.isOpen = false;
    this.hoveredIndex = null;
    this.openedChange.emit(false);
  }

  selectOption(option: DropdownOption<T> | T): void {
    if (this.isOptionDisabled(option)) {
      return;
    }

    const value = this.getOptionValue(option);
    this.innerValue = value;
    this.onChange(this.innerValue);
    this.onTouched();
    this.selectionChange.emit(this.innerValue);
    this.close();
  }

  isSelected(option: DropdownOption<T> | T): boolean {
    const optionValue = this.getOptionValue(option);
    return optionValue === this.innerValue;
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

    if (
      this.optionLabel &&
      option &&
      typeof option === 'object' &&
      !Array.isArray(option)
    ) {
      const label = (option as any)[this.optionLabel];
      return this.formatLabel(label);
    }

    if (option && typeof option === 'object' && 'label' in option) {
      const label = (option as any).label;
      return this.formatLabel(label);
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
      return (option as any)[this.optionValue];
    }

    if (option && typeof option === 'object' && 'value' in option) {
      return (option as any).value;
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

  trackOption = (index: number, option: DropdownOption<T> | T): any => {
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
}

