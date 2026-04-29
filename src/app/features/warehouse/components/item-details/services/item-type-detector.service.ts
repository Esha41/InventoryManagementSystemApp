import { Injectable } from '@angular/core';
import { Cartridge } from '@models/cartridge.model';
import { InventoryDetailDto } from '@models/inventory.model';
import { CartridgeMapperService } from '@assets/services/cartridge-mapper.service';
import { ItemDetailsData, ItemTypeHint } from '../models/item-details-types';
import { ItemDetailsResolvedContext } from '../models/item-details-resolved-context';

interface HasId {
  id: number;
}

interface HasItemId {
  itemId: number;
}

interface HasStringItemType {
  itemType: string;
}

@Injectable()
export class ItemTypeDetectorService {
  constructor(private cartridgeMapper: CartridgeMapperService) {}

  detect(item: ItemDetailsData, itemTypeHint?: ItemTypeHint): ItemDetailsResolvedContext | null {
    if (item === null) {
      return null;
    }
    const isInventoryDetail = 'itemId' in item && typeof (item as InventoryDetailDto).itemId === 'number';
    const isCartridge =
      !isInventoryDetail && 'itemType' in item && typeof (item as Cartridge).itemType === 'string';
    const isAsset = !isInventoryDetail && !isCartridge && 'originalData' in item;
    const isDirectDto = this.computeIsDirectDto(item, isInventoryDetail, isCartridge);

    const isWeapon = this.computeIsWeapon(item, itemTypeHint, isInventoryDetail, isDirectDto);
    const isExplosive = this.computeIsExplosive(item, itemTypeHint, isInventoryDetail, isDirectDto);
    const isAmmunition = this.computeIsAmmunition(item, itemTypeHint, isInventoryDetail, isDirectDto);

    return {
      item,
      itemTypeHint,
      isInventoryDetail,
      isCartridge,
      isAsset,
      isDirectDto,
      isAmmunition,
      isWeapon,
      isExplosive
    };
  }

  /**
   * Mirrors legacy ItemDetailsComponent.getItemId ordering (inventory `id` wins over `itemId`).
   */
  getItemId(item: ItemDetailsData, ctx: ItemDetailsResolvedContext | null): number | null {
    if (!item) {
      return null;
    }
    if (this.hasId(item)) {
      return item.id;
    }
    if (this.hasItemId(item)) {
      return item.itemId;
    }
    if (ctx?.isDirectDto && this.hasId(item)) {
      return item.id;
    }
    return null;
  }

  private computeIsDirectDto(
    item: Exclude<ItemDetailsData, null>,
    _isInventoryDetail: boolean,
    _isCartridge: boolean
  ): boolean {
    const hasTypeProperty =
      'armNumber' in item || 'caliber' in item || 'explosiveType' in item;
    const notWrapped = !('originalData' in item);
    const notInventory = !('itemId' in item);
    const notCartridge = !this.hasStringItemType(item);
    return hasTypeProperty && notWrapped && notInventory && notCartridge;
  }

  private computeIsWeapon(
    item: Exclude<ItemDetailsData, null>,
    itemTypeHint: ItemTypeHint | undefined,
    isInventoryDetail: boolean,
    isDirectDto: boolean
  ): boolean {
    if (itemTypeHint === 'weapon') {
      return true;
    }
    if (isInventoryDetail) {
      const inv = item as InventoryDetailDto;
      return inv.item?.itemType === 2;
    }
    if (
      isDirectDto &&
      'caliber' in item &&
      !('armNumber' in item) &&
      !('explosiveType' in item)
    ) {
      return true;
    }
    return this.cartridgeMapper.isWeapon(item as Cartridge);
  }

  private computeIsExplosive(
    item: Exclude<ItemDetailsData, null>,
    itemTypeHint: ItemTypeHint | undefined,
    isInventoryDetail: boolean,
    isDirectDto: boolean
  ): boolean {
    if (itemTypeHint === 'explosive') {
      return true;
    }
    if (isInventoryDetail) {
      const inv = item as InventoryDetailDto;
      return inv.item?.itemType === 3;
    }
    if (isDirectDto && 'explosiveType' in item) {
      return true;
    }
    return this.cartridgeMapper.isExplosive(item as Cartridge);
  }

  private computeIsAmmunition(
    item: Exclude<ItemDetailsData, null>,
    itemTypeHint: ItemTypeHint | undefined,
    isInventoryDetail: boolean,
    isDirectDto: boolean
  ): boolean {
    if (itemTypeHint === 'ammunition') {
      return true;
    }
    if (isInventoryDetail) {
      const inv = item as InventoryDetailDto;
      return inv.item?.itemType === 1;
    }
    if (isDirectDto && 'armNumber' in item) {
      return true;
    }
    return this.cartridgeMapper.isAmmunition(item as Cartridge);
  }

  private hasId(item: Exclude<ItemDetailsData, null>): item is Exclude<ItemDetailsData, null> & HasId {
    return 'id' in item && typeof item.id === 'number';
  }

  private hasItemId(item: Exclude<ItemDetailsData, null>): item is Exclude<ItemDetailsData, null> & HasItemId {
    return 'itemId' in item && typeof item.itemId === 'number';
  }

  private hasStringItemType(
    item: Exclude<ItemDetailsData, null>
  ): item is Exclude<ItemDetailsData, null> & HasStringItemType {
    return 'itemType' in item && typeof item.itemType === 'string';
  }
}
