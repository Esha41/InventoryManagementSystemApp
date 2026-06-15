export interface CreateUpdateEmployeeDto {
  nameAr?: string;
  nameEn?: string;
  militaryId?: string;
  departmentId?: number;
  rankId?: number;
  phone?: string;
  email?: string;
  notes?: string;
  userId?: string;
}

/**
 * Employee DTO (Custodian)
 */
export interface EmployeeDto {
  id: number;
  userId?: string;
  nameAr?: string;
  nameEn?: string;
  militaryId?: string;
  departmentId?: number;
  phone?: string;
  email?: string;
  notes?: string;
  rankId?: number;
  isDeleted?: boolean;
  department?: { id?: number; nameEn?: string; nameAr?: string; code?: string };
  rank?: { id?: number; nameEn?: string; nameAr?: string };
}
