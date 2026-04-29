import { Cartridge } from '@models/cartridge.model';
import { Asset } from '@models/asset-list.model';
import { AmmunitionReadDto } from '@models/ammunition.model';
import { WeaponDto } from '@models/weapon.model';
import { ExplosiveDto } from '@models/explosive.model';
import { InventoryDetailDto } from '@models/inventory.model';

export type ItemDetailsData =
  | Cartridge
  | Asset
  | AmmunitionReadDto
  | WeaponDto
  | ExplosiveDto
  | InventoryDetailDto
  | null;

export type ItemTypeHint = 'ammunition' | 'weapon' | 'explosive';
