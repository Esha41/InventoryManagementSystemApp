import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonComponent } from '@components/button/button.component';
import { DropdownComponent, DropdownOption } from '@components/dropdown/dropdown.component';
import { Cartridge } from '@models/cartridge.model';
import { RequestPurpose } from '../../return-request.state';

@Component({
  selector: 'app-return-details-step',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ButtonComponent, DropdownComponent],
  templateUrl: './return-details-step.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReturnDetailsStepComponent {
  constructor(private readonly translate: TranslateService) {}

  get isArabic(): boolean {
    return (this.translate.currentLang || 'en') === 'ar';
  }

  @Input() requestPurposeId: number | null = null;
  @Input() requestPurposeNotes = '';
  @Input() reason = '';
  @Input() priority = 1;
  @Input() selectedFiles: File[] = [];
  @Input() selectedCartridges: Cartridge[] = [];
  @Input() requestPurposes: RequestPurpose[] = [];
  @Input() priorityOptions: { value: number; labelKey: string }[] = [];
  @Input() isLoadingRequestPurposes = false;
  @Input() isLoading = false;
  @Input() hasAttemptedSubmit = false;
  @Input() hasError!: (field: string) => boolean;
  @Input() getError!: (field: string) => string;
  @Input() requestPurposeOptionLabel!: (option: DropdownOption<RequestPurpose> | RequestPurpose | null) => string;
  @Input() getFileSize!: (file: File) => string;

  @Output() requestPurposeIdChange = new EventEmitter<number | null>();
  @Output() requestPurposeNotesChange = new EventEmitter<string>();
  @Output() reasonChange = new EventEmitter<string>();
  @Output() priorityChange = new EventEmitter<number>();
  @Output() filesSelected = new EventEmitter<Event>();
  @Output() fileRemoved = new EventEmitter<{ index: number; fileInput: HTMLInputElement | null }>();
  @Output() removeItem = new EventEmitter<number>();
  @Output() previous = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();

  fileInputElement: HTMLInputElement | null = null;

  onRemoveCartridge(id: number): void {
    this.removeItem.emit(id);
  }

  onFilesSelected(event: Event): void {
    this.fileInputElement = event.target as HTMLInputElement;
    this.filesSelected.emit(event);
  }

  onRemoveFile(index: number): void {
    this.fileRemoved.emit({ index, fileInput: this.fileInputElement });
  }
}
