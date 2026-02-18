export interface DepotDto {
  id: number;
  nameAr: string;
  nameEn: string;
  code: string;
  Code: string;
  location: string;
  latitude: number;
  longitude: number;
  isDeleted: boolean;
}

/** User assigned to a depot (from GET /Depot/{id}/users) */
export interface DepotUserDto {
  id: string;
  userName: string;
  fullNameEn?: string;
  fullNameAr?: string;
}

