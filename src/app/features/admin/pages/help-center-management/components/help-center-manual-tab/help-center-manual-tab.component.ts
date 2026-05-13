import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule, Trash2, Upload, FileText } from 'lucide-angular';
import { Subject, of, takeUntil } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { FileUploadDto } from '@models/file-upload.model';
import {
  HELPCENTER_USER_MANUAL_ENTITY,
  HELPCENTER_USER_MANUAL_ENTITY_ID
} from '@constants/help-center-manual.constants';
import { FileUploadService } from '@services/file-upload.service';
import { ToastService } from '@services/toast.service';
import { TranslationService } from '@services/translation.service';
import { PERMISSIONS } from '@constants/permissions.constants';
import { BackendAuthService } from '@services/backend-auth.service';
import { ErrorHandler } from '@utils/error-handler.utils';
import { ConfirmDialogComponent } from '@components/confirm-dialog/confirm-dialog.component';
import { ButtonComponent } from '@components/button/button.component';
import { CardComponent } from '@components/card/card.component';
import { validateAttachments, showAttachmentValidationToast } from '@utils/file.utils';

@Component({
  selector: 'app-help-center-manual-tab',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    LucideAngularModule,
    ConfirmDialogComponent,
    ButtonComponent,
    CardComponent
  ],
  templateUrl: './help-center-manual-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpCenterManualTabComponent implements OnInit, OnDestroy {
  private readonly fileUpload = inject(FileUploadService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslationService);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(BackendAuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  readonly Trash2 = Trash2;
  readonly Upload = Upload;
  readonly FileText = FileText;

  readonly entity = HELPCENTER_USER_MANUAL_ENTITY;
  readonly entityId = HELPCENTER_USER_MANUAL_ENTITY_ID;

  files: FileUploadDto[] = [];
  loading = false;
  uploading = false;
  showDeleteDialog = false;
  fileToDelete: FileUploadDto | null = null;

  ngOnInit(): void {
    this.loadFiles();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  canEdit(): boolean {
    return this.auth.hasPermission(PERMISSIONS.ADMIN.HELP_CENTER.EDIT);
  }

  canDelete(): boolean {
    return this.auth.hasPermission(PERMISSIONS.ADMIN.HELP_CENTER.DELETE);
  }

  loadFiles(): void {
    this.loading = true;
    this.fileUpload
      .getFilesByEntity(this.entity, this.entityId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.manualLoadError'));
          return of([] as FileUploadDto[]);
        }),
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe(list => {
        this.files = [...list].sort((a, b) =>
          (a.originalName || a.fileName || '').localeCompare(b.originalName || b.fileName || '', undefined, {
            sensitivity: 'base'
          })
        );
        this.cdr.markForCheck();
      });
  }

  triggerFilePick(): void {
    this.fileInput?.nativeElement?.click();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.files;
    if (!raw?.length || !this.canEdit()) {
      input.value = '';
      return;
    }
    const selected = Array.from(raw);
    const check = validateAttachments(selected);
    if (!check.valid) {
      showAttachmentValidationToast(this.translate, this.toast, check.errorMessage);
      input.value = '';
      this.cdr.markForCheck();
      return;
    }
    this.uploading = true;
    this.cdr.markForCheck();
    this.fileUpload
      .uploadFilesForEntity(selected, this.entity, this.entityId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.manualUploadError'));
          return of([] as number[]);
        }),
        finalize(() => {
          this.uploading = false;
          input.value = '';
          this.cdr.markForCheck();
        })
      )
      .subscribe(() => {
        this.toast.success(this.i18n.getTranslation('helpCenter.manualUploadSuccess'));
        this.loadFiles();
      });
  }

  confirmDelete(f: FileUploadDto): void {
    this.fileToDelete = f;
    this.showDeleteDialog = true;
    this.cdr.markForCheck();
  }

  onDeleteConfirm(): void {
    const f = this.fileToDelete;
    this.showDeleteDialog = false;
    this.fileToDelete = null;
    if (!f) return;
    this.fileUpload
      .deleteFile(f.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success(this.i18n.getTranslation('helpCenter.manualDeleteSuccess'));
          this.loadFiles();
          this.cdr.markForCheck();
        },
        error: err => {
          this.toast.error(ErrorHandler.extractErrorMessage(err, 'helpCenter.manualDeleteError'));
          this.cdr.markForCheck();
        }
      });
  }

  onDeleteCancel(): void {
    this.showDeleteDialog = false;
    this.fileToDelete = null;
    this.cdr.markForCheck();
  }
}
