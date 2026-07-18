/**
 * prisma/seed.ts
 *
 * Fills every table in the schema with a handful of rows (at least 3 where
 * it makes sense) so you can exercise every endpoint end-to-end.
 *
 * Run with:   npx prisma db seed
 * (add to package.json:  "prisma": { "seed": "ts-node prisma/seed.ts" })
 *
 * NOTE: this is throwaway dev/test data. It talks to Prisma directly (not
 * through the Nest services), so a few business-rule side effects that
 * normally live in the service layer (cache invalidation, etc.) are
 * replicated by hand only where they affect what you'll see through the API.
 *
 * The script is idempotent-guarded: if roles already exist it exits early
 * so you don't get duplicate-key errors on a second run. Reset your DB
 * (npx prisma migrate reset) if you want to reseed from scratch.
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);
const otpHash = (code: string) => bcrypt.hashSync(code, 10);
const tokenHash = (label: string) =>
    require('crypto').createHash('sha256').update(label).digest('hex');

// ---------------------------------------------------------------------------
// static catalogs
// ---------------------------------------------------------------------------

const PERMISSIONS: { code: string; name: string; category: string }[] = [
    // Administration
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
    // Materials & Suppliers
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
    // Purchasing
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
    // Department Refill & Delivery
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
    // Inventory
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
    // Patients & Queue
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
    // Clinical
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
        code: 'manage_all_prescriptions',
        name: 'Manage All Prescriptions',
        category: 'Clinical',
    },
    // Pharmacy
    {
        code: 'dispense_prescription',
        name: 'Dispense Prescription',
        category: 'Pharmacy',
    },
    // Reporting & AI
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
    // Periodic
    {
        code: 'manage_periodic_refill_schedules',
        name: 'Manage Periodic Refill Schedules',
        category: 'Department Refill & Delivery',
    },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
    // hospital_manager intentionally omitted -- the resolver grants it every
    // permission automatically and the app blocks editing its role_permissions.
    warehouse_manager: [
        'manage_materials',
        'manage_department_materials',
        'manage_units',
        'manage_categories',
        'manage_suppliers',
        'manage_material_suppliers',
        'create_purchase_request',
        'manage_purchase_orders',
        'receive_purchase',
        'view_purchasing_history',
        'view_purchasing_reports',
        'prepare_department_refill',
        'view_inventory',
        'transfer_inventory',
        'perform_inventory_adjustment',
        'perform_stock_count',
        'view_reports',
    ],
    purchasing_committee_manager: [
        'approve_purchase_request_committee',
        'view_purchasing_history',
        'view_purchasing_reports',
        'manage_suppliers',
        'manage_material_suppliers',
        'view_reports',
    ],
    department_manager: [
        'create_department_refill_request',
        'confirm_department_delivery',
        'view_inventory',
        'perform_inventory_adjustment',
        'perform_stock_count',
        'manage_department_queue',
    ],
    doctor: [
        'view_patient_history',
        'start_consultation',
        'create_prescription',
        'renew_prescription',
        'cancel_prescription',
    ],
    pharmacy_staff: [
        'view_inventory',
        'perform_inventory_adjustment',
        'perform_stock_count',
        'create_department_refill_request',
        'confirm_department_delivery',
        'dispense_prescription',
        'view_patient_history',
    ],
    reception_staff: [
        'add_patient',
        'view_patient_history',
        'manage_department_queue',
    ],
};

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
    const alreadySeeded = await prisma.role.count();
    if (alreadySeeded > 0) {
        console.log(
            'Roles already exist -- skipping seed. Reset the DB to reseed.',
        );
        return;
    }

    // 1) PERMISSIONS ----------------------------------------------------------
    console.log('Seeding permissions...');
    await prisma.permission.createMany({ data: PERMISSIONS });
    const permByCode = new Map(
        (await prisma.permission.findMany()).map((p) => [p.code, p]),
    );

    // 2) ROLES ------------------------------------------------------------------
    console.log('Seeding roles...');
    const roleNames = [
        'hospital_manager',
        'warehouse_manager',
        'purchasing_committee_manager',
        'department_manager',
        'doctor',
        'pharmacy_staff',
        'reception_staff',
    ];
    const roles = new Map<string, { id: string }>();
    for (const name of roleNames) {
        const role = await prisma.role.create({
            data: {
                name,
                description: `${name.replace(/_/g, ' ')} role`,
                isSystem: name === 'hospital_manager',
                isActive: true,
            },
        });
        roles.set(name, role);
    }

    // 3) ROLE PERMISSIONS ---------------------------------------------------
    console.log('Seeding role permissions...');
    for (const [roleName, codes] of Object.entries(ROLE_PERMISSIONS)) {
        const role = roles.get(roleName)!;
        await prisma.rolePermission.createMany({
            data: codes.map((code) => ({
                roleId: role.id,
                permissionId: permByCode.get(code)!.id,
            })),
        });
    }

    // 4) DEPARTMENTS (no manager yet -- users reference departments, departments
    //    reference managers, so create departments first, users second, then
    //    patch managerId back onto the department). --------------------------
    console.log('Seeding departments...');
    const deptWarehouse = await prisma.department.create({
        data: { name: 'Central Warehouse', type: 'central_warehouse' },
    });
    const deptPharmacy = await prisma.department.create({
        data: { name: 'Pharmacy', type: 'pharmacy' },
    });
    const deptEmergency = await prisma.department.create({
        data: { name: 'Emergency', type: 'standard' },
    });
    const deptInternalMed = await prisma.department.create({
        data: { name: 'Internal Medicine', type: 'standard' },
    });
    const deptPediatrics = await prisma.department.create({
        data: { name: 'Pediatrics', type: 'standard' },
    });

    // 5) USERS ------------------------------------------------------------------
    console.log('Seeding users...');

    const hospitalManager = await prisma.user.create({
        data: {
            fullName: 'Hassan Mohammad',
            phone: '+966500000001',
            email: 'hassanmohammad0010@gmail.com',
            roleId: roles.get('hospital_manager')!.id,
            status: 'active',
        },
    });

    const warehouseManager = await prisma.user.create({
        data: {
            fullName: 'Hamed Zaher',
            phone: '+966500000002',
            email: 'hamedzaher.dev@gmail.com',
            roleId: roles.get('warehouse_manager')!.id,
            departmentId: deptWarehouse.id,
            status: 'active',
            createdById: hospitalManager.id,
        },
    });

    const committeeManager = await prisma.user.create({
        data: {
            fullName: 'Purchasing Committee Manager',
            phone: '+966500000003',
            email: 'ghj8919@gmail.com',
            roleId: roles.get('purchasing_committee_manager')!.id,
            status: 'active',
            createdById: hospitalManager.id,
        },
    });

    const pharmacyStaff = await prisma.user.create({
        data: {
            fullName: 'Bashar Mohammad',
            phone: '+966500000004',
            email: 'basharman2003@gmail.com',
            roleId: roles.get('pharmacy_staff')!.id,
            departmentId: deptPharmacy.id,
            status: 'active',
            createdById: hospitalManager.id,
        },
    });

    const emergencyManager = await prisma.user.create({
        data: {
            fullName: 'Emergency Department Manager',
            phone: '+966500000005',
            email: '0938825359b@gmail.com',
            roleId: roles.get('department_manager')!.id,
            departmentId: deptEmergency.id,
            status: 'active',
            createdById: hospitalManager.id,
        },
    });

    const doctorOne = await prisma.user.create({
        data: {
            fullName: 'Dr. Hamed Zaher',
            phone: '+966500000006',
            email: 'hamedzaher90@gmail.com',
            roleId: roles.get('doctor')!.id,
            departmentId: deptEmergency.id,
            specialty: 'Emergency Medicine',
            status: 'active',
            createdById: hospitalManager.id,
        },
    });

    // extra supporting users so relational tables have >= 3 varied rows
    const internalMedManager = await prisma.user.create({
        data: {
            fullName: 'Internal Medicine Manager',
            phone: '+966500000007',
            email: 'internalmed.manager@example.com',
            roleId: roles.get('department_manager')!.id,
            departmentId: deptInternalMed.id,
            status: 'active',
            createdById: hospitalManager.id,
        },
    });

    const pediatricsManager = await prisma.user.create({
        data: {
            fullName: 'Pediatrics Manager',
            phone: '+966500000008',
            email: 'pediatrics.manager@example.com',
            roleId: roles.get('department_manager')!.id,
            departmentId: deptPediatrics.id,
            status: 'active',
            createdById: hospitalManager.id,
        },
    });

    const doctorTwo = await prisma.user.create({
        data: {
            fullName: 'Dr. Sara Ahmed',
            phone: '+966500000009',
            email: 'doctor.sara@example.com',
            roleId: roles.get('doctor')!.id,
            departmentId: deptInternalMed.id,
            specialty: 'Internal Medicine',
            status: 'active',
            createdById: hospitalManager.id,
        },
    });

    const doctorThree = await prisma.user.create({
        data: {
            fullName: 'Dr. Lina Youssef',
            phone: '+966500000010',
            email: 'doctor.lina@example.com',
            roleId: roles.get('doctor')!.id,
            departmentId: deptPediatrics.id,
            specialty: 'Pediatrics',
            status: 'active',
            createdById: hospitalManager.id,
        },
    });

    const receptionStaff = await prisma.user.create({
        data: {
            fullName: 'Reception Staff One',
            phone: '+966500000011',
            email: 'reception.one@example.com',
            roleId: roles.get('reception_staff')!.id,
            status: 'active',
            createdById: hospitalManager.id,
        },
    });

    // 6) patch department.managerId now that users exist --------------------
    await prisma.department.update({
        where: { id: deptWarehouse.id },
        data: { managerId: warehouseManager.id },
    });
    await prisma.department.update({
        where: { id: deptPharmacy.id },
        data: { managerId: pharmacyStaff.id },
    });
    await prisma.department.update({
        where: { id: deptEmergency.id },
        data: { managerId: emergencyManager.id },
    });
    await prisma.department.update({
        where: { id: deptInternalMed.id },
        data: { managerId: internalMedManager.id },
    });
    await prisma.department.update({
        where: { id: deptPediatrics.id },
        data: { managerId: pediatricsManager.id },
    });

    // 7) USER PERMISSION OVERRIDE -- give the warehouse manager EVERY
    //    permission on top of their role, as requested. -----------------------
    console.log('Granting full permission override to warehouse manager...');
    await prisma.userPermission.createMany({
        data: [...permByCode.values()].map((p) => ({
            userId: warehouseManager.id,
            permissionId: p.id,
            effect: 'grant' as const,
            grantedById: hospitalManager.id,
            reason: 'Full system access granted per hospital request.',
        })),
    });

    // 8) OTP CODES ------------------------------------------------------------
    console.log('Seeding OTP codes...');
    const allUsers = [
        hospitalManager,
        warehouseManager,
        committeeManager,
        pharmacyStaff,
        emergencyManager,
        doctorOne,
        internalMedManager,
        pediatricsManager,
        doctorTwo,
        doctorThree,
        receptionStaff,
    ];
    for (const u of allUsers.slice(0, 3)) {
        await prisma.otpCode.create({
            data: {
                userId: u.id,
                channel: 'phone',
                destination: u.phone ?? u.email ?? 'unknown',
                code: otpHash('123456'),
                expiresAt: daysFromNow(0),
                consumed: true,
            },
        });
    }

    // 9) SESSIONS ---------------------------------------------------------------
    console.log('Seeding sessions...');
    for (const u of allUsers.slice(0, 3)) {
        await prisma.session.create({
            data: {
                userId: u.id,
                platform: 'web',
                accessTokenHash: tokenHash(`access-${u.id}`),
                refreshTokenHash: tokenHash(`refresh-${u.id}`),
                deviceInfo: 'Seed script / Chrome',
                ipAddress: '127.0.0.1',
                accessExpiresAt: daysFromNow(1),
                refreshExpiresAt: daysFromNow(30),
            },
        });
    }

    // 10) SUPPLIERS -------------------------------------------------------------
    console.log('Seeding suppliers...');
    const supplierA = await prisma.supplier.create({
        data: {
            name: 'MedSupply Co.',
            phone: '+966511111111',
            email: 'sales@medsupply.example',
            address: 'Riyadh, SA',
        },
    });
    const supplierB = await prisma.supplier.create({
        data: {
            name: 'PharmaDirect Ltd.',
            phone: '+966522222222',
            email: 'contact@pharmadirect.example',
            address: 'Jeddah, SA',
        },
    });
    const supplierC = await prisma.supplier.create({
        data: {
            name: 'HealthGear Trading',
            phone: '+966533333333',
            email: 'info@healthgear.example',
            address: 'Dammam, SA',
        },
    });

    // 11) UNITS -------------------------------------------------------------------
    console.log('Seeding units...');
    const unitPiece = await prisma.unit.create({
        data: { name: 'Piece', abbreviation: 'pcs' },
    });
    const unitBox = await prisma.unit.create({
        data: { name: 'Box', abbreviation: 'bx' },
    });
    const unitBottle = await prisma.unit.create({
        data: { name: 'Bottle', abbreviation: 'btl' },
    });

    // 12) CATEGORIES ----------------------------------------------------------
    console.log('Seeding categories...');
    const catMedications = await prisma.category.create({
        data: { name: 'Medications' },
    });
    const catSupplies = await prisma.category.create({
        data: { name: 'Medical Supplies' },
    });
    const catEquipment = await prisma.category.create({
        data: { name: 'Equipment' },
    });
    const catAnalgesics = await prisma.category.create({
        data: { name: 'Analgesics', parentCategoryId: catMedications.id },
    });

    // 13) PRODUCTS --------------------------------------------------------------
    console.log('Seeding products...');
    const productParacetamol = await prisma.product.create({
        data: {
            name: 'Paracetamol 500mg',
            categoryId: catAnalgesics.id,
            materialType: 'consumable',
            description: 'Pain reliever / fever reducer',
            createdById: warehouseManager.id,
        },
    });
    const productGloves = await prisma.product.create({
        data: {
            name: 'Examination Gloves',
            categoryId: catSupplies.id,
            materialType: 'consumable',
            description: 'Disposable latex-free gloves',
            createdById: warehouseManager.id,
        },
    });
    const productBed = await prisma.product.create({
        data: {
            name: 'Hospital Bed',
            categoryId: catEquipment.id,
            materialType: 'fixed_asset',
            description: 'Adjustable hospital bed',
            createdById: warehouseManager.id,
        },
    });

    // 14) PRODUCT VARIANTS --------------------------------------------------
    console.log('Seeding product variants...');
    const variantParacetamolBox = await prisma.productVariant.create({
        data: {
            productId: productParacetamol.id,
            variantName: 'Paracetamol 500mg - Box of 100 tablets',
            sku: 'MED-PARA-500-100',
            unitId: unitBox.id,
            createdById: warehouseManager.id,
        },
    });
    const variantGlovesMedium = await prisma.productVariant.create({
        data: {
            productId: productGloves.id,
            variantName: 'Examination Gloves - Medium (Box of 100)',
            sku: 'SUP-GLOVE-M-100',
            unitId: unitBox.id,
            createdById: warehouseManager.id,
        },
    });
    const variantBedStandard = await prisma.productVariant.create({
        data: {
            productId: productBed.id,
            variantName: 'Hospital Bed - Standard Electric',
            sku: 'EQP-BED-STD',
            unitId: unitPiece.id,
            createdById: warehouseManager.id,
        },
    });

    // 15) VARIANT SUPPLIERS -------------------------------------------------
    console.log('Seeding variant suppliers...');
    await prisma.variantSupplier.createMany({
        data: [
            {
                variantId: variantParacetamolBox.id,
                supplierId: supplierA.id,
                expectedPurchasePrice: 12.5,
                supplierProductCode: 'MSC-PARA-100',
                isPreferred: true,
            },
            {
                variantId: variantParacetamolBox.id,
                supplierId: supplierB.id,
                expectedPurchasePrice: 13.0,
                supplierProductCode: 'PD-PARA100',
            },
            {
                variantId: variantGlovesMedium.id,
                supplierId: supplierC.id,
                expectedPurchasePrice: 8.75,
                supplierProductCode: 'HG-GLV-M',
                isPreferred: true,
            },
            {
                variantId: variantBedStandard.id,
                supplierId: supplierC.id,
                expectedPurchasePrice: 1450.0,
                supplierProductCode: 'HG-BED-STD',
                isPreferred: true,
            },
        ],
    });

    // 16) DEPARTMENT STOCK SETTINGS (warehouse + pharmacy only track min/max) --
    console.log('Seeding department stock settings...');
    await prisma.departmentStockSetting.createMany({
        data: [
            {
                variantId: variantParacetamolBox.id,
                departmentId: deptWarehouse.id,
                storageLocation: 'Warehouse Shelf A1',
                minimumStock: 50,
                maximumStock: 500,
                createdById: warehouseManager.id,
            },
            {
                variantId: variantGlovesMedium.id,
                departmentId: deptWarehouse.id,
                storageLocation: 'Warehouse Shelf B2',
                minimumStock: 30,
                maximumStock: 300,
                createdById: warehouseManager.id,
            },
            {
                variantId: variantParacetamolBox.id,
                departmentId: deptPharmacy.id,
                storageLocation: 'Pharmacy Cabinet 1',
                minimumStock: 10,
                maximumStock: 100,
                createdById: pharmacyStaff.id,
            },
        ],
    });

    // 17) PURCHASE REQUESTS + ITEMS ------------------------------------------
    console.log('Seeding purchase requests...');
    const pr1 = await prisma.purchaseRequest.create({
        data: {
            requestNumber: 'PR-20260701-A001',
            requestedById: warehouseManager.id,
            status: 'ready_for_receiving',
            hospitalApprovedById: hospitalManager.id,
            hospitalApprovedAt: daysAgo(10),
            committeeApprovedById: committeeManager.id,
            committeeApprovedAt: daysAgo(8),
            committeeMarkedReadyById: committeeManager.id,
            committeeMarkedReadyAt: daysAgo(7),
            notes: 'Quarterly restock of core consumables.',
            items: {
                create: [
                    {
                        variantId: variantParacetamolBox.id,
                        requestedQuantity: 200,
                        estimatedPrice: 12.5,
                        committeeApprovedQuantity: 200,
                    },
                    {
                        variantId: variantGlovesMedium.id,
                        requestedQuantity: 150,
                        estimatedPrice: 8.75,
                        committeeApprovedQuantity: 150,
                    },
                    {
                        variantId: variantBedStandard.id,
                        requestedQuantity: 3,
                        estimatedPrice: 1450.0,
                        committeeApprovedQuantity: 2,
                    },
                ],
            },
        },
        include: { items: true },
    });

    const pr2 = await prisma.purchaseRequest.create({
        data: {
            requestNumber: 'PR-20260705-A002',
            requestedById: warehouseManager.id,
            status: 'approved',
            hospitalApprovedById: hospitalManager.id,
            hospitalApprovedAt: daysAgo(5),
            committeeApprovedById: committeeManager.id,
            committeeApprovedAt: daysAgo(4),
            notes: 'Top-up order for gloves ahead of flu season.',
            items: {
                create: [
                    {
                        variantId: variantGlovesMedium.id,
                        requestedQuantity: 100,
                        estimatedPrice: 8.75,
                        committeeApprovedQuantity: 100,
                    },
                ],
            },
        },
        include: { items: true },
    });

    const pr3 = await prisma.purchaseRequest.create({
        data: {
            requestNumber: 'PR-20260712-A003',
            requestedById: warehouseManager.id,
            status: 'draft',
            notes: 'Draft request -- pending review before submission.',
            items: {
                create: [
                    {
                        variantId: variantParacetamolBox.id,
                        requestedQuantity: 50,
                        estimatedPrice: 12.5,
                    },
                ],
            },
        },
    });

    // 18) PURCHASE ORDERS + ITEMS --------------------------------------------
    console.log('Seeding purchase orders...');
    const po1 = await prisma.purchaseOrder.create({
        data: {
            orderNumber: 'PO-20260701-B001',
            purchaseRequestId: pr1.id,
            supplierId: supplierA.id,
            status: 'received',
            createdById: warehouseManager.id,
            orderedAt: daysAgo(6),
            expectedDeliveryDate: daysAgo(2),
            items: {
                create: [
                    {
                        purchaseRequestItemId: pr1.items.find(
                            (i) => i.variantId === variantParacetamolBox.id,
                        )!.id,
                        variantId: variantParacetamolBox.id,
                        orderedQuantity: 200,
                        unitPrice: 12.5,
                        receivedQuantity: 200,
                    },
                ],
            },
        },
        include: { items: true },
    });

    const po2 = await prisma.purchaseOrder.create({
        data: {
            orderNumber: 'PO-20260702-B002',
            purchaseRequestId: pr1.id,
            supplierId: supplierC.id,
            status: 'partially_received',
            createdById: warehouseManager.id,
            orderedAt: daysAgo(6),
            expectedDeliveryDate: daysAgo(1),
            items: {
                create: [
                    {
                        purchaseRequestItemId: pr1.items.find(
                            (i) => i.variantId === variantGlovesMedium.id,
                        )!.id,
                        variantId: variantGlovesMedium.id,
                        orderedQuantity: 150,
                        unitPrice: 8.75,
                        receivedQuantity: 100,
                    },
                    {
                        purchaseRequestItemId: pr1.items.find(
                            (i) => i.variantId === variantBedStandard.id,
                        )!.id,
                        variantId: variantBedStandard.id,
                        orderedQuantity: 2,
                        unitPrice: 1450.0,
                        receivedQuantity: 2,
                    },
                ],
            },
        },
        include: { items: true },
    });

    const po3 = await prisma.purchaseOrder.create({
        data: {
            orderNumber: 'PO-20260706-B003',
            purchaseRequestId: pr2.id,
            supplierId: supplierC.id,
            status: 'sent',
            createdById: warehouseManager.id,
            orderedAt: daysAgo(4),
            expectedDeliveryDate: daysFromNow(2),
            items: {
                create: [
                    {
                        purchaseRequestItemId: pr2.items[0].id,
                        variantId: variantGlovesMedium.id,
                        orderedQuantity: 100,
                        unitPrice: 8.75,
                    },
                ],
            },
        },
        include: { items: true },
    });

    // 19) PURCHASE RECEIPTS -> BATCHES -> BATCH_STOCK -> LEDGER ---------------
    console.log('Seeding purchase receipts, batches, and batch stock...');

    async function receiveLine(params: {
        receipt: { purchaseOrderId: string; purchaseRequestId: string };
        orderItemId: string;
        variantId: string;
        supplierId: string;
        quantity: number;
        batchNumber: string;
        expirationDate: Date;
        purchasePrice: number;
    }) {
        const receipt = await prisma.purchaseReceipt.create({
            data: {
                purchaseOrderId: params.receipt.purchaseOrderId,
                purchaseRequestId: params.receipt.purchaseRequestId,
                receivedById: warehouseManager.id,
                receivingDate: daysAgo(2),
                notes: 'Seed data receipt.',
            },
        });

        const receiptItem = await prisma.purchaseReceiptItem.create({
            data: {
                purchaseReceiptId: receipt.id,
                purchaseOrderItemId: params.orderItemId,
                variantId: params.variantId,
                supplierId: params.supplierId,
                expectedQuantity: params.quantity,
                quantity: params.quantity,
                quantityDiscrepancy: 0,
                purchasePrice: params.purchasePrice,
                batchNumber: params.batchNumber,
                manufacturingDate: daysAgo(60),
                expirationDate: params.expirationDate,
            },
        });

        const batch = await prisma.batch.create({
            data: {
                purchaseReceiptItemId: receiptItem.id,
                variantId: params.variantId,
                supplierId: params.supplierId,
                batchNumber: params.batchNumber,
                quantityReceived: params.quantity,
                purchasePrice: params.purchasePrice,
                manufacturingDate: daysAgo(60),
                expirationDate: params.expirationDate,
                receivingDate: daysAgo(2),
                createdById: warehouseManager.id,
            },
        });

        const batchStock = await prisma.batchStock.create({
            data: {
                batchId: batch.id,
                departmentId: deptWarehouse.id,
                quantity: params.quantity,
            },
        });

        await prisma.inventoryTransaction.create({
            data: {
                transactionType: 'purchase_receipt',
                variantId: params.variantId,
                batchId: batch.id,
                departmentId: deptWarehouse.id,
                quantity: params.quantity,
                balanceAfter: params.quantity,
                referenceType: 'purchase_receipt',
                referenceId: receipt.id,
                performedById: warehouseManager.id,
            },
        });

        return { receipt, receiptItem, batch, batchStock };
    }

    const receipt1 = await receiveLine({
        receipt: { purchaseOrderId: po1.id, purchaseRequestId: pr1.id },
        orderItemId: po1.items[0].id,
        variantId: variantParacetamolBox.id,
        supplierId: supplierA.id,
        quantity: 200,
        batchNumber: 'BATCH-PARA-0001',
        expirationDate: daysFromNow(365),
        purchasePrice: 12.5,
    });

    const gloveOrderItem = po2.items.find(
        (i) => i.variantId === variantGlovesMedium.id,
    )!;
    const receipt2 = await receiveLine({
        receipt: { purchaseOrderId: po2.id, purchaseRequestId: pr1.id },
        orderItemId: gloveOrderItem.id,
        variantId: variantGlovesMedium.id,
        supplierId: supplierC.id,
        quantity: 100,
        batchNumber: 'BATCH-GLOVE-0001',
        expirationDate: daysFromNow(720),
        purchasePrice: 8.75,
    });

    const bedOrderItem = po2.items.find(
        (i) => i.variantId === variantBedStandard.id,
    )!;
    const receipt3 = await receiveLine({
        receipt: { purchaseOrderId: po2.id, purchaseRequestId: pr1.id },
        orderItemId: bedOrderItem.id,
        variantId: variantBedStandard.id,
        supplierId: supplierC.id,
        quantity: 2,
        batchNumber: 'BATCH-BED-0001',
        expirationDate: daysFromNow(3650),
        purchasePrice: 1450.0,
    });

    // roll the purchase request items' receivedQuantity forward to match, and
    // mark pr1 as received since everything above is fully in.
    await prisma.purchaseRequestItem.update({
        where: {
            id: pr1.items.find((i) => i.variantId === variantParacetamolBox.id)!
                .id,
        },
        data: { receivedQuantity: 200 },
    });
    await prisma.purchaseRequestItem.update({
        where: {
            id: pr1.items.find((i) => i.variantId === variantGlovesMedium.id)!
                .id,
        },
        data: { receivedQuantity: 100 },
    });
    await prisma.purchaseRequestItem.update({
        where: {
            id: pr1.items.find((i) => i.variantId === variantBedStandard.id)!
                .id,
        },
        data: { receivedQuantity: 2 },
    });
    await prisma.purchaseRequest.update({
        where: { id: pr1.id },
        data: { status: 'partially_received' },
    });

    // 20) DEPARTMENT REFILL REQUESTS + ITEMS ---------------------------------
    console.log('Seeding department refill requests...');

    const refillEmergency = await prisma.departmentRefillRequest.create({
        data: {
            requestNumber: 'DRF-20260710-C001',
            departmentId: deptEmergency.id,
            requestedById: emergencyManager.id,
            status: 'delivered',
            priority: 'urgent',
            requestType: 'normal',
            hospitalApprovedById: hospitalManager.id,
            hospitalApprovedAt: daysAgo(5),
            notes: 'Weekly restock for Emergency.',
            items: {
                create: [
                    {
                        variantId: variantParacetamolBox.id,
                        requestedQuantity: 40,
                        preparedQuantity: 40,
                        deliveredQuantity: 40,
                    },
                    {
                        variantId: variantGlovesMedium.id,
                        requestedQuantity: 30,
                        preparedQuantity: 25,
                        deliveredQuantity: 25,
                        quantityDiscrepancy: 0,
                    },
                ],
            },
        },
        include: { items: true },
    });

    const refillPharmacy = await prisma.departmentRefillRequest.create({
        data: {
            requestNumber: 'DRF-20260712-C002',
            departmentId: deptPharmacy.id,
            requestedById: pharmacyStaff.id,
            status: 'ready_for_delivery',
            priority: 'normal',
            requestType: 'normal',
            hospitalApprovedById: hospitalManager.id,
            hospitalApprovedAt: daysAgo(3),
            notes: 'Pharmacy top-up for dispensing.',
            items: {
                create: [
                    {
                        variantId: variantParacetamolBox.id,
                        requestedQuantity: 30,
                        preparedQuantity: 30,
                    },
                ],
            },
        },
        include: { items: true },
    });

    const refillInternalMed = await prisma.departmentRefillRequest.create({
        data: {
            requestNumber: 'DRF-20260714-C003',
            departmentId: deptInternalMed.id,
            requestedById: internalMedManager.id,
            status: 'pending_hospital_approval',
            priority: 'normal',
            requestType: 'normal',
            notes: 'First refill request for the ward.',
            items: {
                create: [
                    {
                        variantId: variantGlovesMedium.id,
                        requestedQuantity: 20,
                    },
                ],
            },
        },
    });

    // 21) DELIVERIES + DELIVERY ITEMS (ship from warehouse batch stock) ------
    console.log('Seeding refill deliveries...');

    async function shipAndDecrementWarehouse(
        variantId: string,
        batchId: string,
        qty: number,
    ) {
        const stock = await prisma.batchStock.findUniqueOrThrow({
            where: {
                batchId_departmentId: {
                    batchId,
                    departmentId: deptWarehouse.id,
                },
            },
        });
        const updated = await prisma.batchStock.update({
            where: { id: stock.id },
            data: { quantity: { decrement: qty } },
        });
        await prisma.inventoryTransaction.create({
            data: {
                transactionType: 'department_transfer_out',
                variantId,
                batchId,
                departmentId: deptWarehouse.id,
                quantity: -qty,
                balanceAfter: Number(updated.quantity),
                referenceType: 'refill_request',
                performedById: warehouseManager.id,
            },
        });
    }

    const emergencyParaItem = refillEmergency.items.find(
        (i) => i.variantId === variantParacetamolBox.id,
    )!;
    const emergencyGloveItem = refillEmergency.items.find(
        (i) => i.variantId === variantGlovesMedium.id,
    )!;

    await shipAndDecrementWarehouse(
        variantParacetamolBox.id,
        receipt1.batch.id,
        40,
    );
    await shipAndDecrementWarehouse(
        variantGlovesMedium.id,
        receipt2.batch.id,
        25,
    );

    const deliveryEmergency = await prisma.departmentRefillDelivery.create({
        data: {
            refillRequestId: refillEmergency.id,
            deliveredById: warehouseManager.id,
            deliveredAt: daysAgo(5),
            receivedById: emergencyManager.id,
            confirmedAt: daysAgo(4),
            notes: 'Delivered and confirmed by Emergency.',
            items: {
                create: [
                    {
                        refillItemId: emergencyParaItem.id,
                        batchId: receipt1.batch.id,
                        shippedQuantity: 40,
                        receivedQuantity: 40,
                        quantityDiscrepancy: 0,
                    },
                    {
                        refillItemId: emergencyGloveItem.id,
                        batchId: receipt2.batch.id,
                        shippedQuantity: 25,
                        receivedQuantity: 25,
                        quantityDiscrepancy: 0,
                    },
                ],
            },
        },
        include: { items: true },
    });

    const pharmacyParaItem = refillPharmacy.items[0];
    await shipAndDecrementWarehouse(
        variantParacetamolBox.id,
        receipt1.batch.id,
        30,
    );

    const deliveryPharmacy = await prisma.departmentRefillDelivery.create({
        data: {
            refillRequestId: refillPharmacy.id,
            deliveredById: warehouseManager.id,
            deliveredAt: daysAgo(2),
            // not yet confirmed -- still awaiting pharmacy confirmation
            items: {
                create: [
                    {
                        refillItemId: pharmacyParaItem.id,
                        batchId: receipt1.batch.id,
                        shippedQuantity: 30,
                    },
                ],
            },
        },
        include: { items: true },
    });

    // 22) apply confirmation side-effects -------------------------------------
    console.log('Applying delivery-confirmation side effects...');

    // Emergency (non-pharmacy, non-live-tracked) -> department_inventory
    await prisma.departmentInventory.upsert({
        where: {
            departmentId_variantId: {
                departmentId: deptEmergency.id,
                variantId: variantParacetamolBox.id,
            },
        },
        update: {
            currentQuantity: 40,
            lastRefillQuantity: 40,
            lastRefillDate: daysAgo(4),
        },
        create: {
            departmentId: deptEmergency.id,
            variantId: variantParacetamolBox.id,
            currentQuantity: 40,
            lastRefillQuantity: 40,
            lastRefillDate: daysAgo(4),
        },
    });
    await prisma.departmentInventory.upsert({
        where: {
            departmentId_variantId: {
                departmentId: deptEmergency.id,
                variantId: variantGlovesMedium.id,
            },
        },
        update: {
            currentQuantity: 25,
            lastRefillQuantity: 25,
            lastRefillDate: daysAgo(4),
        },
        create: {
            departmentId: deptEmergency.id,
            variantId: variantGlovesMedium.id,
            currentQuantity: 25,
            lastRefillQuantity: 25,
            lastRefillDate: daysAgo(4),
        },
    });
    // baseline row for Internal Medicine / Pediatrics so the table has >= 3 rows
    await prisma.departmentInventory.create({
        data: {
            departmentId: deptInternalMed.id,
            variantId: variantGlovesMedium.id,
            currentQuantity: 0,
        },
    });

    await prisma.inventoryTransaction.create({
        data: {
            transactionType: 'department_transfer_in',
            variantId: variantParacetamolBox.id,
            batchId: receipt1.batch.id,
            departmentId: deptEmergency.id,
            quantity: 40,
            balanceAfter: 40,
            referenceType: 'department_refill_delivery_item',
            referenceId: deliveryEmergency.items[0].id,
            performedById: emergencyManager.id,
        },
    });

    await prisma.departmentRefillItem.update({
        where: { id: emergencyParaItem.id },
        data: { deliveredQuantity: 40, quantityDiscrepancy: 0 },
    });
    await prisma.departmentRefillItem.update({
        where: { id: emergencyGloveItem.id },
        data: { deliveredQuantity: 25, quantityDiscrepancy: 0 },
    });

    // 23) INVENTORY ADJUSTMENTS -----------------------------------------------
    console.log('Seeding inventory adjustments...');

    const damagedWarehouseAdj = await prisma.inventoryAdjustment.create({
        data: {
            variantId: variantGlovesMedium.id,
            departmentId: deptWarehouse.id,
            batchId: receipt2.batch.id,
            adjustmentType: 'damaged',
            quantity: 5,
            reportedById: warehouseManager.id,
            notes: 'Water damage discovered during shelving.',
        },
    });
    await prisma.batchStock.update({
        where: {
            batchId_departmentId: {
                batchId: receipt2.batch.id,
                departmentId: deptWarehouse.id,
            },
        },
        data: { quantity: { decrement: 5 } },
    });
    await prisma.inventoryTransaction.create({
        data: {
            transactionType: 'adjustment_damaged',
            variantId: variantGlovesMedium.id,
            batchId: receipt2.batch.id,
            departmentId: deptWarehouse.id,
            quantity: -5,
            balanceAfter: 70,
            referenceType: 'adjustment',
            referenceId: damagedWarehouseAdj.id,
            performedById: warehouseManager.id,
        },
    });

    const expiredWarehouseAdj = await prisma.inventoryAdjustment.create({
        data: {
            variantId: variantParacetamolBox.id,
            departmentId: deptWarehouse.id,
            batchId: receipt1.batch.id,
            adjustmentType: 'expired',
            quantity: 3,
            reportedById: warehouseManager.id,
            notes: 'Found 3 boxes past expiration during shelf check.',
        },
    });
    await prisma.batchStock.update({
        where: {
            batchId_departmentId: {
                batchId: receipt1.batch.id,
                departmentId: deptWarehouse.id,
            },
        },
        data: { quantity: { decrement: 3 } },
    });
    await prisma.inventoryTransaction.create({
        data: {
            transactionType: 'adjustment_expired',
            variantId: variantParacetamolBox.id,
            batchId: receipt1.batch.id,
            departmentId: deptWarehouse.id,
            quantity: -3,
            balanceAfter: 127,
            referenceType: 'adjustment',
            referenceId: expiredWarehouseAdj.id,
            performedById: warehouseManager.id,
        },
    });

    const emergencyDamagedAdj = await prisma.inventoryAdjustment.create({
        data: {
            variantId: variantGlovesMedium.id,
            departmentId: deptEmergency.id,
            batchId: receipt2.batch.id,
            adjustmentType: 'damaged',
            quantity: 2,
            reportedById: emergencyManager.id,
            notes: 'Torn box found on arrival.',
        },
    });
    await prisma.departmentInventory.update({
        where: {
            departmentId_variantId: {
                departmentId: deptEmergency.id,
                variantId: variantGlovesMedium.id,
            },
        },
        data: { currentQuantity: { decrement: 2 } },
    });
    await prisma.inventoryTransaction.create({
        data: {
            transactionType: 'adjustment_damaged',
            variantId: variantGlovesMedium.id,
            batchId: receipt2.batch.id,
            departmentId: deptEmergency.id,
            quantity: -2,
            balanceAfter: 23,
            referenceType: 'adjustment',
            referenceId: emergencyDamagedAdj.id,
            performedById: emergencyManager.id,
        },
    });

    // 24) STOCK COUNT SESSIONS + ITEMS ----------------------------------------
    console.log('Seeding stock count sessions...');

    const warehouseStockCount = await prisma.stockCountSession.create({
        data: {
            departmentId: deptWarehouse.id,
            initiatedById: warehouseManager.id,
            status: 'completed',
            countDate: daysAgo(1),
            completedAt: daysAgo(1),
            notes: 'Monthly warehouse cycle count.',
            items: {
                create: [
                    {
                        variantId: variantParacetamolBox.id,
                        batchId: receipt1.batch.id,
                        expectedQuantity: 127,
                        countedQuantity: 127,
                        variance: 0,
                    },
                    {
                        variantId: variantGlovesMedium.id,
                        batchId: receipt2.batch.id,
                        expectedQuantity: 40,
                        countedQuantity: 39,
                        variance: -1,
                        notes: 'One box misplaced, found later.',
                    },
                ],
            },
        },
    });

    const pharmacyStockCount = await prisma.stockCountSession.create({
        data: {
            departmentId: deptPharmacy.id,
            initiatedById: pharmacyStaff.id,
            status: 'draft',
            countDate: new Date(),
            notes: 'In-progress pharmacy count.',
        },
    });

    const emergencyStockCount = await prisma.stockCountSession.create({
        data: {
            departmentId: deptEmergency.id,
            initiatedById: emergencyManager.id,
            status: 'completed',
            countDate: daysAgo(2),
            completedAt: daysAgo(2),
            items: {
                create: [
                    {
                        variantId: variantParacetamolBox.id,
                        expectedQuantity: 40,
                        countedQuantity: 40,
                        variance: 0,
                    },
                ],
            },
        },
    });

    // 25) PATIENTS ----------------------------------------------------------------
    console.log('Seeding patients...');
    const patientAhmed = await prisma.patient.create({
        data: {
            fullName: 'Ahmed Al-Farsi',
            nationalId: '1010101010',
            registeredById: receptionStaff.id,
        },
    });
    const patientLayla = await prisma.patient.create({
        data: {
            fullName: 'Layla Hassan',
            nationalId: '2020202020',
            registeredById: receptionStaff.id,
        },
    });
    const patientChildNoId = await prisma.patient.create({
        data: {
            fullName: 'Yousef (minor)',
            familyBookNumber: 'FB-55231',
            registeredById: receptionStaff.id,
        },
    });

    // 26) DEPARTMENT QUEUE ----------------------------------------------------
    console.log('Seeding department queue...');
    const queueAhmed = await prisma.departmentQueue.create({
        data: {
            departmentId: deptEmergency.id,
            patientId: patientAhmed.id,
            status: 'completed',
            addedById: receptionStaff.id,
            addedAt: daysAgo(1),
            lockedById: doctorOne.id,
            lockedAt: daysAgo(1),
            completedAt: daysAgo(1),
        },
    });
    const queueLayla = await prisma.departmentQueue.create({
        data: {
            departmentId: deptInternalMed.id,
            patientId: patientLayla.id,
            status: 'completed',
            addedById: receptionStaff.id,
            addedAt: daysAgo(1),
            lockedById: doctorTwo.id,
            lockedAt: daysAgo(1),
            completedAt: daysAgo(1),
        },
    });
    await prisma.departmentQueue.create({
        data: {
            departmentId: deptPediatrics.id,
            patientId: patientChildNoId.id,
            status: 'waiting',
            addedById: receptionStaff.id,
        },
    });

    // 27) MEDICAL VISITS + PRESCRIPTIONS --------------------------------------
    console.log('Seeding medical visits and prescriptions...');

    const visitAhmed = await prisma.medicalVisit.create({
        data: {
            patientId: patientAhmed.id,
            doctorId: doctorOne.id,
            departmentId: deptEmergency.id,
            queueEntryId: queueAhmed.id,
            clinicalNotes: 'Presented with fever and headache.',
            diagnosis: 'Viral fever',
            status: 'completed',
        },
    });

    const prescriptionAhmed = await prisma.prescription.create({
        data: {
            visitId: visitAhmed.id,
            patientId: patientAhmed.id,
            doctorId: doctorOne.id,
            status: 'active',
            startDate: daysAgo(1),
            currentCycleStart: daysAgo(1),
            currentCycleEnd: daysAgo(1),
            currentCycleStatus: 'ready',
            items: {
                create: [
                    {
                        variantId: variantParacetamolBox.id,
                        prescribedQuantity: 1,
                        dosage: '500mg',
                        frequency: 'Twice daily',
                        durationDays: 5,
                    },
                ],
            },
        },
        include: { items: true },
    });

    const visitLayla = await prisma.medicalVisit.create({
        data: {
            patientId: patientLayla.id,
            doctorId: doctorTwo.id,
            departmentId: deptInternalMed.id,
            queueEntryId: queueLayla.id,
            clinicalNotes: 'Follow-up for hypertension management.',
            diagnosis: 'Hypertension',
            externalMedications: JSON.stringify({
                medications: ['Lisinopril (from outside pharmacy)'],
                notes: 'Continues home medication.',
            }),
            status: 'completed',
        },
    });

    const prescriptionLayla = await prisma.prescription.create({
        data: {
            visitId: visitLayla.id,
            patientId: patientLayla.id,
            doctorId: doctorTwo.id,
            status: 'active',
            frequencyUnit: 'month',
            frequencyInterval: 1,
            startDate: daysAgo(1),
            totalCycles: 6,
            currentCycleStart: daysAgo(1),
            currentCycleEnd: daysFromNow(29),
            currentCycleStatus: 'ready',
            items: {
                create: [
                    {
                        variantId: variantGlovesMedium.id,
                        prescribedQuantity: 1,
                        dosage: 'N/A',
                        frequency: 'Monthly supply',
                        durationDays: 30,
                    },
                ],
            },
        },
        include: { items: true },
    });

    // a third, standalone completed+cancelled visit for variety
    const visitCancelled = await prisma.medicalVisit.create({
        data: {
            patientId: patientChildNoId.id,
            doctorId: doctorThree.id,
            departmentId: deptPediatrics.id,
            clinicalNotes: 'Routine checkup, cancelled by request.',
            status: 'cancelled',
            cancelReason: 'Guardian rescheduled the appointment.',
            cancelledById: pediatricsManager.id,
            cancelledAt: daysAgo(1),
        },
    });
    void visitCancelled;

    // 28) PHARMACY DISPENSE QUEUE (ready entries) -----------------------------
    console.log('Seeding pharmacy dispense queue...');
    await prisma.pharmacyDispenseQueue.create({
        data: {
            patientId: patientLayla.id,
            nationalId: patientLayla.nationalId,
            familyBookNumber: patientLayla.familyBookNumber,
            patientName: patientLayla.fullName,
            prescriptionId: prescriptionLayla.id,
            cycleNumber: 1,
            medicationSummary: 'Examination Gloves - Medium (Box of 100) x1',
            status: 'ready',
            readySince: daysAgo(1),
        },
    });

    // 29) DISPENSE prescriptionAhmed (one-time Rx) fully, closing its cycle ---
    console.log('Seeding a dispense event...');

    const pharmacyBatchStock = await prisma.batchStock.create({
        data: {
            batchId: receipt1.batch.id,
            departmentId: deptPharmacy.id,
            quantity: 30,
        },
    });
    void pharmacyBatchStock;

    const dispenseAhmed = await prisma.prescriptionDispense.create({
        data: {
            prescriptionId: prescriptionAhmed.id,
            cycleNumber: 1,
            dispensedById: pharmacyStaff.id,
            dispensedAt: daysAgo(1),
            notes: 'Full quantity dispensed at pickup.',
            items: {
                create: [
                    {
                        prescriptionItemId: prescriptionAhmed.items[0].id,
                        variantId: variantParacetamolBox.id,
                        batchId: receipt1.batch.id,
                        quantity: 1,
                    },
                ],
            },
        },
    });

    await prisma.batchStock.update({
        where: {
            batchId_departmentId: {
                batchId: receipt1.batch.id,
                departmentId: deptPharmacy.id,
            },
        },
        data: { quantity: { decrement: 1 } },
    });
    await prisma.inventoryTransaction.create({
        data: {
            transactionType: 'prescription_dispense',
            variantId: variantParacetamolBox.id,
            batchId: receipt1.batch.id,
            departmentId: deptPharmacy.id,
            quantity: -1,
            balanceAfter: 29,
            referenceType: 'prescription_dispense',
            referenceId: dispenseAhmed.id,
            performedById: pharmacyStaff.id,
        },
    });
    await prisma.prescriptionItem.update({
        where: { id: prescriptionAhmed.items[0].id },
        data: { dispensedQuantity: { increment: 1 } },
    });

    // one-time prescription, single item fully dispensed -> resolve + complete
    await prisma.prescriptionCycleLog.create({
        data: {
            prescriptionId: prescriptionAhmed.id,
            cycleNumber: 1,
            periodStart: daysAgo(1),
            periodEnd: daysAgo(1),
            resolvedStatus: 'delivered',
            resolvedAt: daysAgo(1),
        },
    });
    await prisma.prescription.update({
        where: { id: prescriptionAhmed.id },
        data: { status: 'completed', currentCycleStatus: 'delivered' },
    });

    // second cycle-log row (from a hypothetical earlier renewal cycle) so the
    // table clearly has more than one row to browse.
    await prisma.prescriptionCycleLog.create({
        data: {
            prescriptionId: prescriptionLayla.id,
            cycleNumber: 0,
            periodStart: daysAgo(31),
            periodEnd: daysAgo(1),
            resolvedStatus: 'delivered',
            resolvedAt: daysAgo(1),
        },
    });

    // 30) PERIODIC REFILL SCHEDULE ---------------------------------------------
    console.log('Seeding periodic refill schedule...');
    const scheduleOriginRequest = await prisma.departmentRefillRequest.create({
        data: {
            requestNumber: 'DRF-20260601-C000',
            departmentId: deptPharmacy.id,
            requestedById: pharmacyStaff.id,
            status: 'approved',
            priority: 'normal',
            requestType: 'monthly',
            frequencyInterval: 1,
            hospitalApprovedById: hospitalManager.id,
            hospitalApprovedAt: daysAgo(30),
            notes: 'Origin request for the recurring monthly pharmacy refill.',
            items: {
                create: [
                    {
                        variantId: variantParacetamolBox.id,
                        requestedQuantity: 50,
                    },
                ],
            },
        },
    });

    const schedule = await prisma.periodicRefillSchedule.create({
        data: {
            departmentId: deptPharmacy.id,
            createdById: pharmacyStaff.id,
            originRequestId: scheduleOriginRequest.id,
            status: 'active',
            approvalPolicy: 'auto_approved',
            requestType: 'monthly',
            frequencyInterval: 1,
            hospitalApprovedById: hospitalManager.id,
            hospitalApprovedAt: daysAgo(30),
            nextRunDate: daysFromNow(15),
            lastGeneratedAt: daysAgo(1),
        },
    });
    await prisma.departmentRefillRequest.update({
        where: { id: scheduleOriginRequest.id },
        data: { periodicScheduleId: schedule.id },
    });

    console.log('\nSeed complete!');
    console.log('----------------------------------------------------------');
    console.log(
        'Hospital Manager   -> hassanmohammad0010@gmail.com / phone +966500000001',
    );
    console.log(
        'Warehouse Manager  -> hamedzaher.dev@gmail.com     / phone +966500000002 (ALL permissions)',
    );
    console.log(
        'Committee Manager  -> ghj8919@gmail.com            / phone +966500000003',
    );
    console.log(
        'Pharmacy Staff     -> basharman2003@gmail.com      / phone +966500000004',
    );
    console.log(
        'Department Manager -> 0938825359b@gmail.com        / phone +966500000005 (Emergency)',
    );
    console.log(
        'Doctor             -> hamedzaher90@gmail.com       / phone +966500000006 (Emergency)',
    );
    console.log('All OTP codes seeded (for the first 3 users) use "123456".');
    console.log('----------------------------------------------------------');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
