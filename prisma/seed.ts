import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const permissionCatalog = [
  {
    code: 'manage_departments',
    name: 'Manage Departments',
    category: 'Administration',
  },
  {
    code: 'manage_accounts',
    name: 'Manage Accounts',
    category: 'Administration',
  },
  { code: 'manage_roles', name: 'Manage Roles', category: 'Administration' },
  {
    code: 'manage_user_permissions',
    name: 'Manage User Permissions',
    category: 'Administration',
  },
  {
    code: 'manage_doctors',
    name: 'Manage Doctors',
    category: 'Administration',
  },

  {
    code: 'manage_materials',
    name: 'Manage Materials',
    category: 'Materials & Suppliers',
  },
  {
    code: 'manage_department_materials',
    name: 'Manage Department Materials',
    category: 'Materials & Suppliers',
  },
  {
    code: 'manage_units',
    name: 'Manage Units',
    category: 'Materials & Suppliers',
  },
  {
    code: 'manage_categories',
    name: 'Manage Categories',
    category: 'Materials & Suppliers',
  },
  {
    code: 'manage_suppliers',
    name: 'Manage Suppliers',
    category: 'Materials & Suppliers',
  },
  {
    code: 'manage_material_suppliers',
    name: 'Manage Material Suppliers',
    category: 'Materials & Suppliers',
  },

  {
    code: 'create_purchase_request',
    name: 'Create Purchase Request',
    category: 'Purchasing',
  },
  {
    code: 'approve_purchase_request_hospital',
    name: 'Approve Purchase Request (Hospital)',
    category: 'Purchasing',
  },
  {
    code: 'approve_purchase_request_committee',
    name: 'Approve Purchase Request (Committee)',
    category: 'Purchasing',
  },
  {
    code: 'manage_purchase_orders',
    name: 'Manage Purchase Orders',
    category: 'Purchasing',
  },
  {
    code: 'receive_purchase',
    name: 'Receive Purchase',
    category: 'Purchasing',
  },
  {
    code: 'view_purchasing_history',
    name: 'View Purchasing History',
    category: 'Purchasing',
  },
  {
    code: 'view_purchasing_reports',
    name: 'View Purchasing Reports',
    category: 'Purchasing',
  },

  {
    code: 'create_department_refill_request',
    name: 'Create Department Refill Request',
    category: 'Department Refill & Delivery',
  },
  {
    code: 'approve_department_refill_request',
    name: 'Approve Department Refill Request',
    category: 'Department Refill & Delivery',
  },
  {
    code: 'prepare_department_refill',
    name: 'Prepare Department Refill',
    category: 'Department Refill & Delivery',
  },
  {
    code: 'confirm_department_delivery',
    name: 'Confirm Department Delivery',
    category: 'Department Refill & Delivery',
  },

  { code: 'view_inventory', name: 'View Inventory', category: 'Inventory' },
  {
    code: 'transfer_inventory',
    name: 'Transfer Inventory',
    category: 'Inventory',
  },
  {
    code: 'perform_inventory_adjustment',
    name: 'Perform Inventory Adjustment',
    category: 'Inventory',
  },
  {
    code: 'perform_stock_count',
    name: 'Perform Stock Count',
    category: 'Inventory',
  },

  { code: 'add_patient', name: 'Add Patient', category: 'Patients & Queue' },
  {
    code: 'view_patient_history',
    name: 'View Patient History',
    category: 'Patients & Queue',
  },
  {
    code: 'manage_department_queue',
    name: 'Manage Department Queue',
    category: 'Patients & Queue',
  },

  {
    code: 'start_consultation',
    name: 'Start Consultation',
    category: 'Clinical',
  },
  {
    code: 'create_prescription',
    name: 'Create Prescription',
    category: 'Clinical',
  },
  {
    code: 'renew_prescription',
    name: 'Renew Prescription',
    category: 'Clinical',
  },
  {
    code: 'cancel_prescription',
    name: 'Cancel Prescription',
    category: 'Clinical',
  },

  {
    code: 'dispense_prescription',
    name: 'Dispense Prescription',
    category: 'Pharmacy',
  },

  { code: 'view_reports', name: 'View Reports', category: 'Reporting & AI' },
  {
    code: 'view_ai_insights',
    name: 'View AI Insights',
    category: 'Reporting & AI',
  },
  {
    code: 'review_ai_insights',
    name: 'Review AI Insights',
    category: 'Reporting & AI',
  },
];

const roleDefinitions: {
  name: string;
  description: string;
  permissions: string[];
}[] = [
  {
    name: 'hospital_manager',
    description:
      'Fixed master account. Always has every permission that exists -- role_permissions below are informational only and are never actually consulted.',
    permissions: [
      'manage_departments',
      'manage_accounts',
      'manage_roles',
      'manage_user_permissions',
      'manage_doctors',
      'approve_purchase_request_hospital',
      'approve_department_refill_request',
      'view_inventory',
      'view_purchasing_history',
      'view_purchasing_reports',
      'view_reports',
      'view_ai_insights',
      'review_ai_insights',
    ],
  },
  {
    name: 'warehouse_manager',
    description:
      'Full control over the central warehouse: materials, suppliers, purchasing, and stock.',
    permissions: [
      'manage_materials',
      'manage_department_materials',
      'manage_units',
      'manage_categories',
      'manage_suppliers',
      'manage_material_suppliers',
      'create_purchase_request',
      'receive_purchase',
      'view_purchasing_history',
      'view_inventory',
      'transfer_inventory',
      'perform_inventory_adjustment',
      'perform_stock_count',
      'prepare_department_refill',
      'view_reports',
    ],
  },
  {
    name: 'purchasing_committee_manager',
    description:
      'Reviews and approves purchase requests forwarded by the Hospital Manager.',
    permissions: [
      'approve_purchase_request_committee',
      'manage_purchase_orders',
      'view_purchasing_history',
      'view_purchasing_reports',
      'manage_material_suppliers',
    ],
  },
  {
    name: 'department_manager',
    description:
      "Manages a single department's inventory, refill requests, and deliveries.",
    permissions: [
      'create_department_refill_request',
      'confirm_department_delivery',
      'view_inventory',
      'perform_inventory_adjustment',
      'manage_department_queue',
    ],
  },
  {
    name: 'reception_staff',
    description: 'Registers patients and manages the department queue.',
    permissions: [
      'add_patient',
      'view_patient_history',
      'manage_department_queue',
    ],
  },
  {
    name: 'doctor',
    description: 'Conducts consultations and manages prescriptions.',
    permissions: [
      'start_consultation',
      'create_prescription',
      'renew_prescription',
      'cancel_prescription',
      'view_patient_history',
    ],
  },
  {
    name: 'pharmacy_staff',
    description: 'Manages pharmacy inventory and dispenses prescriptions.',
    permissions: [
      'view_inventory',
      'manage_department_materials',
      'create_department_refill_request',
      'confirm_department_delivery',
      'perform_inventory_adjustment',
      'dispense_prescription',
    ],
  },
];

async function seedPermissions() {
  console.log('Seeding permissions...');
  for (const perm of permissionCatalog) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, category: perm.category },
      create: perm,
    });
  }
}

async function seedRoles() {
  console.log('Seeding roles + role_permissions...');
  for (const roleDef of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { description: roleDef.description },
      create: {
        name: roleDef.name,
        description: roleDef.description,
        isSystem: true,
      },
    });

    for (const code of roleDef.permissions) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { code },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
}

async function seedDepartments() {
  console.log('Seeding core departments...');
  const warehouse = await prisma.department.upsert({
    where: { name: 'Central Warehouse' },
    update: {},
    create: { name: 'Central Warehouse', type: 'central_warehouse' },
  });

  const pharmacy = await prisma.department.upsert({
    where: { name: 'Pharmacy' },
    update: {},
    create: { name: 'Pharmacy', type: 'pharmacy' },
  });

  const emergency = await prisma.department.upsert({
    where: { name: 'Emergency' },
    update: {},
    create: { name: 'Emergency', type: 'standard' },
  });

  return { warehouse, pharmacy, emergency };
}

async function seedBootstrapAdmin() {
  console.log('Seeding the fixed Hospital Manager master account...');
  const hospitalManagerRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'hospital_manager' },
  });

  const phone = process.env.SEED_ADMIN_PHONE;
  const email = process.env.SEED_ADMIN_EMAIL;
  const fullName = process.env.SEED_ADMIN_FULL_NAME ?? 'System Administrator';

  if (!phone && !email) {
    throw new Error(
      'Set SEED_ADMIN_PHONE and/or SEED_ADMIN_EMAIL in .env before seeding.',
    );
  }

  const existing = await prisma.user.findFirst({
    where: { roleId: hospitalManagerRole.id },
  });
  if (existing) {
    console.log('Hospital Manager already exists, skipping.');
    return existing;
  }

  return prisma.user.create({
    data: {
      fullName,
      phone,
      email,
      roleId: hospitalManagerRole.id,
      status: 'active',
    },
  });
}

interface TestAccountSeed {
  roleName: string;
  fullName: string;
  phone: string;
  departmentId?: string;
  specialty?: string;
}

async function seedTestAccounts(departments: {
  warehouse: { id: string };
  pharmacy: { id: string };
  emergency: { id: string };
}) {
  console.log('Seeding two test accounts per role...');

  const roleNames = [
    'warehouse_manager',
    'purchasing_committee_manager',
    'department_manager',
    'reception_staff',
    'doctor',
    'pharmacy_staff',
  ];

  const roles = await prisma.role.findMany({
    where: { name: { in: roleNames } },
  });
  const roleMap = new Map(roles.map((r) => [r.name, r]));

  const accounts: TestAccountSeed[] = [
    {
      roleName: 'warehouse_manager',
      fullName: 'Omar Al-Khatib',
      phone: '+963900000101',
      departmentId: departments.warehouse.id,
    },
    {
      roleName: 'warehouse_manager',
      fullName: 'Rania Sabbagh',
      phone: '+963900000102',
      departmentId: departments.warehouse.id,
    },

    {
      roleName: 'purchasing_committee_manager',
      fullName: 'Khaled Mansour',
      phone: '+963900000201',
    },
    {
      roleName: 'purchasing_committee_manager',
      fullName: 'Nour Halabi',
      phone: '+963900000202',
    },

    {
      roleName: 'department_manager',
      fullName: 'Samer Aziz',
      phone: '+963900000301',
      departmentId: departments.emergency.id,
    },
    {
      roleName: 'department_manager',
      fullName: 'Lubna Farouk',
      phone: '+963900000302',
      departmentId: departments.emergency.id,
    },

    {
      roleName: 'reception_staff',
      fullName: 'Maya Deeb',
      phone: '+963900000401',
      departmentId: departments.emergency.id,
    },
    {
      roleName: 'reception_staff',
      fullName: 'Fadi Haddad',
      phone: '+963900000402',
      departmentId: departments.emergency.id,
    },

    {
      roleName: 'doctor',
      fullName: 'Dr. Ahmad Youssef',
      phone: '+963900000501',
      departmentId: departments.emergency.id,
      specialty: 'Internal Medicine',
    },
    {
      roleName: 'doctor',
      fullName: 'Dr. Sara Khalil',
      phone: '+963900000502',
      departmentId: departments.emergency.id,
      specialty: 'Pediatrics',
    },

    {
      roleName: 'pharmacy_staff',
      fullName: 'Hiba Qasim',
      phone: '+963900000601',
      departmentId: departments.pharmacy.id,
    },
    {
      roleName: 'pharmacy_staff',
      fullName: "Tariq Nu'man",
      phone: '+963900000602',
      departmentId: departments.pharmacy.id,
    },
  ];

  for (const acc of accounts) {
    const role = roleMap.get(acc.roleName);
    if (!role)
      throw new Error(
        `Role "${acc.roleName}" not found -- did seedRoles() run first?`,
      );

    await prisma.user.upsert({
      where: { phone: acc.phone },
      update: {},
      create: {
        fullName: acc.fullName,
        phone: acc.phone,
        roleId: role.id,
        departmentId: acc.departmentId,
        specialty: acc.specialty,
        status: 'active',
      },
    });
  }
}

async function main() {
  await seedPermissions();
  await seedRoles();
  const departments = await seedDepartments();
  await seedBootstrapAdmin();
  await seedTestAccounts(departments);
  console.log(
    'Seeding complete: 1 Hospital Manager + 12 test accounts (2 per role) across 3 departments.',
  );
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
