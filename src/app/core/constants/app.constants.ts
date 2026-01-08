
export const APP_CONSTANTS = {
  APP_NAME: 'Ettad',
  VERSION: '1.0.0',
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
} as const;

// request Status Constants, Maps to backend RequestStatus enum
export const REQUEST_STATUS = {
  NEW: 1,
  UNDER_PROCESS: 2,
  APPROVED: 3,
  REJECTED: 4,
  CANCELLED: 5
} as const;

export type RequestStatusValue = typeof REQUEST_STATUS[keyof typeof REQUEST_STATUS];

export const API_ENDPOINTS = {
  // authentication
  AUTH: {
    LOGIN: '/account/login',
    LOGOUT: '/account/logout',
    REFRESH: '/account/refresh',
    USER_CLAIMS: '/account/user-claims',
    PROFILE: '/account/profile',
    FORGOT_PASSWORD: '/account/forgot-password',
    RESET_PASSWORD: '/account/reset-password',
    GENERATE_CAPTCHA: '/Account/generate-captcha',
    CAPTCHA_IMAGE: (captchaId: string) => `/Account/captcha-image/${captchaId}`,
    CAPTCHA_IMAGE_ALT: (captchaId: string) => `/Account/get-captcha-image/${captchaId}`,
  },

  // user management
  USERS: {
    BASE: '/Users',
    ME: '/Users/me',
    BY_ID: (id: string) => `/Users/${id}`,
    ROLES: (id: string) => `/Users/${id}/roles`,
    UPDATE_ROLES: (id: string) => `/Users/${id}/roles`,
    TOGGLE_STATUS: (id: string) => `/Users/${id}/toggle-status`,
    CHANGE_PASSWORD: '/Users/change-password',
  },

  // role management (match backend casing)
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

  // application entities
  APPLICATION_ENTITIES: {
    BASE: '/Roles/entities',
    ALL: '/Roles/entities',
  },

  // workflow management
  WORKFLOWS: {
    BASE: '/Workflows',
    BY_ID: (id: number) => `/Workflows/${id}`,
    ALL: '/Workflows/all',
    ALL_LIST: '/Workflows/all-list',
  },

  // workflow step notifiers
  WORKFLOW_STEP_NOTIFIERS: {
    BASE: '/WorkflowStepNotifiers',
    BY_STEP_ID: (stepId: number) => `/WorkflowStepNotifiers/step/${stepId}`,
    UPDATE_STEP: (stepId: number) => `/WorkflowStepNotifiers/step/${stepId}`,
    ADD: '/WorkflowStepNotifiers',
    REMOVE: (notifierId: number) => `/WorkflowStepNotifiers/${notifierId}`,
  },

  // workflow approval
  WORKFLOW_APPROVAL: {
    BASE: '/WorkflowApproval',
    ALL_ORDERS: '/WorkflowApproval/AllOrders',
    ALL_BASE_REQUESTS: '/WorkflowApproval/AllBaseRequests',
    BASE_REQUEST_BY_ID: (requestId: number) => `/WorkflowApproval/BaseRequest/${requestId}`,
    APPROVE_REJECT: '/WorkflowApproval/approve-reject',
  },

  // requests management
  REQUESTS: {
    BASE: '/Request',
    BY_ID: (id: number) => `/Request/${id}`,
    ALL: '/Request',
    BY_DEPARTMENT: (departmentId: number) => `/Request/department/${departmentId}`,
    USER_ACTIONS: '/Request/user-actions',
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
    VERIFY_ALLOWANCE: '/Order/verify-allowance',
    SET_PICKUP_DATE: (id: number) => `/Order/${id}/set-pickup-date`,
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

  // Email Configuration
  EMAIL_CONFIGURATION: {
    BASE: '/EmailSettings',
  },

  // LDAP Settings
  LDAP_SETTINGS: {
    BASE: '/LdapSettings',
  },

  // Email
  EMAIL: {
    BASE: '/Email',
    SEND: '/Email/send',
  },

  // Supply Management
  SUPPLY: {
    BASE: '/Supply',
    BY_ID: (id: number) => `/Supply/${id}`,
    BY_ORDER_ID: (orderId: number) => `/Supply/${orderId}/getByOrderId`,
    SET_PICKUP_DATE_BY_ORDER: (orderId: number) => `/Supply/order/${orderId}/set-pickup-date`,
    CONFIRM_PICKUP_DATE_BY_ORDER: (orderId: number) => `/Supply/order/${orderId}/confirm-pickup-date`,
    SUBMIT: (id: number) => `/Supply/${id}/submit`,
  },

  //Low stock notification settings
  STOCK_NOTIFICATION: {
    BASE: '/ItemNotification',
    SETTINGS: '/ItemNotification/settings',
    SCHEDULE: '/ItemNotification/schedule',
  },

  // File Upload Management
  FILE_UPLOAD: {
    BASE: '/FileUpload',
    BY_ID: (id: number) => `/FileUpload/${id}`,
    UPLOAD: '/FileUpload/upload',
    UPLOAD_FOR_ENTITY: '/FileUpload/upload-for-entity',
    SERVE: (id: number) => `/FileUpload/serve/${id}`,
    SERVE_BY_PATH: '/FileUpload/serve',
    SET_MAIN: (id: number) => `/FileUpload/${id}/set-main`,
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

// Supply order Component Constants
export const SUPPLY_ORDER_CONSTANTS = {
  NAVIGATION_DELAY_MS: 1500,
  REJECTION_DELAY_MS: 1000,
} as const;
