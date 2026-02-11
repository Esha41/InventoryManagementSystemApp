/**
 * User Models
 */

import { Role } from './role.model';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: Role;
  status: UserStatus;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt?: Date;
  avatar?: string;
  department?: string;
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended'
}

export interface CreateUserDTO {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  roleId: string;
  password: string;
  department?: string;
  status?: UserStatus;
}

export interface UpdateUserDTO extends Partial<Omit<CreateUserDTO, 'password'>> {
  id: string;
  password?: string;
}

export interface UserFilter {
  search?: string;
  roleId?: string;
  status?: UserStatus;
  department?: string;
}

export function getFullName(user: User): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

export function getUserInitials(user: User): string {
  return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
}

