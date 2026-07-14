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
      'Manages hospital structure, department managers, and approves operational requests.',
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

  return { warehouse, pharmacy };
}

async function seedBootstrapAdmin() {
  console.log('Seeding bootstrap Hospital Manager...');
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
    where: {
      OR: [{ phone: phone ?? undefined }, { email: email ?? undefined }],
    },
  });

  if (existing) {
    console.log('Bootstrap admin already exists, skipping.');
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

async function main() {
  await seedPermissions();
  await seedRoles();
  await seedDepartments();
  await seedBootstrapAdmin();
  console.log('Seeding complete.');
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
