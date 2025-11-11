/**
 * Warehouse-related models and interfaces
 */

export interface WarehouseDto {
  id: string;
  name: string;
  code: string;
  location: string;
  description?: string;
  neqPercentage: number;
  consumedPercentage: number;
  totalCapacity: number;
  currentStock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WarehouseSummaryDto {
  id: string;
  name: string;
  code: string;
  neqPercentage: number;
  consumedPercentage: number;
  totalCapacity: number;
  currentStock: number;
}

export interface CreateWarehouseDto {
  name: string;
  code: string;
  location: string;
  description?: string;
  totalCapacity: number;
}

export interface UpdateWarehouseDto {
  name?: string;
  code?: string;
  location?: string;
  description?: string;
  totalCapacity?: number;
  isActive?: boolean;
}

export interface WarehouseLocationDto {
  id: string;
  name: string;
  code: string;
  location: string;
  latitude: number;
  longitude: number;
  color: 'green' | 'orange' | 'red';
  isActive: boolean;
}