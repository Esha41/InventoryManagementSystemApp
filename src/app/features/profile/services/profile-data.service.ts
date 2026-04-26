import { Injectable } from '@angular/core';
import { AuthenticatedUser, ClaimDto } from '@models/auth.model';
import { IUserProfileProvider } from '@core/interfaces/user-profile-provider.interface';
import { UserMeResponse } from '@profile/models/profile.model';
import { StorageService } from '@services/storage.service';

// Comprehensive profile data interface (stored in sessionStorage for security)
export interface ProfileData {
  // User basic info
  id: string;
  userName: string;
  email: string;

  // Names
  nameEn?: string;
  nameAr?: string;
  fullNameEN?: string;
  fullNameAR?: string;

  // Authentication
  isLdapUser?: boolean;
  ldapUserName?: string;
  isSuperAdmin?: boolean;

  // Roles and permissions
  roles?: string[];
  rolesDetails?: Array<{ id: string; name: string }>;
  permissions?: ClaimDto[];

  // Department
  departmentId?: number;
  departmentName?: string;
  departmentCode?: string;
  departmentNameEn?: string;
  departmentNameAr?: string;
  departmentIsDeleted?: boolean;

  // Rank
  rankId?: number;
  rankNameEn?: string;
  rankNameAr?: string;
  rankIsDeleted?: boolean;

  // Military
  militaryId?: string;

  // Organization
  organizationId?: number;

  // Additional
  extraEmployeesView?: string;

  // Timestamp for cache validation
  lastUpdated?: string;
}

/**
 * Service for managing user profile data.
 * Uses sessionStorage (via StorageService) to reduce XSS exposure.
 */
@Injectable({
  providedIn: 'root'
})
export class ProfileDataService implements IUserProfileProvider {
  private readonly PROFILE_STORAGE_KEY = 'user_profile_data';

  constructor(private storageService: StorageService) { }

  /**
   * Save comprehensive profile data to session storage
   */
  saveProfile(user: AuthenticatedUser, apiResponse?: UserMeResponse): void {
    try {
      const profileData: ProfileData = {
        // User basic info
        id: user.id,
        userName: user.userName,
        email: user.email,

        // Names
        nameEn: user.nameEn,
        nameAr: user.nameAr,
        fullNameEN: apiResponse?.fullNameEN,
        fullNameAR: apiResponse?.fullNameAR,

        // Authentication
        isLdapUser: user.isLdapUser,
        ldapUserName: user.ldapUserName,
        isSuperAdmin: apiResponse?.isSuperAdmin,

        // Roles and permissions
        roles: user.roles,
        rolesDetails: apiResponse?.roles,
        permissions: user.permissions,

        // Department - all fields
        departmentId: user.departmentId,
        departmentName: user.departmentName,
        departmentCode: apiResponse?.department?.code,
        departmentNameEn: apiResponse?.department?.nameEn,
        departmentNameAr: apiResponse?.department?.nameAr,
        departmentIsDeleted: apiResponse?.department?.isDeleted,

        // Rank - all fields
        rankId: user.rankId,
        rankNameEn: user.rankNameEn,
        rankNameAr: user.rankNameAr,
        rankIsDeleted: apiResponse?.rank?.isDeleted,

        // Military
        militaryId: user.militaryId,

        // Organization
        organizationId: user.organizationId,

        // Additional
        extraEmployeesView: apiResponse?.extraEmployeesView,

        // Timestamp
        lastUpdated: new Date().toISOString()
      };

      this.storageService.set(this.PROFILE_STORAGE_KEY, profileData);
    } catch (error) {
      console.error('Error saving profile to storage:', error);
    }
  }

  /**
   * Get profile data from storage as AuthenticatedUser
   */
  getProfile(): AuthenticatedUser | null {
    try {
      const profileData = this.storageService.get<ProfileData>(this.PROFILE_STORAGE_KEY);
      if (!profileData) {
        return null;
      }

      // Convert ProfileData back to AuthenticatedUser format
      return this.convertToAuthenticatedUser(profileData);
    } catch (error) {
      console.error('Error reading profile from storage:', error);
      return null;
    }
  }

  /**
   * Get full profile data from storage (includes all fields)
   */
  getFullProfileData(): ProfileData | null {
    try {
      return this.storageService.get<ProfileData>(this.PROFILE_STORAGE_KEY);
    } catch (error) {
      console.error('Error reading full profile data from storage:', error);
      return null;
    }
  }

  /**
   * Check if profile data exists in storage
   */
  hasProfile(): boolean {
    return this.storageService.has(this.PROFILE_STORAGE_KEY);
  }

  /**
   * Clear profile data from storage
   */
  clearProfile(): void {
    this.storageService.remove(this.PROFILE_STORAGE_KEY);
  }

  /**
   * Get the last updated timestamp
   */
  getLastUpdated(): string | null {
    const profileData = this.getFullProfileData();
    return profileData?.lastUpdated || null;
  }

  /**
   * Convert ProfileData to AuthenticatedUser
   */
  private convertToAuthenticatedUser(profileData: ProfileData): AuthenticatedUser {
    return {
      id: profileData.id,
      userName: profileData.userName,
      email: profileData.email,
      roles: profileData.roles || [],
      permissions: profileData.permissions || [],
      isLdapUser: profileData.isLdapUser,
      ldapUserName: profileData.ldapUserName,
      organizationId: profileData.organizationId,
      departmentId: profileData.departmentId,
      departmentName: profileData.departmentName,
      departmentNameEn: profileData.departmentNameEn,
      departmentNameAr: profileData.departmentNameAr,
      nameEn: profileData.nameEn,
      nameAr: profileData.nameAr,
      rankId: profileData.rankId,
      rankNameEn: profileData.rankNameEn,
      rankNameAr: profileData.rankNameAr,
      militaryId: profileData.militaryId
    };
  }
}

