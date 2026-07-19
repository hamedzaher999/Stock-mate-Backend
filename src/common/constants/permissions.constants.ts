export const PERMISSIONS = {
    MANAGE_DEPARTMENTS: 'manage_departments',
    MANAGE_ACCOUNTS: 'manage_accounts',
    MANAGE_ROLES: 'manage_roles',
    MANAGE_USER_PERMISSIONS: 'manage_user_permissions',
    MANAGE_DOCTORS: 'manage_doctors',

    MANAGE_MATERIALS: 'manage_materials',
    MANAGE_DEPARTMENT_MATERIALS: 'manage_department_materials',
    MANAGE_UNITS: 'manage_units',
    MANAGE_CATEGORIES: 'manage_categories',
    MANAGE_SUPPLIERS: 'manage_suppliers',
    MANAGE_MATERIAL_SUPPLIERS: 'manage_material_suppliers',

    CREATE_PURCHASE_REQUEST: 'create_purchase_request',
    APPROVE_PURCHASE_REQUEST_HOSPITAL: 'approve_purchase_request_hospital',
    APPROVE_PURCHASE_REQUEST_COMMITTEE: 'approve_purchase_request_committee',
    MANAGE_PURCHASE_ORDERS: 'manage_purchase_orders',
    RECEIVE_PURCHASE: 'receive_purchase',
    VIEW_PURCHASING_HISTORY: 'view_purchasing_history',
    VIEW_PURCHASING_REPORTS: 'view_purchasing_reports',

    CREATE_DEPARTMENT_REFILL_REQUEST: 'create_department_refill_request',
    APPROVE_DEPARTMENT_REFILL_REQUEST: 'approve_department_refill_request',
    PREPARE_DEPARTMENT_REFILL: 'prepare_department_refill',
    CONFIRM_DEPARTMENT_DELIVERY: 'confirm_department_delivery',

    VIEW_INVENTORY: 'view_inventory',
    TRANSFER_INVENTORY: 'transfer_inventory',
    PERFORM_INVENTORY_ADJUSTMENT: 'perform_inventory_adjustment',
    PERFORM_STOCK_COUNT: 'perform_stock_count',
    RECORD_DEPARTMENT_CONSUMPTION: 'record_department_consumption',

    ADD_PATIENT: 'add_patient',
    VIEW_PATIENTS: 'view_patients',
    VIEW_PATIENT_HISTORY: 'view_patient_history',
    MANAGE_DEPARTMENT_QUEUE: 'manage_department_queue',
    CANCEL_VISIT: 'cancel_visit',

    START_CONSULTATION: 'start_consultation',
    CREATE_PRESCRIPTION: 'create_prescription',
    RENEW_PRESCRIPTION: 'renew_prescription',
    CANCEL_PRESCRIPTION: 'cancel_prescription',
    MANAGE_ALL_PRESCRIPTIONS: 'manage_all_prescriptions',

    DISPENSE_PRESCRIPTION: 'dispense_prescription',

    VIEW_REPORTS: 'view_reports',
    VIEW_AI_INSIGHTS: 'view_ai_insights',
    REVIEW_AI_INSIGHTS: 'review_ai_insights',
    MANAGE_PERIODIC_REFILL_SCHEDULES: 'manage_periodic_refill_schedules',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
