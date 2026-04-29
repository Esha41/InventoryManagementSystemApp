
import { BackendUserDto, RawUserApiResponse, RawRoleApiResponse, RoleDto } from '@models/backend-user.model';

export function normalizeRole(role: Partial<RawRoleApiResponse> | RoleDto): RoleDto {
  const raw = role as Partial<RawRoleApiResponse>;
  const dept = raw.departmentId;
  return {
    id: String(raw.id ?? raw.roleId ?? ''),
    name: raw.name ?? raw.roleName ?? '',
    nameEn: raw.nameEn,
    nameAr: raw.nameAr,
    isDefaultRole: !!(raw.isDefaultRole ?? raw.isDefault),
    isSuperAdmin: !!(raw.isSuperAdmin ?? raw.superAdmin),
    isAdmin: !!(raw.isAdmin ?? raw.admin),
    applicationEntityIds: Array.isArray(raw.applicationEntityIds) ? raw.applicationEntityIds : undefined,
    ...(raw.isSelected !== undefined ? { isSelected: !!raw.isSelected } : {}),
    ...(dept !== undefined && dept !== null ? { departmentId: dept } : {})
  };
}

export function normalizeUser(rawUser: RawUserApiResponse): BackendUserDto {
  const user = { ...rawUser } as BackendUserDto;

  // API typo: militoryId -> militaryId
  if (rawUser.militoryId && !user.militaryId) {
    user.militaryId = rawUser.militoryId;
  }

  // Roles
  const rawRoles = Array.isArray(rawUser.roles) ? rawUser.roles : [];
  if (rawRoles.length > 0) {
    const mappedRoles: RoleDto[] = rawRoles.map(normalizeRole);
    user.roles = mappedRoles;
    const roleIdsFromRoles = mappedRoles
      .map(role => role.id)
      .filter((id): id is string => !!id);
    user.roleIds = roleIdsFromRoles.length > 0
      ? roleIdsFromRoles
      : (Array.isArray(user.roleIds) ? user.roleIds : []);
  } else {
    user.roles = [];
    user.roleIds = Array.isArray(user.roleIds) ? user.roleIds : [];
  }

  // Department
  const department = rawUser.department;
  if (department) {
    user.departmentId = department.id ?? user.departmentId;
    user.departmentName = department.nameEn ?? department.nameAr ?? user.departmentName;
    user.departmentNameEn = department.nameEn ?? user.departmentNameEn;
    user.departmentNameAr = department.nameAr ?? user.departmentNameAr;
  }

  // Rank
  const rank = rawUser.rank;
  if (rank) {
    user.rankId = rank.id ?? user.rankId;
    user.rankNameEn = rank.nameEn ?? rank.name ?? user.rankNameEn;
    user.rankNameAr = rank.nameAr ?? user.rankNameAr;
  }

  // Full names (API uses PascalCase variants)
  if (!user.nameEn) {
    user.nameEn = rawUser.fullNameEN ?? user.nameEn;
  }
  if (!user.nameAr) {
    user.nameAr = rawUser.fullNameAR ?? user.nameAr;
  }

  return user;
}
