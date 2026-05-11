
export const APP_CONSTANTS = {
  APP_NAME: 'Ettad',
  VERSION: '1.3.0',
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 25, 50, 100],
} as const;

export const defaultPageSize: number = APP_CONSTANTS.DEFAULT_PAGE_SIZE;

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
    SELECT_ROLE: '/account/select-role',
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
    RESTORE: (id: string) => `/Users/${id}/restore`,
    PERMANENT_DELETE: (id: string) => `/Users/${id}/permanent`,
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
    AUTO_REJECT_TRIGGERS: (id: number) => `/Workflows/${id}/auto-reject-triggers`,
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
    /** POST: unified approve / reject / return-for-review (CQRS ProcessWorkflowActionCommand) */
    PROCESS_ACTION: '/WorkflowApproval/process-action',
  },

  // requests management
  REQUESTS: {
    BASE: '/Request',
    BY_ID: (id: number) => `/Request/${id}`,
    ALL: '/Request',
    PAGINATED: '/Request/Paginated',
    BY_DEPARTMENT: (departmentId: number) => `/Request/department/${departmentId}`,
    USER_ACTIONS: '/Request/user-actions',
    USER_ACTIONS_PAGINATED: '/Request/UserActionsPaginated',
  },

  // Return Requests
  RETURNS: {
    BASE: '/Return',
    BY_ID: (id: number) => `/Return/${id}`,
    CHANGE_PRIORITY: (id: number) => `/Return/${id}/priority`,
    SET_DEPOT: (id: number) => `/Return/${id}/set-depot`,
    SET_DELIVERY_DATE: (id: number) => `/Return/${id}/set-delivery-date`,
    PROCESS_ITEMS: (id: number) => `/Return/${id}/process-items`,
    TRACKING_LINES: (id: number) => `/Return/${id}/tracking-lines`,
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
    USERS: (depotId: number) => `/Lookup/Depot/${depotId}/users`,
    USERS_UPDATE: (depotId: number) => `/Lookup/Depot/${depotId}/users`,
  },

  // Allowance Management
  ALLOWANCE: {
    BASE: '/AllowanceItem',
    BULK: '/AllowanceItem/bulk',
    BY_DEPARTMENT_AND_YEAR: (departmentId: number, year: number) => `/AllowanceItem/department/${departmentId}/year/${year}`,
    BY_DEPARTMENT: (departmentId: number) => `/AllowanceItem/department/${departmentId}`,
    RESERVE_DETAILS: (departmentId: number, year: number) => `/AllowanceItem/reserve-details/${departmentId}/${year}`,
  },

  // Item Assignment Management
  ITEM_DEPARTMENT_ASSIGNMENT: {
    BASE: '/ItemDepartmentAssignment',
    SUMMARY: '/ItemDepartmentAssignment/summary',
    BY_DEPARTMENT: (departmentId: number) => `/ItemDepartmentAssignment/department/${departmentId}`,
    BY_ITEM: (itemId: number) => `/ItemDepartmentAssignment/item/${itemId}`,
    BULK: '/ItemDepartmentAssignment/bulk',
  },

  // Email Configuration
  EMAIL_CONFIGURATION: {
    BASE: '/EmailSettings',
    IS_ENABLED: '/EmailSettings/IsEnabled',
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
    WORKFLOW_SUMMARY: (orderId: number) => `/Supply/${orderId}/workflow-summary`,
    SET_PICKUP_DATE_BY_ORDER: (orderId: number) => `/Supply/order/${orderId}/set-pickup-date`,
    CONFIRM_PICKUP_DATE_BY_ORDER: (orderId: number) => `/Supply/order/${orderId}/confirm-pickup-date`,
    SUBMIT: (id: number) => `/Supply/${id}/submit`,
  },

  //Low stock notification settings
  STOCK_NOTIFICATION: {
    BASE: '/ItemNotification',
    SETTINGS: '/ItemNotification/settings',
    SCHEDULE: '/ItemNotification/schedule',
    CRITICAL_SETTINGS: '/ItemNotification/critical-settings',
    CRITICAL_SCHEDULE: '/ItemNotification/critical-schedule',
  },

  // Order auto-reject settings + countdown (Workflows API)
  ORDER_AUTO_REJECT: {
    SETTINGS: '/order-auto-reject-settings',
    COUNTDOWN: '/order-auto-reject/countdown',
  },

  // Onboarding
  ONBOARDING: {
    STATUS: '/account/onboarding-status',
    COMPLETE: '/account/complete-onboarding',
  },

  // Help Center (api/HelpCenter — see HelpCenterController)
  HELP_CENTER: {
    BASE: '/HelpCenter',
    ARTICLES: '/HelpCenter/articles',
    ARTICLES_ALL: '/HelpCenter/articles/all',
    ARTICLE_BY_ID: (id: number) => `/HelpCenter/articles/${id}`,
    CONTACT: '/HelpCenter/contact',
    CONTACT_BY_ID: (id: number) => `/HelpCenter/contact/${id}`,
    CONTACT_REPLY: (id: number) => `/HelpCenter/contact/${id}/reply`,
    CONTACT_DISPLAY: '/HelpCenter/contact/display',
    TERMS: '/HelpCenter/terms',
    TERMS_ALL: '/HelpCenter/terms/all',
    TERMS_BY_ID: (id: number) => `/HelpCenter/terms/${id}`,
    TERMS_ACTIVATE: (id: number) => `/HelpCenter/terms/${id}/activate`,
    TERMS_DEACTIVATE: (id: number) => `/HelpCenter/terms/${id}/deactivate`,
    /** Optional: backend may expose for blocking Terms UX */
    TERMS_ACCEPTANCE_STATUS: '/HelpCenter/terms/acceptance-status',
    TERMS_ACCEPT: '/HelpCenter/terms/accept',
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
    DELETE: (id: number) => `/FileUpload/${id}`,
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

// Admin Dashboard Constants
export const DASHBOARD_CONSTANTS = {
  AUTO_REFRESH_INTERVAL_MS: 30000, // 30 seconds
  LOW_STOCK_THRESHOLD: 100,
  TOP_ITEMS_LIMIT: 10,
  DEFAULT_CHART_PERIOD: 'weekly'
} as const;
