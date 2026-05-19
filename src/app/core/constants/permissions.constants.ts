/**
 * Single source of truth for all permission strings. A typo here is a compile error, not a silent access-denied.
 */
export const PERMISSIONS = {
  ADMIN: {
    DASHBOARD: {
      PAGE: 'admindashboard.page',
      VIEW: 'admindashboard.view',
      API_PAGE: 'Permissions.AdminDashboard.Page',
      API_VIEW: 'Permissions.AdminDashboard.View'
    },
    ANALYTICS: {
      PAGE: 'analytics.page',
      VIEW: 'analytics.view'
    },
    DEPOTS: {
      PAGE: 'depots.page',
      EDIT: 'Depots.Edit',
      DELETE: 'Depots.Delete'
    },
    SYSTEM_USERS: {
      PAGE: 'systemusers.page',
      VIEW: 'systemusers.view',
      API_PAGE: 'Permissions.SystemUsers.Page',
      CREATE: 'SystemUsers.Create',
      EDIT: 'SystemUsers.Edit',
      DELETE: 'SystemUsers.Delete'
    },
    LOOKUP_TABLES: {
      PAGE: 'Permissions.LookupTables.Page'
    },
    LOOKUP: {
      DEPARTMENTS: {
        PAGE: 'Permissions.Departments.Page',
        CREATE: 'Permissions.Departments.Create',
        EDIT: 'Permissions.Departments.Edit',
        DELETE: 'Permissions.Departments.Delete'
      },
      CASE_TYPES: {
        PAGE: 'Permissions.CaseTypes.Page',
        CREATE: 'Permissions.CaseTypes.Create',
        EDIT: 'Permissions.CaseTypes.Edit',
        DELETE: 'Permissions.CaseTypes.Delete'
      },
      CLASSIFICATIONS: {
        PAGE: 'Permissions.Classifications.Page',
        CREATE: 'Permissions.Classifications.Create',
        EDIT: 'Permissions.Classifications.Edit',
        DELETE: 'Permissions.Classifications.Delete'
      },
      COLORS: {
        PAGE: 'Permissions.Colors.Page',
        CREATE: 'Permissions.Colors.Create',
        EDIT: 'Permissions.Colors.Edit',
        DELETE: 'Permissions.Colors.Delete'
      },
      COMPATIBILITIES: {
        PAGE: 'Permissions.Compatibilities.Page',
        CREATE: 'Permissions.Compatibilities.Create',
        EDIT: 'Permissions.Compatibilities.Edit',
        DELETE: 'Permissions.Compatibilities.Delete'
      },
      COUNTRIES: {
        PAGE: 'Permissions.Countries.Page',
        CREATE: 'Permissions.Countries.Create',
        EDIT: 'Permissions.Countries.Edit',
        DELETE: 'Permissions.Countries.Delete'
      },
      HAZARD_DIVISIONS: {
        PAGE: 'Permissions.HazardDivisions.Page',
        CREATE: 'Permissions.HazardDivisions.Create',
        EDIT: 'Permissions.HazardDivisions.Edit',
        DELETE: 'Permissions.HazardDivisions.Delete'
      },
      ITEM_TYPES: {
        PAGE: 'Permissions.ItemTypes.Page',
        CREATE: 'Permissions.ItemTypes.Create',
        EDIT: 'Permissions.ItemTypes.Edit',
        DELETE: 'Permissions.ItemTypes.Delete'
      },
      CALIBERS: {
        PAGE: 'Permissions.Calibers.Page',
        CREATE: 'Permissions.Calibers.Create',
        EDIT: 'Permissions.Calibers.Edit',
        DELETE: 'Permissions.Calibers.Delete'
      },
      MANUFACTURERS: {
        PAGE: 'Permissions.Manufacturers.Page',
        CREATE: 'Permissions.Manufacturers.Create',
        EDIT: 'Permissions.Manufacturers.Edit',
        DELETE: 'Permissions.Manufacturers.Delete'
      },
      NATURE_OPTIONS: {
        PAGE: 'Permissions.NatureOptions.Page',
        CREATE: 'Permissions.NatureOptions.Create',
        EDIT: 'Permissions.NatureOptions.Edit',
        DELETE: 'Permissions.NatureOptions.Delete'
      },
      PRIMARY_PURPOSES: {
        PAGE: 'Permissions.PrimaryPurposes.Page',
        CREATE: 'Permissions.PrimaryPurposes.Create',
        EDIT: 'Permissions.PrimaryPurposes.Edit',
        DELETE: 'Permissions.PrimaryPurposes.Delete'
      },
      PROJECTILE_MATERIALS: {
        PAGE: 'Permissions.ProjectailMaterials.Page',
        CREATE: 'Permissions.ProjectailMaterials.Create',
        EDIT: 'Permissions.ProjectailMaterials.Edit',
        DELETE: 'Permissions.ProjectailMaterials.Delete'
      },
      PROPELLANTS: {
        PAGE: 'Permissions.Propellants.Page',
        CREATE: 'Permissions.Propellants.Create',
        EDIT: 'Permissions.Propellants.Edit',
        DELETE: 'Permissions.Propellants.Delete'
      },
      SUPPLIER: {
        PAGE: 'Permissions.Supplier.Page',
        CREATE: 'Permissions.Supplier.Create',
        EDIT: 'Permissions.Supplier.Edit',
        DELETE: 'Permissions.Supplier.Delete'
      },
      UNITS: {
        PAGE: 'Permissions.Units.Page',
        CREATE: 'Permissions.Units.Create',
        EDIT: 'Permissions.Units.Edit',
        DELETE: 'Permissions.Units.Delete'
      },
      RANK: {
        PAGE: 'Permissions.Rank.Page',
        CREATE: 'Permissions.Rank.Create',
        EDIT: 'Permissions.Rank.Edit',
        DELETE: 'Permissions.Rank.Delete'
      },
      EMPLOYEE: {
        PAGE: 'Permissions.Employee.Page',
        CREATE: 'Permissions.Employee.Create',
        EDIT: 'Permissions.Employee.Edit',
        DELETE: 'Permissions.Employee.Delete'
      },
      REQUEST_PURPOSE: {
        PAGE: 'Permissions.RequestPurpose.Page',
        CREATE: 'Permissions.RequestPurpose.Create',
        EDIT: 'Permissions.RequestPurpose.Edit',
        DELETE: 'Permissions.RequestPurpose.Delete'
      }
    },
    ROLES: {
      PAGE: 'roles.page',
      VIEW: 'roles.view',
      EDIT: 'roles.edit',
      API_PAGE: 'Permissions.Roles.Page',
      API_VIEW: 'Permissions.Roles.View',
      API_EDIT: 'Permissions.Roles.Edit',
      API_CREATE: 'Permissions.Roles.Create',
      API_DELETE: 'Permissions.Roles.Delete',
      API_MANAGE: 'Permissions.Roles.Manage',
      CREATE: 'Roles.Create',
      EDIT_CLAIM: 'Roles.Edit',
      DELETE: 'Roles.Delete'
    },
    IMPORT_EXPORT: {
      PAGE: 'AdminImportExport'
    },
    HELP_CENTER: {
      PAGE: 'helpcenter.page',
      VIEW: 'helpcenter.view',
      CREATE: 'helpcenter.create',
      EDIT: 'helpcenter.edit',
      DELETE: 'helpcenter.delete'
    },
    ANNOUNCEMENTS: {
      PAGE: 'announcements.page',
      VIEW: 'announcements.view',
      CREATE: 'announcements.create',
      EDIT: 'announcements.edit'
    },
    DELEGATION_MANAGEMENT: 'DelegationManagement',
    IMPORT_DATA: {
      CAN_IMPORT: 'canImportData'
    },
    /** Plain / feature-style claims surfaced on the role-permissions screen */
    SYSTEM_FEATURES: {
      CAN_CHANGE_PASSWORD: 'CanChangePassword',
      CAN_GENERATE_REPORT: 'CanGenerateReport',
      CAN_IMPORT_DATA_PASCAL: 'CanImportData',
      EMAIL_LOGS: 'EmailLogs'
    }
  },
  REQUESTS: {
    REQUEST: {
      PAGE: 'request.page',
      VIEW: 'request.view'
    },
    ORDER: {
      VIEW: 'order.view',
      CREATE: 'order.create',
      PAGE: 'order.page',
      CREATE_CLAIM: 'Order.Create',
      EDIT: 'Order.Edit',
      DELETE: 'Order.Delete',
      INCREASE_QUANTITY: 'Order.IncreaseQuantity',
      DECREASE_QUANTITY: 'Order.DecreaseQuantity'
    },
    SUPPLY: {
      PAGE: 'supply.page',
      VIEW: 'supply.view',
      EDIT: 'Permissions.Supply.Edit'
    },
    NEW_REQUEST: {
      PAGE: 'newrequest.page',
      CREATE: 'newrequest.create'
    },
    RETURN_REQUEST: {
      PAGE: 'returnrequest.page',
      CREATE: 'returnrequest.create',
      PAGE_NAV: 'return.page'
    },
    DISCARD: {
      PAGE: 'discard.page',
      CREATE: 'discard.create',
      PAGE_NAV: 'discard.page'
    },
    VIEW_REQUEST: {
      PAGE: 'viewrequest.page',
      VIEW: 'viewrequest.view'
    },
    PROCESS_RETURN_ITEMS: 'ProcessReturnItems',
    REVIEW_WEAPON_SUPPLY: 'ReviewWeaponSupply',
    ASSET_SUPPLY: {
      VIEW: 'Permissions.AssetSupply.View'
    },
    RECEIVER: {
      PAGE: 'requestReciever.page'
    },
    DASHBOARD: {
      ORDER_VIEW: 'Permissions.Order.View',
      ORDER_PAGE: 'Permissions.Order.Page',
      RETURN_VIEW: 'Permissions.Return.View',
      RETURN_PAGE: 'Permissions.Return.Page',
      DISCARD_VIEW: 'Permissions.Discard.View',
      DISCARD_PAGE: 'Permissions.Discard.Page'
    },
    WORKFLOW_APPROVAL: {
      SUPPLY_REVIEW: 'UpdateRequestAndSuggestLots',
      UPDATE_REQUEST_AND_SUPPLY: 'UpdateRequestAndSupply',
      CANNOT_REJECT: 'CannotRejectRequest',
      CAN_CANCEL_REQUEST: 'CanCancelRequest',
      SET_SUPPLY_PICKUP_DATE: 'SetSupplyPickupDate',
      CONFIRM_SUPPLY_PICKUP_DATE: 'ConfirmSupplyPickupDate',
      VIEW_SUPPLY_DATE: 'ViewSupplyDate',
      VIEW_WORKFLOW_SUPPLY_SUMMARY: 'ViewWorkflowSupplySummary',
      SUBMIT_SUPPLY: 'SubmitSupply',
      REVIEW_WEAPON_SUPPLY: 'ReviewWeaponSupply',
      SELECT_DEPOTS: 'SelectDepots',
      UPDATE_REQUEST_ITEMS: 'UpdateRequestItems',
      SET_RETURN_DEPOT: 'SetReturnDepot',
      SET_RETURN_DELIVERY_DATE: 'SetReturnDeliveryDate',
      PROCESS_RETURN_ITEMS: 'ProcessReturnItems'
    }
  },
  ASSETS: {
    ADD_NEW_ASSET_PAGE: {
      PAGE: 'addnewassetpage.page'
    },
    AMMUNITION: {
      CREATE: 'ammunition.create',
      PAGE: 'ammunition.page',
      VIEW: 'ammunition.view',
      CREATE_CLAIM: 'Ammunition.Create',
      EDIT: 'Ammunition.Edit',
      DELETE: 'Ammunition.Delete'
    },
    WEAPON: {
      VIEW: 'weapon.view',
      PAGE: 'weapon.page',
      CREATE: 'weapon.create',
      CREATE_CLAIM: 'Weapon.Create',
      EDIT: 'Weapon.Edit',
      DELETE: 'Weapon.Delete'
    },
    EXPLOSIVE: {
      VIEW: 'explosive.view',
      PAGE: 'explosive.page',
      CREATE: 'explosive.create',
      CREATE_CLAIM: 'Explosive.Create',
      EDIT: 'Explosive.Edit',
      DELETE: 'Explosive.Delete'
    },
    ASSET: {
      PAGE: 'asset.page',
      VIEW: 'asset.view',
      CREATE: 'asset.create',
      EDIT: 'asset.edit',
      CREATE_CLAIM: 'Asset.Create',
      EDIT_CLAIM: 'Asset.Edit',
      DELETE: 'Asset.Delete'
    }
  },
  SETTINGS: {
    LDAP: {
      PAGE: 'ldapsettings.page',
      VIEW: 'ldapsettings.view',
      PAGE_NAV: 'ldapSettings.page'
    },
    EMAIL: {
      PAGE: 'emailsettings.page',
      VIEW: 'emailsettings.view',
      EDIT: 'emailsettings.edit'
    },
    STOCK_NOTIFICATIONS: {
      PAGE: 'stockNotificationSettingsPage'
    },
    REQUESTER_QTY_NOTIFICATIONS: {
      PAGE: 'requesterQtyChangeNotificationSettingsPage'
    },
    ORDER_AUTO_REJECT: {
      PAGE: 'orderAutoRejectSettings.page'
    }
  },
  DEPARTMENT: {
    ALLOWANCE_ITEM: {
      PAGE: 'allowanceitem.page',
      VIEW: 'allowanceitem.view',
      CREATE: 'allowanceitem.create',
      CREATE_CLAIM: 'AllowanceItem.Create',
      EDIT: 'AllowanceItem.Edit',
      DELETE: 'AllowanceItem.Delete'
    },
    ITEM_DEPARTMENT_ASSIGNMENT: {
      PAGE: 'Permissions.ItemDepartmentAssignment.Page',
      CREATE: 'Permissions.ItemDepartmentAssignment.Create',
      DELETE: 'Permissions.ItemDepartmentAssignment.Delete'
    },
    ALLOWANCE_VIEW_ALL_DEPARTMENTS: 'AllowanceItemViewAllDepartments'
  },
  REPORTS: {
    DESIGNER: 'ReportDesigner',
    DASHBOARD: 'ReportDashboard',
    SCHEDULED: 'ScheduledReports'
  },
  DASHBOARD: {
    VIEW: 'dashboard_view',
    FORECAST: {
      PAGE: 'forecastpage.page',
      VIEW: 'forecastpage.view'
    }
  },
  WAREHOUSE: {
    PAGE: {
      PAGE: 'warehousepage.page',
      VIEW: 'warehousepage.view'
    },
    INVENTORY_PAGE: {
      PAGE: 'inventorypage.page'
    },
    INVENTORY: {
      VIEW: 'inventory.view',
      CREATE: 'inventory.create',
      CREATE_CLAIM: 'Inventory.Create',
      EDIT: 'Inventory.Edit',
      DELETE: 'Inventory.Delete'
    },
    MAP: {
      VIEW: 'WarehouseMapView'
    }
  },
  INVENTORY: {
    DASHBOARD: 'InventoryDashboard',
    /** Sidebar menu uses this distinct claim string today */
    DASHBOARD_MENU: 'inventoryDashboard',
    EXPIRING_LOTS_REPORT: {
      PAGE: 'expiringLotsReportPage'
    },
    LOW_STOCK_REPORT: {
      PAGE: 'lowStockReportPage'
    },
    CRITICAL_STOCK_REPORT: {
      PAGE: 'criticalStockReportPage'
    },
    SUMMARY_REPORT: {
      PAGE: 'inventorySummaryReportPage'
    }
  },
  WORKFLOW: {
    PAGE: 'workflow.page',
    VIEW: 'workflow.view',
    CREATE: 'workflow.create',
    EDIT: 'workflow.edit'
  },
  NOTIFICATIONS: {
    PAGE: {
      PAGE: 'notificationspage.page',
      VIEW: 'notificationspage.view'
    }
  }
} as const;

type PermissionLeaf<T> = T extends string ? T : { [K in keyof T]: PermissionLeaf<T[K]> }[keyof T];

export type Permission = PermissionLeaf<typeof PERMISSIONS>;
