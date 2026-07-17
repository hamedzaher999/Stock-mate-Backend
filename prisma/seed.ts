import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// =========================================================
// 1. PERMISSIONS CATALOG
// =========================================================
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
      'Fixed master account. Always has every permission that exists.',
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
      'perform_stock_count',
      'manage_department_queue',
    ],
  },
  {
    name: 'reception_staff',
    description:
      'Registers patients and manages department queues hospital-wide.',
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
      'perform_stock_count',
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

// =========================================================
// 2. DEPARTMENTS -- Department.name IS @unique, so upsert-by-name works here.
// =========================================================
async function seedDepartments() {
  console.log('Seeding departments...');
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
  const hr = await prisma.department.upsert({
    where: { name: 'Human Resources' },
    update: {},
    create: { name: 'Human Resources', type: 'standard' },
  });
  return { warehouse, pharmacy, emergency, hr };
}

// =========================================================
// 3. HOSPITAL MANAGER (fixed master account) + NAMED TEST ACCOUNTS
// =========================================================
async function seedBootstrapAdmin() {
  console.log('Seeding the fixed Hospital Manager master account...');
  const role = await prisma.role.findUniqueOrThrow({
    where: { name: 'hospital_manager' },
  });
  const phone = process.env.SEED_ADMIN_PHONE ?? '+963900000000';
  const email = process.env.SEED_ADMIN_EMAIL ?? 'hassanmohammad0010@gmail.com';
  const fullName = process.env.SEED_ADMIN_FULL_NAME ?? 'Hassan Mohammad';

  return prisma.user.upsert({
    where: { phone },
    update: { email },
    create: { fullName, phone, email, roleId: role.id, status: 'active' },
  });
}

interface TestAccountSeed {
  roleName: string;
  fullName: string;
  phone: string;
  email?: string;
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

  // Named test accounts carry real Gmail addresses (Gmail SMTP delivers to
  // any recipient, unlike Resend's sandbox restriction) so each can be
  // logged into directly for testing. Reception is deliberately department-
  // less -- it's a hospital-wide role, not tied to one department.
  const accounts: TestAccountSeed[] = [
    {
      roleName: 'warehouse_manager',
      fullName: 'Hamed Zaher',
      phone: '+963900000101',
      email: 'hamedzaher.dev@gmail.com',
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
      fullName: 'Ghazi Hijazi',
      phone: '+963900000201',
      email: 'ghj8919@gmail.com',
    },
    {
      roleName: 'purchasing_committee_manager',
      fullName: 'Nour Halabi',
      phone: '+963900000202',
    },

    {
      roleName: 'department_manager',
      fullName: 'Bashar Mansour',
      phone: '+963900000301',
      email: 'basharman2003@gmail.com',
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
    },
    {
      roleName: 'reception_staff',
      fullName: 'Fadi Haddad',
      phone: '+963900000402',
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
      fullName: 'Basma Awad',
      phone: '+963900000601',
      email: '0938825359b@gmail.com',
      departmentId: departments.pharmacy.id,
    },
    {
      roleName: 'pharmacy_staff',
      fullName: "Tariq Nu'man",
      phone: '+963900000602',
      departmentId: departments.pharmacy.id,
    },
  ];

  const createdUsers = new Map<string, { id: string }>();
  for (const acc of accounts) {
    const role = roleMap.get(acc.roleName);
    if (!role) throw new Error(`Role "${acc.roleName}" not found.`);

    const user = await prisma.user.upsert({
      where: { phone: acc.phone },
      update: { email: acc.email },
      create: {
        fullName: acc.fullName,
        phone: acc.phone,
        email: acc.email,
        roleId: role.id,
        departmentId: acc.departmentId,
        specialty: acc.specialty,
        status: 'active',
      },
    });
    createdUsers.set(acc.phone, user);
  }
  return createdUsers;
}

// =========================================================
// 4. PERMISSION OVERRIDES
//    a) Hamed Zaher (warehouse_manager) gets every catalog permission
//       granted as an individual override -- functionally full access,
//       without becoming a second Hospital Manager (which is blocked).
//    b) One ordinary grant/revoke pair, kept from the earlier demo.
// =========================================================
async function seedPermissionOverrides(
  users: Map<string, { id: string }>,
  adminId: string,
) {
  console.log('Seeding user permission overrides...');

  const hamed = users.get('+963900000101')!; // warehouse_manager -- gets full access via overrides
  const allPermissions = await prisma.permission.findMany();

  for (const permission of allPermissions) {
    await prisma.userPermission.upsert({
      where: {
        userId_permissionId: { userId: hamed.id, permissionId: permission.id },
      },
      update: { effect: 'grant' },
      create: {
        userId: hamed.id,
        permissionId: permission.id,
        effect: 'grant',
        grantedById: adminId,
        reason: 'Full-access test account for development.',
      },
    });
  }

  const grantPerm = await prisma.permission.findUniqueOrThrow({
    where: { code: 'view_reports' },
  });
  const revokePerm = await prisma.permission.findUniqueOrThrow({
    where: { code: 'perform_inventory_adjustment' },
  });

  const bashar = users.get('+963900000301')!; // department_manager -- granted extra reporting visibility
  const basma = users.get('+963900000601')!; // pharmacy_staff -- revoked pending a review

  await prisma.userPermission.upsert({
    where: {
      userId_permissionId: { userId: bashar.id, permissionId: grantPerm.id },
    },
    update: {},
    create: {
      userId: bashar.id,
      permissionId: grantPerm.id,
      effect: 'grant',
      grantedById: adminId,
      reason: 'Covering weekly reporting duties for the Hospital Manager.',
    },
  });

  await prisma.userPermission.upsert({
    where: {
      userId_permissionId: { userId: basma.id, permissionId: revokePerm.id },
    },
    update: {},
    create: {
      userId: basma.id,
      permissionId: revokePerm.id,
      effect: 'revoke',
      grantedById: adminId,
      reason: 'Temporarily restricted pending review of a discrepancy.',
    },
  });
}

// =========================================================
// 5. SUPPLIERS -- Supplier.name is NOT unique in the schema
//    (app-level uniqueness only, via suppliers.service.ts), so we
//    look up by name manually instead of upserting on it.
// =========================================================
async function seedSuppliers() {
  console.log('Seeding suppliers...');

  let alShifa = await prisma.supplier.findFirst({
    where: { name: 'Al-Shifa Medical Supplies' },
  });
  if (!alShifa) {
    alShifa = await prisma.supplier.create({
      data: {
        name: 'Al-Shifa Medical Supplies',
        phone: '+963112345678',
        email: 'sales@alshifa-medical.com',
        address: 'Mazzeh Highway, Damascus',
      },
    });
  }

  let damascusPharma = await prisma.supplier.findFirst({
    where: { name: 'Damascus Pharma Distribution' },
  });
  if (!damascusPharma) {
    damascusPharma = await prisma.supplier.create({
      data: {
        name: 'Damascus Pharma Distribution',
        phone: '+963112349999',
        email: 'orders@damascuspharma.sy',
        address: 'Baramkeh, Damascus',
      },
    });
  }

  return { alShifa, damascusPharma };
}

// =========================================================
// 6. CATALOG -- Unit.name and Category.name are also NOT unique
//    in the schema, so the same findFirst-then-create pattern
//    applies here too. ProductVariant.sku IS unique, so that one
//    can safely use upsert.
// =========================================================
async function seedCatalog(
  adminId: string,
  suppliers: { alShifa: { id: string }; damascusPharma: { id: string } },
) {
  console.log('Seeding catalog (units, categories, products, variants)...');

  let boxUnit = await prisma.unit.findFirst({ where: { name: 'Box of 100' } });
  if (!boxUnit)
    boxUnit = await prisma.unit.create({
      data: { name: 'Box of 100', abbreviation: 'box100' },
    });

  let stripUnit = await prisma.unit.findFirst({
    where: { name: 'Strip of 20' },
  });
  if (!stripUnit)
    stripUnit = await prisma.unit.create({
      data: { name: 'Strip of 20', abbreviation: 'strip20' },
    });

  (await prisma.unit.findFirst({ where: { name: 'Piece' } })) ??
    (await prisma.unit.create({ data: { name: 'Piece', abbreviation: 'pc' } }));

  let analgesics = await prisma.category.findFirst({
    where: { name: 'Analgesics' },
  });
  if (!analgesics)
    analgesics = await prisma.category.create({ data: { name: 'Analgesics' } });

  let ppe = await prisma.category.findFirst({
    where: { name: 'Personal Protective Equipment' },
  });
  if (!ppe)
    ppe = await prisma.category.create({
      data: { name: 'Personal Protective Equipment' },
    });

  let paracetamol = await prisma.product.findFirst({
    where: { name: 'Paracetamol 500mg' },
  });
  if (!paracetamol) {
    paracetamol = await prisma.product.create({
      data: {
        name: 'Paracetamol 500mg',
        categoryId: analgesics.id,
        materialType: 'consumable',
        description: 'Standard analgesic and antipyretic tablet.',
        createdById: adminId,
      },
    });
  }

  let gloves = await prisma.product.findFirst({
    where: { name: 'Surgical Gloves (Latex)' },
  });
  if (!gloves) {
    gloves = await prisma.product.create({
      data: {
        name: 'Surgical Gloves (Latex)',
        categoryId: ppe.id,
        materialType: 'consumable',
        description: 'Sterile latex surgical gloves.',
        createdById: adminId,
      },
    });
  }

  const paracetamolVariant = await prisma.productVariant.upsert({
    where: { sku: 'PARA500-STRIP20' },
    update: {},
    create: {
      productId: paracetamol.id,
      variantName: 'Strip of 20 tablets',
      sku: 'PARA500-STRIP20',
      unitId: stripUnit.id,
      createdById: adminId,
    },
  });
  const glovesVariant = await prisma.productVariant.upsert({
    where: { sku: 'GLOVES-M-BOX100' },
    update: {},
    create: {
      productId: gloves.id,
      variantName: 'Size M, Box of 100',
      sku: 'GLOVES-M-BOX100',
      unitId: boxUnit.id,
      createdById: adminId,
    },
  });

  await prisma.variantSupplier.upsert({
    where: {
      variantId_supplierId: {
        variantId: paracetamolVariant.id,
        supplierId: suppliers.alShifa.id,
      },
    },
    update: {},
    create: {
      variantId: paracetamolVariant.id,
      supplierId: suppliers.alShifa.id,
      expectedPurchasePrice: 0.15,
      supplierProductCode: 'ASM-PARA-20',
      isPreferred: true,
    },
  });
  await prisma.variantSupplier.upsert({
    where: {
      variantId_supplierId: {
        variantId: glovesVariant.id,
        supplierId: suppliers.damascusPharma.id,
      },
    },
    update: {},
    create: {
      variantId: glovesVariant.id,
      supplierId: suppliers.damascusPharma.id,
      expectedPurchasePrice: 4.5,
      supplierProductCode: 'DPD-GLV-M',
      isPreferred: true,
    },
  });

  return { paracetamolVariant, glovesVariant };
}

// =========================================================
// 7. STOCK SETTINGS -- Warehouse, Pharmacy, Emergency only.
//    HR intentionally has none -- no stock tracked there yet.
// =========================================================
async function seedStockSettings(
  adminId: string,
  departments: {
    warehouse: { id: string };
    pharmacy: { id: string };
    emergency: { id: string };
  },
  variants: {
    paracetamolVariant: { id: string };
    glovesVariant: { id: string };
  },
) {
  console.log('Seeding stock settings (Warehouse, Pharmacy, Emergency)...');

  await prisma.departmentStockSetting.upsert({
    where: {
      variantId_departmentId: {
        variantId: variants.paracetamolVariant.id,
        departmentId: departments.warehouse.id,
      },
    },
    update: {},
    create: {
      variantId: variants.paracetamolVariant.id,
      departmentId: departments.warehouse.id,
      storageLocation: 'Warehouse Shelf B12',
      minimumStock: 200,
      maximumStock: 2000,
      createdById: adminId,
    },
  });
  await prisma.departmentStockSetting.upsert({
    where: {
      variantId_departmentId: {
        variantId: variants.glovesVariant.id,
        departmentId: departments.warehouse.id,
      },
    },
    update: {},
    create: {
      variantId: variants.glovesVariant.id,
      departmentId: departments.warehouse.id,
      storageLocation: 'Warehouse Shelf C04',
      minimumStock: 50,
      maximumStock: 500,
      createdById: adminId,
    },
  });
  await prisma.departmentStockSetting.upsert({
    where: {
      variantId_departmentId: {
        variantId: variants.paracetamolVariant.id,
        departmentId: departments.pharmacy.id,
      },
    },
    update: {},
    create: {
      variantId: variants.paracetamolVariant.id,
      departmentId: departments.pharmacy.id,
      storageLocation: 'Pharmacy Cabinet 3',
      minimumStock: 100,
      maximumStock: 800,
      createdById: adminId,
    },
  });
  await prisma.departmentStockSetting.upsert({
    where: {
      variantId_departmentId: {
        variantId: variants.paracetamolVariant.id,
        departmentId: departments.emergency.id,
      },
    },
    update: {},
    create: {
      variantId: variants.paracetamolVariant.id,
      departmentId: departments.emergency.id,
      storageLocation: 'ER Supply Closet',
      minimumStock: 30,
      maximumStock: 200,
      createdById: adminId,
    },
  });
}

// =========================================================
// 8. PURCHASING -- request -> order -> receipt -> batch
// =========================================================
async function seedPurchasingFlow(
  warehouseManagerId: string,
  hospitalManagerId: string,
  committeeManagerId: string,
  departments: { warehouse: { id: string } },
  suppliers: { alShifa: { id: string } },
  variants: { paracetamolVariant: { id: string } },
) {
  console.log(
    'Seeding purchasing flow (request -> order -> receipt -> batch)...',
  );

  const pr = await prisma.purchaseRequest.upsert({
    where: { requestNumber: 'PR-DEMO-0001' },
    update: {},
    create: {
      requestNumber: 'PR-DEMO-0001',
      requestedById: warehouseManagerId,
      status: 'ready_for_receiving',
      hospitalApprovedById: hospitalManagerId,
      hospitalApprovedAt: new Date(),
      committeeApprovedById: committeeManagerId,
      committeeApprovedAt: new Date(),
      committeeMarkedReadyById: committeeManagerId,
      committeeMarkedReadyAt: new Date(),
      notes: 'Routine Q3 restock for Paracetamol.',
      items: {
        create: [
          {
            variantId: variants.paracetamolVariant.id,
            requestedQuantity: 500,
            estimatedPrice: 0.15,
            committeeApprovedQuantity: 500,
          },
        ],
      },
    },
    include: { items: true },
  });
  const prItem = pr.items[0];

  const po = await prisma.purchaseOrder.upsert({
    where: { orderNumber: 'PO-DEMO-0001' },
    update: {},
    create: {
      orderNumber: 'PO-DEMO-0001',
      purchaseRequestId: pr.id,
      supplierId: suppliers.alShifa.id,
      status: 'sent',
      createdById: committeeManagerId,
      orderedAt: new Date(),
      items: {
        create: [
          {
            purchaseRequestItemId: prItem.id,
            variantId: variants.paracetamolVariant.id,
            orderedQuantity: 500,
            unitPrice: 0.15,
          },
        ],
      },
    },
    include: { items: true },
  });
  const poItem = po.items[0];

  const existingReceipt = await prisma.purchaseReceipt.findFirst({
    where: { purchaseOrderId: po.id },
  });
  if (!existingReceipt) {
    const receipt = await prisma.purchaseReceipt.create({
      data: {
        purchaseOrderId: po.id,
        purchaseRequestId: pr.id,
        receivedById: warehouseManagerId,
        receivingDate: new Date(),
        notes: 'Full shipment arrived on schedule.',
      },
    });

    const receiptItem = await prisma.purchaseReceiptItem.create({
      data: {
        purchaseReceiptId: receipt.id,
        purchaseOrderItemId: poItem.id,
        variantId: variants.paracetamolVariant.id,
        supplierId: suppliers.alShifa.id,
        expectedQuantity: 500,
        quantity: 480,
        quantityDiscrepancy: 20,
        purchasePrice: 0.15,
        batchNumber: 'BATCH-PARA500-2026-07',
        manufacturingDate: new Date('2026-01-15'),
        expirationDate: new Date('2028-01-15'),
      },
    });

    const batch = await prisma.batch.create({
      data: {
        purchaseReceiptItemId: receiptItem.id,
        variantId: variants.paracetamolVariant.id,
        supplierId: suppliers.alShifa.id,
        batchNumber: 'BATCH-PARA500-2026-07',
        quantityReceived: 480,
        purchasePrice: 0.15,
        manufacturingDate: new Date('2026-01-15'),
        expirationDate: new Date('2028-01-15'),
        receivingDate: new Date(),
        createdById: warehouseManagerId,
      },
    });

    await prisma.batchStock.create({
      data: {
        batchId: batch.id,
        departmentId: departments.warehouse.id,
        quantity: 480,
      },
    });

    await prisma.inventoryTransaction.create({
      data: {
        transactionType: 'purchase_receipt',
        variantId: variants.paracetamolVariant.id,
        batchId: batch.id,
        departmentId: departments.warehouse.id,
        quantity: 480,
        balanceAfter: 480,
        referenceType: 'purchase_receipt',
        referenceId: receipt.id,
        performedById: warehouseManagerId,
      },
    });

    await prisma.purchaseOrderItem.update({
      where: { id: poItem.id },
      data: { receivedQuantity: 480 },
    });
    await prisma.purchaseRequestItem.update({
      where: { id: prItem.id },
      data: { receivedQuantity: 480 },
    });
    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: 'partially_received' },
    });
    await prisma.purchaseRequest.update({
      where: { id: pr.id },
      data: { status: 'partially_received' },
    });

    return batch;
  }

  return prisma.batch.findFirstOrThrow({
    where: { batchNumber: 'BATCH-PARA500-2026-07' },
  });
}

// =========================================================
// 9. DEPARTMENT REFILL -- request -> deliver -> confirm
// =========================================================
async function seedRefillFlow(
  departmentManagerId: string,
  hospitalManagerId: string,
  warehouseManagerId: string,
  departments: { warehouse: { id: string }; emergency: { id: string } },
  variants: { paracetamolVariant: { id: string } },
  batch: { id: string },
) {
  console.log('Seeding refill flow (request -> deliver -> confirm)...');

  const existingRefill = await prisma.departmentRefillRequest.findUnique({
    where: { requestNumber: 'DRF-DEMO-0001' },
  });
  if (existingRefill) return;

  const refill = await prisma.departmentRefillRequest.create({
    data: {
      requestNumber: 'DRF-DEMO-0001',
      departmentId: departments.emergency.id,
      requestedById: departmentManagerId,
      status: 'ready_for_delivery',
      hospitalApprovedById: hospitalManagerId,
      hospitalApprovedAt: new Date(),
      notes: 'Weekly restock for the ER supply closet.',
      items: {
        create: [
          {
            variantId: variants.paracetamolVariant.id,
            requestedQuantity: 100,
            preparedQuantity: 100,
          },
        ],
      },
    },
    include: { items: true },
  });
  const refillItem = refill.items[0];

  const delivery = await prisma.departmentRefillDelivery.create({
    data: {
      refillRequestId: refill.id,
      deliveredById: warehouseManagerId,
      notes: 'Shipped via internal transport.',
    },
  });

  await prisma.departmentRefillDeliveryItem.create({
    data: {
      deliveryId: delivery.id,
      refillItemId: refillItem.id,
      batchId: batch.id,
      shippedQuantity: 100,
      receivedQuantity: 95,
      quantityDiscrepancy: 5,
    },
  });

  await prisma.batchStock.updateMany({
    where: { batchId: batch.id, departmentId: departments.warehouse.id },
    data: { quantity: { decrement: 100 } },
  });

  await prisma.inventoryTransaction.create({
    data: {
      transactionType: 'department_transfer_out',
      variantId: variants.paracetamolVariant.id,
      batchId: batch.id,
      departmentId: departments.warehouse.id,
      quantity: -100,
      balanceAfter: 380,
      referenceType: 'refill_request',
      referenceId: refill.id,
      performedById: warehouseManagerId,
    },
  });

  await prisma.departmentRefillDelivery.update({
    where: { id: delivery.id },
    data: { receivedById: departmentManagerId, confirmedAt: new Date() },
  });

  await prisma.departmentRefillItem.update({
    where: { id: refillItem.id },
    data: { deliveredQuantity: 95, quantityDiscrepancy: 5 },
  });

  await prisma.departmentInventory.upsert({
    where: {
      departmentId_variantId: {
        departmentId: departments.emergency.id,
        variantId: variants.paracetamolVariant.id,
      },
    },
    update: {
      currentQuantity: 95,
      lastRefillQuantity: 95,
      lastRefillDate: new Date(),
    },
    create: {
      departmentId: departments.emergency.id,
      variantId: variants.paracetamolVariant.id,
      currentQuantity: 95,
      lastRefillQuantity: 95,
      lastRefillDate: new Date(),
    },
  });

  await prisma.departmentRefillRequest.update({
    where: { id: refill.id },
    data: { status: 'delivered' },
  });
}

// =========================================================
// 10. ONE ADJUSTMENT + ONE STOCK COUNT SESSION (Warehouse)
// =========================================================
async function seedAdjustmentAndStockCount(
  warehouseManagerId: string,
  departments: { warehouse: { id: string } },
  variants: { paracetamolVariant: { id: string } },
  batch: { id: string },
) {
  console.log('Seeding one adjustment + one stock count session...');

  const existingAdjustment = await prisma.inventoryAdjustment.findFirst({
    where: { batchId: batch.id, adjustmentType: 'damaged' },
  });
  if (!existingAdjustment) {
    await prisma.inventoryAdjustment.create({
      data: {
        variantId: variants.paracetamolVariant.id,
        departmentId: departments.warehouse.id,
        batchId: batch.id,
        adjustmentType: 'damaged',
        quantity: 5,
        notes: 'Water damage discovered during shelving.',
        reportedById: warehouseManagerId,
      },
    });
    await prisma.batchStock.updateMany({
      where: { batchId: batch.id, departmentId: departments.warehouse.id },
      data: { quantity: { decrement: 5 } },
    });
    await prisma.inventoryTransaction.create({
      data: {
        transactionType: 'adjustment_damaged',
        variantId: variants.paracetamolVariant.id,
        batchId: batch.id,
        departmentId: departments.warehouse.id,
        quantity: -5,
        balanceAfter: 375,
        referenceType: 'adjustment',
        performedById: warehouseManagerId,
      },
    });
  }

  const existingSession = await prisma.stockCountSession.findFirst({
    where: { departmentId: departments.warehouse.id },
  });
  if (!existingSession) {
    await prisma.stockCountSession.create({
      data: {
        departmentId: departments.warehouse.id,
        initiatedById: warehouseManagerId,
        status: 'completed',
        countDate: new Date(),
        completedAt: new Date(),
        notes: 'Monthly physical count.',
        items: {
          create: [
            {
              variantId: variants.paracetamolVariant.id,
              batchId: batch.id,
              expectedQuantity: 375,
              countedQuantity: 373,
              variance: -2,
              notes: 'Two units unaccounted for.',
            },
          ],
        },
      },
    });
  }
}

// =========================================================
// 11. PATIENTS -- one per identifier type
// =========================================================
async function seedPatients(receptionUserId: string) {
  console.log(
    'Seeding patients (nationalId, shared familyBookNumber, patientId fallback)...',
  );

  const withNationalId = await prisma.patient.upsert({
    where: { nationalId: '01234567890' },
    update: {},
    create: {
      fullName: 'Yusuf Al-Homsi',
      nationalId: '01234567890',
      registeredById: receptionUserId,
    },
  });

  const child1 = await prisma.patient.findFirst({
    where: { fullName: 'Layan Al-Homsi' },
  });
  if (!child1) {
    await prisma.patient.create({
      data: {
        fullName: 'Layan Al-Homsi',
        familyBookNumber: '400512233',
        registeredById: receptionUserId,
      },
    });
  }
  const child2 = await prisma.patient.findFirst({
    where: { fullName: 'Tarek Al-Homsi' },
  });
  if (!child2) {
    await prisma.patient.create({
      data: {
        fullName: 'Tarek Al-Homsi',
        familyBookNumber: '400512233',
        registeredById: receptionUserId,
      },
    });
  }

  await prisma.patient.upsert({
    where: { patientId: 'PT-DEMO-0001' },
    update: {},
    create: {
      fullName: 'Unidentified Patient (Jane Doe)',
      patientId: 'PT-DEMO-0001',
      registeredById: receptionUserId,
    },
  });

  return { withNationalId };
}

// =========================================================
// 12. DEPARTMENT QUEUE -- one waiting patient at Emergency
// =========================================================
async function seedQueue(
  receptionUserId: string,
  departments: { emergency: { id: string } },
  patient: { id: string },
) {
  console.log('Seeding one queue entry at Emergency...');

  const existing = await prisma.departmentQueue.findFirst({
    where: {
      departmentId: departments.emergency.id,
      patientId: patient.id,
      status: { in: ['waiting', 'in_consultation'] },
    },
  });
  if (!existing) {
    await prisma.departmentQueue.create({
      data: {
        departmentId: departments.emergency.id,
        patientId: patient.id,
        addedById: receptionUserId,
      },
    });
  }
}

// =========================================================
// MAIN
// =========================================================
async function main() {
  await seedPermissions();
  await seedRoles();

  const departments = await seedDepartments();
  const admin = await seedBootstrapAdmin();
  const users = await seedTestAccounts(departments);
  await seedPermissionOverrides(users, admin.id);

  const suppliers = await seedSuppliers();
  const variants = await seedCatalog(admin.id, suppliers);
  await seedStockSettings(admin.id, departments, variants);

  const warehouseManager = users.get('+963900000101')!; // Hamed Zaher
  const departmentManager = users.get('+963900000301')!; // Bashar Mansour
  const committeeManager = users.get('+963900000201')!; // Ghazi Hijazi
  const reception = users.get('+963900000401')!;

  const batch = await seedPurchasingFlow(
    warehouseManager.id,
    admin.id,
    committeeManager.id,
    departments,
    suppliers,
    variants,
  );
  await seedRefillFlow(
    departmentManager.id,
    admin.id,
    warehouseManager.id,
    departments,
    variants,
    batch,
  );
  await seedAdjustmentAndStockCount(
    warehouseManager.id,
    departments,
    variants,
    batch,
  );

  const patients = await seedPatients(reception.id);
  await seedQueue(reception.id, departments, patients.withNationalId);

  console.log('\nSeeding complete:');
  console.log('- Hospital Manager: hassanmohammad0010@gmail.com');
  console.log(
    '- Warehouse Manager (full access via overrides): hamedzaher.dev@gmail.com',
  );
  console.log('- Purchasing Committee Manager: ghj8919@gmail.com');
  console.log('- Department Manager: basharman2003@gmail.com');
  console.log('- Pharmacy Staff: 0938825359b@gmail.com');
  console.log('- 4 departments (incl. dynamic HR with no stock settings)');
  console.log(
    '- Full purchasing flow, refill flow, 1 adjustment, 1 stock count',
  );
  console.log('- 3 patients, 1 queue entry');
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
