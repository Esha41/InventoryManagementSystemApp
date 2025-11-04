/**
 * Application-wide constants
 */

export const APP_CONSTANTS = {
  APP_NAME: 'Ettad',
  VERSION: '1.0.0',
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
} as const;

export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/account/login',
    LOGOUT: '/account/logout',
    REFRESH: '/account/refresh',
    USER_CLAIMS: '/account/user-claims',
    FORGOT_PASSWORD: '/account/forgot-password',
    RESET_PASSWORD: '/account/reset-password',
  },
  
  // User Management
  USERS: {
    BASE: '/users',
    BY_ID: (id: string) => `/users/${id}`,
    ROLES: (id: string) => `/users/${id}/roles`,
    UPDATE_ROLES: (id: string) => `/users/${id}/roles`,
  },
  
  // Role Management
  ROLES: {
    BASE: '/roles',
    PAGINATED: '/roles/GetRolesWithPagination',
    BY_ID: (id: string) => `/roles/${id}`,
    PERMISSIONS: (id: string) => `/roles/${id}/permissions`,
    CRUD_PERMISSIONS: (id: string) => `/roles/${id}/crud/permissions`,
    ASSIGN_PERMISSIONS: '/roles/permissions',
    USERS_IN_ROLE: (id: string) => `/roles/${id}/users`,
  },

  // Application Entities
  APPLICATION_ENTITIES: {
    BASE: '/Roles/entities',
    ALL: '/Roles/entities',
  },
  
  // Workflow Management
  WORKFLOWS: {
    BASE: '/workflows',
    BY_ID: (id: number) => `/workflows/${id}`,
    ALL: '/workflows/all',
    ALL_LIST: '/workflows/all-list',
  },
  
  // Requests Management
  REQUESTS: {
    BASE: '/requests',
    BY_ID: (id: number) => `/requests/${id}`,
    ALL: '/requests/all',
  },
  
  // Lookup Services
  LOOKUPS: {
    BASE: '/lookups',
    BY_TYPE: (type: string) => `/lookups/${type}`,
  },

  // Ammunition Management
  AMMUNITION: {
    BASE: '/ammunition',
    BY_ID: (id: number) => `/ammunition/${id}`,
  },
  
  // Warehouse Management
  WAREHOUSES: {
    BASE: '/warehouses',
    BY_ID: (id: string) => `/warehouses/${id}`,
    SUMMARY: '/warehouses/summary',
    INVENTORY: (id: string) => `/warehouses/${id}/inventory`,
    INVENTORY_PAGINATED: (id: string) => `/warehouses/${id}/inventory/paginated`,
  },
} as const;

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_PREFERENCES: 'user_preferences',
  THEME: 'theme',
} as const;

export const ROUTES = {
  DASHBOARD: '/dashboard',
  NEW_ISSUE_REQUEST: '/new-issue-request',
  REQUESTS_MANAGEMENT: '/requests-management',
  FORECAST: '/forecast',
  ADD_ASSET: '/add-asset',
  ASSET_LIST: '/asset-list',
  SEARCH_INVENTORY: '/search-inventory',
  MANAGE_ADMINS: '/manage-admins',
  ADMIN_ROLES: '/admin-roles',

} as const;

