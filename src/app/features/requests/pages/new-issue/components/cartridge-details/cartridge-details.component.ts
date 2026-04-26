import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Cartridge } from '@models/cartridge.model';
import { AmmunitionService } from '@assets/services/ammunition.service';
import { WeaponService } from '@assets/services/weapon.service';
import { ExplosiveService } from '@assets/services/explosive.service';
import { CartridgeMapperService } from '@assets/services/cartridge-mapper.service';
import { HttpClient } from '@angular/common/http';
import { catchError, switchMap, of } from 'rxjs';

@Component({
  selector: 'app-cartridge-details',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './cartridge-details.component.html',
  styleUrls: ['./cartridge-details.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartridgeDetailsComponent implements OnChanges, OnDestroy {
  @Input() cartridge: Cartridge | null = null;
  @Input() showActions: boolean = true; // Control whether to show action buttons
  @Output() select = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  imageUrl: string | null = null;
  private blobUrls: Set<string> = new Set();

  constructor(
    private ammunitionService: AmmunitionService,
    private weaponService: WeaponService,
    private explosiveService: ExplosiveService,
    private cartridgeMapper: CartridgeMapperService,
    private http: HttpClient
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cartridge'] && this.cartridge?.id) {
      this.loadImage(this.cartridge.id);
    }
  }

  get isWeapon(): boolean {
    return this.cartridgeMapper.isWeapon(this.cartridge);
  }

  get isExplosive(): boolean {
    return this.cartridgeMapper.isExplosive(this.cartridge);
  }

  get isAmmunition(): boolean {
    return this.cartridgeMapper.isAmmunition(this.cartridge);
  }

  ngOnDestroy(): void {
    // Clean up all blob URLs to prevent memory leaks
    this.blobUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('Error revoking blob URL:', e);
      }
    });
    this.blobUrls.clear();
  }

  private loadImage(itemId: number): void {
    // Clean up previous image URL
    if (this.imageUrl) {
      try {
        URL.revokeObjectURL(this.imageUrl);
        this.blobUrls.delete(this.imageUrl);
      } catch (e) {
        console.warn('Error revoking previous image blob URL:', e);
      }
    }
    this.imageUrl = null;

    // Determine which service to use based on cartridge type
    let imageUrl$;
    if (this.isWeapon) {
      imageUrl$ = this.weaponService.getImageUrl(itemId);
    } else if (this.isExplosive) {
      imageUrl$ = this.explosiveService.getImageUrl(itemId);
    } else {
      imageUrl$ = this.ammunitionService.getImageUrl(itemId);
    }

    // Fetch image URL
    imageUrl$.pipe(
      switchMap((imageUrl) => {
        if (imageUrl) {
          // Fetch image as blob with authentication
          return this.http.get(imageUrl, { responseType: 'blob' }).pipe(
            switchMap((blob) => {
              if (blob.type && blob.type.startsWith('image/')) {
                const blobUrl = URL.createObjectURL(blob);
                this.blobUrls.add(blobUrl);
                this.imageUrl = blobUrl;
              }
              return of(null);
            }),
            catchError((err) => {
              console.warn('Failed to load image blob:', err);
              return of(null);
            })
          );
        }
        return of(null);
      }),
      catchError((err) => {
        console.warn('Failed to get image URL:', err);
        return of(null);
      })
    ).subscribe();
  }

  onSelect(): void {
    this.select.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}

