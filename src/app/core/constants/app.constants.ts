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
    PROFILE: '/account/profile',
    FORGOT_PASSWORD: '/account/forgot-password',
    RESET_PASSWORD: '/account/reset-password',
  },
  
  // User Management
  USERS: {
    BASE: '/Users',
    BY_ID: (id: string) => `/Users/${id}`,
    ROLES: (id: string) => `/Users/${id}/roles`,
    UPDATE_ROLES: (id: string) => `/Users/${id}/roles`,
  },
  
  // Role Management (match backend casing)
  ROLES: {
    BASE: '/Roles',
    PAGINATED: '/roles/GetRolesWithPagination',
    BY_ID: (id: string) => `/Roles/${id}`,
    PERMISSIONS: (id: string) => `/Roles/${id}/permissions`,
    CRUD_PERMISSIONS: (id: string) => `/Roles/${id}/crud/permissions`,
    ASSIGN_PERMISSIONS: '/Roles/permissions',
    USERS_IN_ROLE: (id: string) => `/Roles/${id}/users`,
    APPLICATION_ENTITIES: '/Roles/getApplicationentities',
    APPLICATION_ENTITIES_BY_ROLE: (id: string) => `/Roles/getApplicationentities/${id}`
  },

  // Application Entities
  APPLICATION_ENTITIES: {
    BASE: '/Roles/entities',
    ALL: '/Roles/entities',
  },
  
  // Workflow Management
  WORKFLOWS: {
    BASE: '/Workflows',
    BY_ID: (id: number) => `/Workflows/${id}`,
    ALL: '/Workflows/all',
    ALL_LIST: '/Workflows/all-list',
  },
  
  // Requests Management
  REQUESTS: {
    BASE: '/requests',
    BY_ID: (id: number) => `/requests/${id}`,
    ALL: '/requests/all',
  },
  
  // Return Requests
  RETURNS: {
    BASE: '/Return',
    BY_ID: (id: number) => `/Return/${id}`,
    CHANGE_PRIORITY: (id: number) => `/Return/${id}/priority`,
  },
  
  // Discard Requests
  DISCARDS: {
    BASE: '/Discard',
    BY_ID: (id: number) => `/Discard/${id}`,
    CHANGE_PRIORITY: (id: number) => `/Discard/${id}/priority`,
  },
  
  // Order Requests
  ORDERS: {
    BASE: '/Order',
    BY_ID: (id: number) => `/Order/${id}`,
  },
  
  // Request Purposes
  REQUEST_PURPOSES: {
    BASE: '/RequestPurpose',
    FOR_RETURN: '/RequestPurpose/return',
    FOR_DISCARD: '/RequestPurpose/discard',
    FOR_ORDER: '/RequestPurpose/order',
    BY_ID: (id: number) => `/RequestPurpose/${id}`,
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
  
  // Inventory Management
  INVENTORY: {
    BASE: '/inventory',
    BY_ID: (id: number) => `/inventory/${id}`,
  },

  // Notifications
  NOTIFICATIONS: {
    BASE: '/Notification',
    UNREAD_COUNT: '/Notification/unread-count',
    MARK_AS_READ: (id: number) => `/Notification/${id}/read`,
    MARK_ALL_AS_READ: '/Notification/read-all',
    CONFIRM_PICKUP: (id: number) => `/Notification/${id}/confirm`,
    PROPOSE_NEW_TIME: (id: number) => `/Notification/${id}/propose`,
    SEND_TO_USER: '/Notification/send',
    SEND_TO_GROUP: '/Notification/send-to-group'
  },
 
  // Depot Management (Warehouses)
  DEPOT: {
    BASE: '/Lookup/Depot',
  },

  // Allowance Management
  ALLOWANCE: {
    BASE: '/AllowanceItem',
    BULK: '/AllowanceItem/bulk',
    BY_DEPARTMENT_AND_YEAR: (departmentId: number, year: number) => `/AllowanceItem/department/${departmentId}/year/${year}`,
    BY_DEPARTMENT: (departmentId: number) => `/AllowanceItem/department/${departmentId}`,
    RESERVE_DETAILS: (departmentId: number, year: number) => `/AllowanceItem/reserve-details/${departmentId}/${year}`,
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
  MANAGE_ADMINS: '/manage-admins',
  ADMIN_ROLES: '/admin-roles',

} as const;

