// /**
//  * prisma/seed.ts
//  *
//  * Seeds every table in the schema with real, chained data (no hardcoded UUIDs —
//  * every foreign key below is a variable captured from a previous `.create()` call).
//  *
//  * This does NOT re-invoke the NestJS services (FEFO allocation, row-locking,
//  * multi-step transactions). It writes the same *final* state those services
//  * would produce, using direct Prisma calls, and always reads back the actual
//  * post-update quantity from the DB for ledger `balanceAfter` values instead of
//  * hand-computing them — so the numbers are guaranteed consistent with what's
//  * actually stored, not just consistent with my arithmetic.
//  *
//  * Run with:  npx prisma db seed
//  * (after configuring "prisma.seed" in package.json — see bottom of this file's
//  * companion README instructions.)
//  */

// import {
//     PrismaClient,
//     MaterialType,
//     DepartmentType,
//     OtpChannel,
//     SessionPlatform,
//     RequestStatus,
//     BatchType,
//     AdjustmentType,
//     StockCountStatus,
//     QueueStatus,
//     VisitStatus,
//     PrescriptionStatus,
//     CycleStatus,
//     FrequencyUnit,
//     RefillRequestPriority,
//     RefillRequestType,
//     PeriodicScheduleStatus,
//     ScheduleApprovalPolicy,
//     PurchaseReceiptStatus,
//     NotificationCategory,
//     UserStatus,
// } from '@prisma/client';
// import * as bcrypt from 'bcrypt';
// import { randomBytes } from 'crypto';

// import { PERMISSIONS } from '../src/common/constants/permissions.constants';
// import { NOTIFICATION_TYPES } from '../src/common/constants/notification-types.constants';
// import {
//     HOSPITAL_MANAGER_ROLE_NAME,
//     WAREHOUSE_MANAGER_ROLE_NAME,
//     PURCHASING_MANAGER_ROLE_NAME,
//     RECEPTION_STAFF_ROLE_NAME,
//     DOCTOR_ROLE_NAME,
// } from '../src/common/constants/roles.constants';
// import { generateRequestNumber } from '../src/common/utils/request-number-generator.util';
// import { computeCycleEnd } from '../src/common/utils/recurrence.util';
// import { hashToken } from '../src/common/utils/token-hash.util';

// const prisma = new PrismaClient();

// // Roles not covered by the app's hardcoded constants (still real, first-class roles).
// const DEPARTMENT_MANAGER_ROLE_NAME = 'department_manager';
// const PHARMACY_STAFF_ROLE_NAME = 'pharmacy_staff';
// const SUPER_ADMIN_ROLE_NAME = 'super_admin';

// function fakeToken(): string {
//     return hashToken(randomBytes(32).toString('hex'));
// }

// async function main() {
//     console.log('--- 1. Permissions ---');
//     const permissionDefs: {
//         code: string;
//         name: string;
//         category: string;
//         description: string;
//     }[] = [
//         {
//             code: PERMISSIONS.MANAGE_DEPARTMENTS,
//             name: 'Manage Departments',
//             category: 'admin',
//             description: 'Create, update, and deactivate departments.',
//         },
//         {
//             code: PERMISSIONS.MANAGE_ACCOUNTS,
//             name: 'Manage Accounts',
//             category: 'admin',
//             description: 'Create and update user accounts.',
//         },
//         {
//             code: PERMISSIONS.MANAGE_ROLES,
//             name: 'Manage Roles',
//             category: 'admin',
//             description: 'Create roles and assign role-level permissions.',
//         },
//         {
//             code: PERMISSIONS.MANAGE_USER_PERMISSIONS,
//             name: 'Manage User Permissions',
//             category: 'admin',
//             description: 'Grant or revoke per-user permission overrides.',
//         },
//         {
//             code: PERMISSIONS.MANAGE_DOCTORS,
//             name: 'Manage Doctors',
//             category: 'admin',
//             description: 'Administer doctor-specific account settings.',
//         },
//         {
//             code: PERMISSIONS.MANAGE_MATERIALS,
//             name: 'Manage Materials',
//             category: 'catalog',
//             description: 'Create and edit products and variants.',
//         },
//         {
//             code: PERMISSIONS.MANAGE_DEPARTMENT_MATERIALS,
//             name: 'Manage Department Materials',
//             category: 'catalog',
//             description:
//                 'Configure per-department stock settings (min/max, storage location).',
//         },
//         {
//             code: PERMISSIONS.MANAGE_UNITS,
//             name: 'Manage Units',
//             category: 'catalog',
//             description: 'Create and edit units of measure.',
//         },
//         {
//             code: PERMISSIONS.MANAGE_CATEGORIES,
//             name: 'Manage Categories',
//             category: 'catalog',
//             description: 'Create and edit product categories.',
//         },
//         {
//             code: PERMISSIONS.MANAGE_SUPPLIERS,
//             name: 'Manage Suppliers',
//             category: 'catalog',
//             description: 'Create and edit suppliers.',
//         },
//         {
//             code: PERMISSIONS.MANAGE_MATERIAL_SUPPLIERS,
//             name: 'Manage Material Suppliers',
//             category: 'catalog',
//             description: 'Link suppliers to product variants.',
//         },
//         {
//             code: PERMISSIONS.CREATE_PURCHASE_REQUEST,
//             name: 'Create Purchase Request',
//             category: 'purchasing',
//             description: 'Draft and submit purchase requests.',
//         },
//         {
//             code: PERMISSIONS.APPROVE_PURCHASE_REQUEST_HOSPITAL,
//             name: 'Hospital-Approve Purchase Request',
//             category: 'purchasing',
//             description: 'First-stage approval of purchase requests.',
//         },
//         {
//             code: PERMISSIONS.APPROVE_PURCHASE_REQUEST_MANAGER,
//             name: 'Manager-Approve Purchase Request',
//             category: 'purchasing',
//             description: 'Final approval with quantities before purchasing.',
//         },
//         {
//             code: PERMISSIONS.RECEIVE_PURCHASE,
//             name: 'Receive Purchase',
//             category: 'purchasing',
//             description: 'Record a physical purchase receipt with proof image.',
//         },
//         {
//             code: PERMISSIONS.CONFIRM_PURCHASE_RECEIPT,
//             name: 'Confirm Purchase Receipt',
//             category: 'purchasing',
//             description: 'Confirm a receipt and post stock into the warehouse.',
//         },
//         {
//             code: PERMISSIONS.VIEW_PURCHASING_HISTORY,
//             name: 'View Purchasing History',
//             category: 'purchasing',
//             description: 'View past purchase requests and receipts.',
//         },
//         {
//             code: PERMISSIONS.VIEW_PURCHASING_REPORTS,
//             name: 'View Purchasing Reports',
//             category: 'reports',
//             description: 'View purchasing analytics and reports.',
//         },
//         {
//             code: PERMISSIONS.CREATE_DEPARTMENT_REFILL_REQUEST,
//             name: 'Create Refill Request',
//             category: 'refills',
//             description: 'Request stock from the Central Warehouse.',
//         },
//         {
//             code: PERMISSIONS.APPROVE_DEPARTMENT_REFILL_REQUEST_HOSPITAL,
//             name: 'Hospital-Approve Refill Request',
//             category: 'refills',
//             description: 'First-stage approval of refill requests.',
//         },
//         {
//             code: PERMISSIONS.APPROVE_DEPARTMENT_REFILL_REQUEST_MANAGER,
//             name: 'Manager-Approve Refill Request',
//             category: 'refills',
//             description: 'Final approval with quantities before fulfillment.',
//         },
//         {
//             code: PERMISSIONS.PREPARE_DEPARTMENT_REFILL,
//             name: 'Prepare Department Refill',
//             category: 'refills',
//             description: 'Ship a delivery from warehouse stock.',
//         },
//         {
//             code: PERMISSIONS.CONFIRM_DEPARTMENT_DELIVERY,
//             name: 'Confirm Department Delivery',
//             category: 'refills',
//             description:
//                 'Confirm received quantities at the destination department.',
//         },
//         {
//             code: PERMISSIONS.VIEW_INVENTORY,
//             name: 'View Inventory',
//             category: 'inventory',
//             description: 'View live stock, batches, and transactions.',
//         },
//         {
//             code: PERMISSIONS.TRANSFER_INVENTORY,
//             name: 'Transfer Inventory',
//             category: 'inventory',
//             description:
//                 'Move stock between departments outside the refill flow.',
//         },
//         {
//             code: PERMISSIONS.PERFORM_INVENTORY_ADJUSTMENT,
//             name: 'Perform Inventory Adjustment',
//             category: 'inventory',
//             description: 'Record damaged, expired, shrinkage, or found stock.',
//         },
//         {
//             code: PERMISSIONS.PERFORM_STOCK_COUNT,
//             name: 'Perform Stock Count',
//             category: 'inventory',
//             description: 'Run physical stock counts and reconcile variances.',
//         },
//         {
//             code: PERMISSIONS.RECORD_DEPARTMENT_CONSUMPTION,
//             name: 'Record Department Consumption',
//             category: 'inventory',
//             description: 'Log general (non-prescription) stock usage.',
//         },
//         {
//             code: PERMISSIONS.ADD_PATIENT,
//             name: 'Add Patient',
//             category: 'patients',
//             description: 'Register new patients.',
//         },
//         {
//             code: PERMISSIONS.VIEW_PATIENTS,
//             name: 'View Patients',
//             category: 'patients',
//             description: 'Search and view patient records.',
//         },
//         {
//             code: PERMISSIONS.VIEW_PATIENT_HISTORY,
//             name: 'View Patient History',
//             category: 'patients',
//             description: "View a patient's full visit history.",
//         },
//         {
//             code: PERMISSIONS.MANAGE_DEPARTMENT_QUEUE,
//             name: 'Manage Department Queue',
//             category: 'clinical',
//             description: 'Add, lock, release, and remove queue entries.',
//         },
//         {
//             code: PERMISSIONS.CANCEL_VISIT,
//             name: 'Cancel Visit',
//             category: 'clinical',
//             description:
//                 'Cancel a completed medical visit on behalf of another doctor.',
//         },
//         {
//             code: PERMISSIONS.START_CONSULTATION,
//             name: 'Start Consultation',
//             category: 'clinical',
//             description:
//                 'Select a waiting patient and complete their consultation.',
//         },
//         {
//             code: PERMISSIONS.CREATE_PRESCRIPTION,
//             name: 'Create Prescription',
//             category: 'clinical',
//             description: 'Write prescriptions during a consultation.',
//         },
//         {
//             code: PERMISSIONS.RENEW_PRESCRIPTION,
//             name: 'Renew Prescription',
//             category: 'clinical',
//             description: 'Renew an existing prescription.',
//         },
//         {
//             code: PERMISSIONS.CANCEL_PRESCRIPTION,
//             name: 'Cancel Prescription',
//             category: 'clinical',
//             description: 'Cancel an active prescription.',
//         },
//         {
//             code: PERMISSIONS.MANAGE_ALL_PRESCRIPTIONS,
//             name: 'Manage All Prescriptions',
//             category: 'clinical',
//             description: 'Renew/cancel prescriptions written by other doctors.',
//         },
//         {
//             code: PERMISSIONS.DISPENSE_PRESCRIPTION,
//             name: 'Dispense Prescription',
//             category: 'pharmacy',
//             description: 'Dispense prescription items from pharmacy stock.',
//         },
//         {
//             code: PERMISSIONS.VIEW_REPORTS,
//             name: 'View Reports',
//             category: 'reports',
//             description: 'View general system reports.',
//         },
//         {
//             code: PERMISSIONS.VIEW_AI_INSIGHTS,
//             name: 'View AI Insights',
//             category: 'reports',
//             description: 'View AI-generated operational insights.',
//         },
//         {
//             code: PERMISSIONS.REVIEW_AI_INSIGHTS,
//             name: 'Review AI Insights',
//             category: 'reports',
//             description: 'Approve or dismiss AI-generated insights.',
//         },
//         {
//             code: PERMISSIONS.MANAGE_PERIODIC_REFILL_SCHEDULES,
//             name: 'Manage Periodic Refill Schedules',
//             category: 'refills',
//             description: 'View and cancel recurring refill schedules.',
//         },
//     ];

//     const permissions = await Promise.all(
//         permissionDefs.map((p) =>
//             prisma.permission.create({
//                 data: {
//                     code: p.code,
//                     name: p.name,
//                     category: p.category,
//                     description: p.description,
//                 },
//             }),
//         ),
//     );
//     const permByCode = new Map(permissions.map((p) => [p.code, p.id]));
//     const codesOf = (codes: string[]) =>
//         codes.map((c) => permByCode.get(c)!).filter(Boolean);

//     console.log('--- 2. Roles ---');
//     const roleHospitalManager = await prisma.role.create({
//         data: {
//             name: HOSPITAL_MANAGER_ROLE_NAME,
//             description: 'Fixed, singular master account for the hospital.',
//             isSystem: true,
//         },
//     });
//     const roleWarehouseManager = await prisma.role.create({
//         data: {
//             name: WAREHOUSE_MANAGER_ROLE_NAME,
//             description:
//                 'Manages the Central Warehouse: refill approvals, preparation, purchasing receipt.',
//             isSystem: true,
//         },
//     });
//     const rolePurchasingManager = await prisma.role.create({
//         data: {
//             name: PURCHASING_MANAGER_ROLE_NAME,
//             description:
//                 'Purchasing committee: creates and approves purchase requests.',
//             isSystem: true,
//         },
//     });
//     const roleReceptionStaff = await prisma.role.create({
//         data: {
//             name: RECEPTION_STAFF_ROLE_NAME,
//             description:
//                 'Front desk: registers patients and manages department queues.',
//             isSystem: true,
//         },
//     });
//     const roleDoctor = await prisma.role.create({
//         data: {
//             name: DOCTOR_ROLE_NAME,
//             description: 'Clinical staff: consultations and prescriptions.',
//             isSystem: true,
//         },
//     });
//     const roleDepartmentManager = await prisma.role.create({
//         data: {
//             name: DEPARTMENT_MANAGER_ROLE_NAME,
//             description:
//                 'Manages a single clinical department: refills, inventory, queue oversight.',
//         },
//     });
//     const rolePharmacyStaff = await prisma.role.create({
//         data: {
//             name: PHARMACY_STAFF_ROLE_NAME,
//             description:
//                 'Pharmacy department: dispensing and pharmacy stock management.',
//         },
//     });
//     // Dedicated super-admin role (isSuperAdmin lives on the ROLE, not the user —
//     // see explanation above). Kept isSystem so it can't be deleted by accident.
//     const roleSuperAdmin = await prisma.role.create({
//         data: {
//             name: SUPER_ADMIN_ROLE_NAME,
//             description: 'Full, unrestricted system access.',
//             isSystem: true,
//             isSuperAdmin: true,
//         },
//     });

//     console.log('--- 3. Role -> Permission grants ---');
//     await prisma.rolePermission.createMany({
//         data: [
//             ...codesOf([
//                 PERMISSIONS.MANAGE_DEPARTMENTS,
//                 PERMISSIONS.MANAGE_ACCOUNTS,
//                 PERMISSIONS.MANAGE_ROLES,
//                 PERMISSIONS.MANAGE_USER_PERMISSIONS,
//                 PERMISSIONS.MANAGE_DOCTORS,
//                 PERMISSIONS.APPROVE_PURCHASE_REQUEST_HOSPITAL,
//                 PERMISSIONS.APPROVE_DEPARTMENT_REFILL_REQUEST_HOSPITAL,
//                 PERMISSIONS.VIEW_PURCHASING_HISTORY,
//                 PERMISSIONS.VIEW_PURCHASING_REPORTS,
//                 PERMISSIONS.VIEW_INVENTORY,
//                 PERMISSIONS.VIEW_PATIENTS,
//                 PERMISSIONS.VIEW_PATIENT_HISTORY,
//                 PERMISSIONS.CANCEL_VISIT,
//                 PERMISSIONS.MANAGE_ALL_PRESCRIPTIONS,
//                 PERMISSIONS.VIEW_REPORTS,
//                 PERMISSIONS.VIEW_AI_INSIGHTS,
//                 PERMISSIONS.REVIEW_AI_INSIGHTS,
//             ]).map((permissionId) => ({
//                 roleId: roleHospitalManager.id,
//                 permissionId,
//             })),

//             ...codesOf([
//                 PERMISSIONS.APPROVE_DEPARTMENT_REFILL_REQUEST_MANAGER,
//                 PERMISSIONS.PREPARE_DEPARTMENT_REFILL,
//                 PERMISSIONS.RECEIVE_PURCHASE,
//                 PERMISSIONS.MANAGE_PERIODIC_REFILL_SCHEDULES,
//                 PERMISSIONS.VIEW_INVENTORY,
//                 PERMISSIONS.TRANSFER_INVENTORY,
//                 PERMISSIONS.PERFORM_INVENTORY_ADJUSTMENT,
//                 PERMISSIONS.PERFORM_STOCK_COUNT,
//                 PERMISSIONS.MANAGE_MATERIALS,
//                 PERMISSIONS.MANAGE_DEPARTMENT_MATERIALS,
//                 PERMISSIONS.MANAGE_UNITS,
//                 PERMISSIONS.MANAGE_CATEGORIES,
//                 PERMISSIONS.MANAGE_SUPPLIERS,
//                 PERMISSIONS.MANAGE_MATERIAL_SUPPLIERS,
//                 PERMISSIONS.VIEW_PURCHASING_HISTORY,
//             ]).map((permissionId) => ({
//                 roleId: roleWarehouseManager.id,
//                 permissionId,
//             })),

//             ...codesOf([
//                 PERMISSIONS.CREATE_PURCHASE_REQUEST,
//                 PERMISSIONS.APPROVE_PURCHASE_REQUEST_MANAGER,
//                 PERMISSIONS.CONFIRM_PURCHASE_RECEIPT,
//                 PERMISSIONS.VIEW_PURCHASING_HISTORY,
//                 PERMISSIONS.VIEW_PURCHASING_REPORTS,
//                 PERMISSIONS.VIEW_INVENTORY,
//                 PERMISSIONS.MANAGE_SUPPLIERS,
//                 PERMISSIONS.MANAGE_MATERIAL_SUPPLIERS,
//             ]).map((permissionId) => ({
//                 roleId: rolePurchasingManager.id,
//                 permissionId,
//             })),

//             ...codesOf([
//                 PERMISSIONS.ADD_PATIENT,
//                 PERMISSIONS.VIEW_PATIENTS,
//                 PERMISSIONS.MANAGE_DEPARTMENT_QUEUE,
//             ]).map((permissionId) => ({
//                 roleId: roleReceptionStaff.id,
//                 permissionId,
//             })),

//             ...codesOf([
//                 PERMISSIONS.VIEW_PATIENTS,
//                 PERMISSIONS.VIEW_PATIENT_HISTORY,
//                 PERMISSIONS.START_CONSULTATION,
//                 PERMISSIONS.CREATE_PRESCRIPTION,
//                 PERMISSIONS.RENEW_PRESCRIPTION,
//                 PERMISSIONS.CANCEL_PRESCRIPTION,
//             ]).map((permissionId) => ({ roleId: roleDoctor.id, permissionId })),

//             ...codesOf([
//                 PERMISSIONS.CREATE_DEPARTMENT_REFILL_REQUEST,
//                 PERMISSIONS.CONFIRM_DEPARTMENT_DELIVERY,
//                 PERMISSIONS.VIEW_INVENTORY,
//                 PERMISSIONS.PERFORM_INVENTORY_ADJUSTMENT,
//                 PERMISSIONS.PERFORM_STOCK_COUNT,
//                 PERMISSIONS.RECORD_DEPARTMENT_CONSUMPTION,
//                 PERMISSIONS.MANAGE_DEPARTMENT_QUEUE,
//                 PERMISSIONS.VIEW_PATIENTS,
//                 PERMISSIONS.VIEW_PATIENT_HISTORY,
//                 PERMISSIONS.CANCEL_VISIT,
//             ]).map((permissionId) => ({
//                 roleId: roleDepartmentManager.id,
//                 permissionId,
//             })),

//             ...codesOf([
//                 PERMISSIONS.DISPENSE_PRESCRIPTION,
//                 PERMISSIONS.VIEW_INVENTORY,
//                 PERMISSIONS.VIEW_PATIENTS,
//                 PERMISSIONS.CREATE_DEPARTMENT_REFILL_REQUEST,
//                 PERMISSIONS.CONFIRM_DEPARTMENT_DELIVERY,
//                 PERMISSIONS.PERFORM_INVENTORY_ADJUSTMENT,
//                 PERMISSIONS.PERFORM_STOCK_COUNT,
//             ]).map((permissionId) => ({
//                 roleId: rolePharmacyStaff.id,
//                 permissionId,
//             })),

//             // super_admin intentionally gets NO explicit role_permissions rows:
//             // PermissionsResolverService grants isSuperAdmin roles every
//             // permission in the system regardless of this table's contents.
//         ],
//     });

//     console.log(
//         '--- 4. Departments (created without a manager first; backfilled after users exist) ---',
//     );
//     const deptCentralWarehouse = await prisma.department.create({
//         data: {
//             name: 'Central Warehouse',
//             type: DepartmentType.central_warehouse,
//             hasQueue: false,
//         },
//     });
//     const deptPharmacy = await prisma.department.create({
//         data: {
//             name: 'Pharmacy',
//             type: DepartmentType.pharmacy,
//             hasQueue: false,
//         },
//     });
//     const deptEmergency = await prisma.department.create({
//         data: {
//             name: 'Emergency',
//             type: DepartmentType.standard,
//             hasQueue: true,
//         },
//     });
//     const deptPediatrics = await prisma.department.create({
//         data: {
//             name: 'Pediatrics',
//             type: DepartmentType.standard,
//             hasQueue: true,
//         },
//     });
//     const deptInternalMedicine = await prisma.department.create({
//         data: {
//             name: 'Internal Medicine',
//             type: DepartmentType.standard,
//             hasQueue: true,
//         },
//     });

//     console.log('--- 5. Users (from the account list you provided) ---');
//     const userHassan = await prisma.user.create({
//         data: {
//             fullName: 'Hassan Mohammad',
//             phone: '+966500000001',
//             email: 'hassanmohammad0010@gmail.com',
//             roleId: roleHospitalManager.id,
//             status: UserStatus.active,
//         },
//     });
//     // Dedicated super_admin role instead of flipping isSuperAdmin on
//     // warehouse_manager (that flag lives on Role, so it would affect every
//     // future warehouse manager too). He remains Central Warehouse's manager
//     // via Department.managerId, which is independent of role.
//     const userHamedDev = await prisma.user.create({
//         data: {
//             fullName: 'Hamed Zaher',
//             phone: '+966500000002',
//             email: 'hamedzaher.dev@gmail.com',
//             roleId: roleSuperAdmin.id,
//             departmentId: deptCentralWarehouse.id,
//             status: UserStatus.active,
//             createdById: userHassan.id,
//         },
//     });
//     const userPurchasingManager = await prisma.user.create({
//         data: {
//             fullName: 'Purchasing Committee Manager',
//             phone: '+966500000003',
//             email: 'ghj8919@gmail.com',
//             roleId: rolePurchasingManager.id,
//             status: UserStatus.active,
//             createdById: userHassan.id,
//         },
//     });
//     const userBashar = await prisma.user.create({
//         data: {
//             fullName: 'Bashar Mohammad',
//             phone: '+966500000004',
//             email: 'basharman2003@gmail.com',
//             roleId: rolePharmacyStaff.id,
//             departmentId: deptPharmacy.id,
//             status: UserStatus.active,
//             createdById: userHassan.id,
//         },
//     });
//     const userEmergencyManager = await prisma.user.create({
//         data: {
//             fullName: 'Emergency Department Manager',
//             phone: '+966500000005',
//             email: '0938825359b@gmail.com',
//             roleId: roleDepartmentManager.id,
//             departmentId: deptEmergency.id,
//             status: UserStatus.active,
//             createdById: userHassan.id,
//         },
//     });
//     const userDrHamed90 = await prisma.user.create({
//         data: {
//             fullName: 'Dr. Hamed Zaher',
//             phone: '+966500000006',
//             email: 'hamedzaher90@gmail.com',
//             roleId: roleDoctor.id,
//             departmentId: deptEmergency.id,
//             specialty: 'Emergency Medicine',
//             status: UserStatus.active,
//             createdById: userHassan.id,
//         },
//     });
//     const userInternalMedManager = await prisma.user.create({
//         data: {
//             fullName: 'Internal Medicine Manager',
//             phone: '+966500000007',
//             email: 'internalmed.manager@example.com',
//             roleId: roleDepartmentManager.id,
//             departmentId: deptInternalMedicine.id,
//             status: UserStatus.active,
//             createdById: userHassan.id,
//         },
//     });
//     const userPediatricsManager = await prisma.user.create({
//         data: {
//             fullName: 'Pediatrics Manager',
//             phone: '+966500000008',
//             email: 'pediatrics.manager@example.com',
//             roleId: roleDepartmentManager.id,
//             departmentId: deptPediatrics.id,
//             status: UserStatus.active,
//             createdById: userHassan.id,
//         },
//     });
//     const userDrSara = await prisma.user.create({
//         data: {
//             fullName: 'Dr. Sara Ahmed',
//             phone: '+966500000009',
//             email: 'doctor.sara@example.com',
//             roleId: roleDoctor.id,
//             departmentId: deptInternalMedicine.id,
//             specialty: 'Internal Medicine',
//             status: UserStatus.active,
//             createdById: userHassan.id,
//         },
//     });
//     const userDrLina = await prisma.user.create({
//         data: {
//             fullName: 'Dr. Lina Youssef',
//             phone: '+966500000010',
//             email: 'doctor.lina@example.com',
//             roleId: roleDoctor.id,
//             departmentId: deptPediatrics.id,
//             specialty: 'Pediatrics',
//             status: UserStatus.active,
//             createdById: userHassan.id,
//         },
//     });
//     const userReceptionOne = await prisma.user.create({
//         data: {
//             fullName: 'Reception Staff One',
//             phone: '+966500000011',
//             email: 'reception.one@example.com',
//             roleId: roleReceptionStaff.id,
//             status: UserStatus.active,
//             createdById: userHassan.id,
//         },
//     });
//     // Kept exactly as shown in the screenshot (name says "New Doctor" but the
//     // role is reception_staff) — reproducing your real account list as-is.
//     const userNewDoctor = await prisma.user.create({
//         data: {
//             fullName: 'New Doctor',
//             email: 'r@gmail.com',
//             roleId: roleReceptionStaff.id,
//             departmentId: deptEmergency.id,
//             status: UserStatus.active,
//             createdById: userHassan.id,
//         },
//     });
//     const userDoctorOne = await prisma.user.create({
//         data: {
//             fullName: 'Doctor One',
//             email: 'd1@gmail.com',
//             roleId: roleDoctor.id,
//             departmentId: deptInternalMedicine.id,
//             specialty: 'Cardiology',
//             status: UserStatus.active,
//             createdById: userHassan.id,
//         },
//     });
//     const userDoctorTwo = await prisma.user.create({
//         data: {
//             fullName: 'Doctor Two',
//             email: 'd2@gmail.com',
//             roleId: roleDoctor.id,
//             departmentId: deptInternalMedicine.id,
//             specialty: 'Neurology',
//             status: UserStatus.active,
//             createdById: userHassan.id,
//         },
//     });

//     console.log('--- 6. Backfill department managers ---');
//     await prisma.department.update({
//         where: { id: deptCentralWarehouse.id },
//         data: { managerId: userHamedDev.id },
//     });
//     await prisma.department.update({
//         where: { id: deptPharmacy.id },
//         data: { managerId: userBashar.id },
//     });
//     await prisma.department.update({
//         where: { id: deptEmergency.id },
//         data: { managerId: userEmergencyManager.id },
//     });
//     await prisma.department.update({
//         where: { id: deptPediatrics.id },
//         data: { managerId: userPediatricsManager.id },
//     });
//     await prisma.department.update({
//         where: { id: deptInternalMedicine.id },
//         data: { managerId: userInternalMedManager.id },
//     });

//     console.log('--- 7. User permission overrides ---');
//     await prisma.userPermission.createMany({
//         data: [
//             {
//                 userId: userInternalMedManager.id,
//                 permissionId: permByCode.get(
//                     PERMISSIONS.MANAGE_ALL_PRESCRIPTIONS,
//                 )!,
//                 effect: 'grant',
//                 grantedById: userHassan.id,
//                 reason: 'Oversees all doctors in Internal Medicine; needs to renew/cancel on their behalf.',
//             },
//             {
//                 userId: userReceptionOne.id,
//                 permissionId: permByCode.get(PERMISSIONS.ADD_PATIENT)!,
//                 effect: 'revoke',
//                 grantedById: userHassan.id,
//                 reason: 'Temporarily restricted pending registration-desk training.',
//             },
//             {
//                 userId: userPediatricsManager.id,
//                 permissionId: permByCode.get(PERMISSIONS.VIEW_AI_INSIGHTS)!,
//                 effect: 'grant',
//                 grantedById: userHassan.id,
//                 reason: 'Pilot access to AI insights for Pediatrics.',
//             },
//         ],
//     });

//     console.log('--- 8. Sessions & OTP codes ---');
//     await prisma.session.createMany({
//         data: [
//             {
//                 userId: userHassan.id,
//                 platform: SessionPlatform.web,
//                 accessTokenHash: fakeToken(),
//                 refreshTokenHash: fakeToken(),
//                 deviceInfo: 'Chrome on Windows',
//                 ipAddress: '10.0.0.1',
//                 accessExpiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
//                 refreshExpiresAt: new Date(
//                     Date.now() + 30 * 24 * 60 * 60 * 1000,
//                 ),
//             },
//             {
//                 userId: userHamedDev.id,
//                 platform: SessionPlatform.web,
//                 accessTokenHash: fakeToken(),
//                 refreshTokenHash: fakeToken(),
//                 deviceInfo: 'Chrome on macOS',
//                 ipAddress: '10.0.0.2',
//                 accessExpiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
//                 refreshExpiresAt: new Date(
//                     Date.now() + 30 * 24 * 60 * 60 * 1000,
//                 ),
//             },
//             {
//                 userId: userDrHamed90.id,
//                 platform: SessionPlatform.mobile,
//                 accessTokenHash: fakeToken(),
//                 refreshTokenHash: fakeToken(),
//                 deviceInfo: 'iOS App',
//                 ipAddress: '10.0.0.3',
//                 accessExpiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
//                 refreshExpiresAt: new Date(
//                     Date.now() + 30 * 24 * 60 * 60 * 1000,
//                 ),
//             },
//         ],
//     });

//     const otpHash = await bcrypt.hash('123456', 10);
//     await prisma.otpCode.createMany({
//         data: [
//             {
//                 userId: userBashar.id,
//                 channel: OtpChannel.email,
//                 destination: userBashar.email!,
//                 code: otpHash,
//                 attempts: 0,
//                 consumed: true,
//                 expiresAt: new Date(Date.now() - 60 * 60 * 1000),
//             },
//             {
//                 userId: userEmergencyManager.id,
//                 channel: OtpChannel.phone,
//                 destination: userEmergencyManager.phone!,
//                 code: otpHash,
//                 attempts: 1,
//                 consumed: false,
//                 expiresAt: new Date(Date.now() - 5 * 60 * 1000), // expired, unused
//             },
//             {
//                 userId: userDrLina.id,
//                 channel: OtpChannel.email,
//                 destination: userDrLina.email!,
//                 code: otpHash,
//                 attempts: 0,
//                 consumed: false,
//                 expiresAt: new Date(Date.now() + 5 * 60 * 1000), // still active
//             },
//         ],
//     });

//     console.log('--- 9. Suppliers ---');
//     const supplierMedi = await prisma.supplier.create({
//         data: {
//             name: 'MediSupply Co.',
//             phone: '+966112223333',
//             email: 'sales@medisupply.example.com',
//             address: 'Riyadh Industrial District, Bldg 12',
//         },
//     });
//     const supplierPharmaCare = await prisma.supplier.create({
//         data: {
//             name: 'PharmaCare Distributors',
//             phone: '+966114445555',
//             email: 'orders@pharmacare.example.com',
//             address: 'Jeddah, Warehouse Zone 4',
//         },
//     });
//     const supplierGlobalHealth = await prisma.supplier.create({
//         data: {
//             name: 'Global Health Logistics',
//             phone: '+966116667777',
//             email: 'contact@ghlogistics.example.com',
//             address: 'Dammam Free Zone, Unit 9',
//         },
//     });

//     console.log('--- 10. Units ---');
//     const unitBox = await prisma.unit.create({
//         data: { name: 'Box', abbreviation: 'box' },
//     });
//     const unitBottle = await prisma.unit.create({
//         data: { name: 'Bottle', abbreviation: 'btl' },
//     });
//     const unitPiece = await prisma.unit.create({
//         data: { name: 'Piece', abbreviation: 'pc' },
//     });
//     const unitVial = await prisma.unit.create({
//         data: { name: 'Vial', abbreviation: 'vial' },
//     });

//     console.log('--- 11. Categories ---');
//     const catMedications = await prisma.category.create({
//         data: { name: 'Medications' },
//     });
//     const catAntibiotics = await prisma.category.create({
//         data: { name: 'Antibiotics', parentCategoryId: catMedications.id },
//     });
//     const catAnalgesics = await prisma.category.create({
//         data: { name: 'Analgesics', parentCategoryId: catMedications.id },
//     });
//     const catMedicalSupplies = await prisma.category.create({
//         data: { name: 'Medical Supplies' },
//     });
//     const catSurgicalEquipment = await prisma.category.create({
//         data: { name: 'Surgical Equipment' },
//     });

//     console.log('--- 12. Products ---');
//     const productAmoxicillin = await prisma.product.create({
//         data: {
//             name: 'Amoxicillin 500mg',
//             categoryId: catAntibiotics.id,
//             materialType: MaterialType.consumable,
//             description: 'Broad-spectrum antibiotic, 500mg capsules.',
//             createdById: userHamedDev.id,
//         },
//     });
//     const productParacetamol = await prisma.product.create({
//         data: {
//             name: 'Paracetamol 500mg',
//             categoryId: catAnalgesics.id,
//             materialType: MaterialType.consumable,
//             description: 'Analgesic / antipyretic tablets.',
//             createdById: userHamedDev.id,
//         },
//     });
//     const productIvCannula = await prisma.product.create({
//         data: {
//             name: 'IV Cannula 18G',
//             categoryId: catMedicalSupplies.id,
//             materialType: MaterialType.consumable,
//             description: 'Sterile intravenous cannula, 18 gauge.',
//             createdById: userHamedDev.id,
//         },
//     });
//     const productSurgicalScissors = await prisma.product.create({
//         data: {
//             name: 'Surgical Scissors',
//             categoryId: catSurgicalEquipment.id,
//             materialType: MaterialType.fixed_asset,
//             description: 'Reusable stainless steel surgical scissors.',
//             createdById: userHamedDev.id,
//         },
//     });

//     console.log('--- 13. Product Variants ---');
//     const variantAmoxicillin = await prisma.productVariant.create({
//         data: {
//             productId: productAmoxicillin.id,
//             variantName: 'Amoxicillin 500mg - Box of 100',
//             sku: 'AMOX500-BOX100',
//             unitId: unitBox.id,
//             createdById: userHamedDev.id,
//         },
//     });
//     const variantParacetamol = await prisma.productVariant.create({
//         data: {
//             productId: productParacetamol.id,
//             variantName: 'Paracetamol 500mg - Bottle of 200',
//             sku: 'PARA500-BOT200',
//             unitId: unitBottle.id,
//             createdById: userHamedDev.id,
//         },
//     });
//     const variantIvCannula = await prisma.productVariant.create({
//         data: {
//             productId: productIvCannula.id,
//             variantName: 'IV Cannula 18G - Box of 50',
//             sku: 'IVCAN18-BOX50',
//             unitId: unitBox.id,
//             createdById: userHamedDev.id,
//         },
//     });
//     const variantSurgicalScissors = await prisma.productVariant.create({
//         data: {
//             productId: productSurgicalScissors.id,
//             variantName: 'Surgical Scissors - Single Piece',
//             sku: 'SURGSCIS-PC',
//             unitId: unitPiece.id,
//             createdById: userHamedDev.id,
//         },
//     });

//     console.log('--- 14. Variant <-> Supplier links ---');
//     await prisma.variantSupplier.createMany({
//         data: [
//             {
//                 variantId: variantAmoxicillin.id,
//                 supplierId: supplierMedi.id,
//                 expectedPurchasePrice: 2.5,
//                 supplierProductCode: 'MS-AMX500',
//                 isPreferred: true,
//             },
//             {
//                 variantId: variantAmoxicillin.id,
//                 supplierId: supplierPharmaCare.id,
//                 expectedPurchasePrice: 2.75,
//                 supplierProductCode: 'PC-AMX500',
//             },
//             {
//                 variantId: variantParacetamol.id,
//                 supplierId: supplierPharmaCare.id,
//                 expectedPurchasePrice: 1.8,
//                 supplierProductCode: 'PC-PCM500',
//                 isPreferred: true,
//             },
//             {
//                 variantId: variantIvCannula.id,
//                 supplierId: supplierGlobalHealth.id,
//                 expectedPurchasePrice: 5.0,
//                 supplierProductCode: 'GHL-IVC18',
//                 isPreferred: true,
//             },
//             {
//                 variantId: variantSurgicalScissors.id,
//                 supplierId: supplierMedi.id,
//                 expectedPurchasePrice: 12.0,
//                 supplierProductCode: 'MS-SURSC',
//                 isPreferred: true,
//             },
//         ],
//     });

//     console.log('--- 15. Department stock settings ---');
//     await prisma.departmentStockSetting.createMany({
//         data: [
//             {
//                 variantId: variantAmoxicillin.id,
//                 departmentId: deptPharmacy.id,
//                 storageLocation: 'Shelf A1',
//                 minimumStock: 50,
//                 maximumStock: 500,
//                 createdById: userBashar.id,
//             },
//             {
//                 variantId: variantParacetamol.id,
//                 departmentId: deptPharmacy.id,
//                 storageLocation: 'Shelf A2',
//                 minimumStock: 50,
//                 maximumStock: 500,
//                 createdById: userBashar.id,
//             },
//             {
//                 variantId: variantIvCannula.id,
//                 departmentId: deptEmergency.id,
//                 storageLocation: 'Supply Cart 1',
//                 minimumStock: 20,
//                 maximumStock: 200,
//                 createdById: userEmergencyManager.id,
//             },
//             {
//                 variantId: variantParacetamol.id,
//                 departmentId: deptPediatrics.id,
//                 storageLocation: 'Cabinet B',
//                 minimumStock: 10,
//                 maximumStock: 100,
//                 createdById: userPediatricsManager.id,
//             },
//         ],
//     });

//     // ============================================================
//     // PURCHASING: PR1 (Amoxicillin + Paracetamol, 2 receipts) ->
//     // PR2 (IV Cannula, 1 receipt) -> PR3 (draft, no receipt)
//     // ============================================================
//     console.log('--- 16. Purchase Requests ---');

//     const pr1 = await prisma.purchaseRequest.create({
//         data: {
//             requestNumber: generateRequestNumber('PR'),
//             requestedById: userPurchasingManager.id,
//             status: RequestStatus.pending_manager_approval,
//             priority: RefillRequestPriority.normal,
//             hospitalApprovedById: userHassan.id,
//             hospitalApprovedAt: new Date('2026-05-28'),
//             notes: 'Quarterly restock for Amoxicillin and Paracetamol.',
//         },
//     });
//     const pr1ItemAmox = await prisma.purchaseRequestItem.create({
//         data: {
//             purchaseRequestId: pr1.id,
//             variantId: variantAmoxicillin.id,
//             requestedQuantity: 500,
//             estimatedPrice: 2.5,
//         },
//     });
//     const pr1ItemPara = await prisma.purchaseRequestItem.create({
//         data: {
//             purchaseRequestId: pr1.id,
//             variantId: variantParacetamol.id,
//             requestedQuantity: 300,
//             estimatedPrice: 1.8,
//         },
//     });

//     const pr2 = await prisma.purchaseRequest.create({
//         data: {
//             requestNumber: generateRequestNumber('PR'),
//             requestedById: userPurchasingManager.id,
//             status: RequestStatus.pending_manager_approval,
//             priority: RefillRequestPriority.urgent,
//             hospitalApprovedById: userHassan.id,
//             hospitalApprovedAt: new Date('2026-05-30'),
//             notes: 'Urgent IV cannula restock — Emergency running low.',
//         },
//     });
//     const pr2ItemIvCannula = await prisma.purchaseRequestItem.create({
//         data: {
//             purchaseRequestId: pr2.id,
//             variantId: variantIvCannula.id,
//             requestedQuantity: 200,
//             estimatedPrice: 5.0,
//         },
//     });

//     const pr3 = await prisma.purchaseRequest.create({
//         data: {
//             requestNumber: generateRequestNumber('PR'),
//             requestedById: userPurchasingManager.id,
//             status: RequestStatus.draft,
//             priority: RefillRequestPriority.normal,
//             notes: 'Draft — surgical scissors replacement, still gathering quotes.',
//         },
//     });
//     await prisma.purchaseRequestItem.create({
//         data: {
//             purchaseRequestId: pr3.id,
//             variantId: variantSurgicalScissors.id,
//             requestedQuantity: 20,
//             estimatedPrice: 12.0,
//         },
//     });

//     console.log('--- 17. Approve PR1 & PR2 with quantities (-> preparing) ---');
//     await prisma.purchaseRequest.update({
//         where: { id: pr1.id },
//         data: {
//             status: RequestStatus.preparing,
//             approvedById: userPurchasingManager.id,
//             approvedAt: new Date('2026-05-29'),
//         },
//     });
//     await prisma.purchaseRequestItem.update({
//         where: { id: pr1ItemAmox.id },
//         data: { approvedQuantity: 500 },
//     });
//     await prisma.purchaseRequestItem.update({
//         where: { id: pr1ItemPara.id },
//         data: { approvedQuantity: 300 },
//     });

//     await prisma.purchaseRequest.update({
//         where: { id: pr2.id },
//         data: {
//             status: RequestStatus.preparing,
//             approvedById: userPurchasingManager.id,
//             approvedAt: new Date('2026-05-31'),
//         },
//     });
//     await prisma.purchaseRequestItem.update({
//         where: { id: pr2ItemIvCannula.id },
//         data: { approvedQuantity: 200 },
//     });

//     console.log(
//         '--- 18. Purchase Receipts, confirmations, Batches, BatchStock, ledger ---',
//     );

//     // Receipt A for PR1 (partial: Amoxicillin 300 of 500, Paracetamol 300 of 300)
//     const receiptA = await prisma.purchaseReceipt.create({
//         data: {
//             purchaseRequestId: pr1.id,
//             supplierId: supplierMedi.id,
//             receivedById: userHamedDev.id,
//             receivingDate: new Date('2026-06-01'),
//             type: BatchType.batch,
//             status: PurchaseReceiptStatus.pending_confirmation,
//             receiptImageKey: 'seed/receipts/pr1-receipt-a.jpg',
//             notes: 'First partial shipment.',
//         },
//     });
//     const receiptAItemAmox = await prisma.purchaseReceiptItem.create({
//         data: {
//             purchaseReceiptId: receiptA.id,
//             purchaseRequestItemId: pr1ItemAmox.id,
//             variantId: variantAmoxicillin.id,
//             expectedQuantity: 500,
//             quantity: 300,
//             quantityDiscrepancy: 200,
//             batchNumber: 'AMX-2026-001',
//             manufacturingDate: new Date('2026-01-10'),
//             expirationDate: new Date('2028-01-10'),
//             purchasePrice: 2.5,
//         },
//     });
//     const receiptAItemPara = await prisma.purchaseReceiptItem.create({
//         data: {
//             purchaseReceiptId: receiptA.id,
//             purchaseRequestItemId: pr1ItemPara.id,
//             variantId: variantParacetamol.id,
//             expectedQuantity: 300,
//             quantity: 300,
//             quantityDiscrepancy: 0,
//             batchNumber: 'PCM-2026-001',
//             manufacturingDate: new Date('2026-02-01'),
//             expirationDate: new Date('2028-02-01'),
//             purchasePrice: 1.8,
//         },
//     });

//     // Receipt B for PR1 (final: remaining Amoxicillin 200)
//     const receiptB = await prisma.purchaseReceipt.create({
//         data: {
//             purchaseRequestId: pr1.id,
//             supplierId: supplierMedi.id,
//             receivedById: userHamedDev.id,
//             receivingDate: new Date('2026-06-10'),
//             type: BatchType.final_batch,
//             status: PurchaseReceiptStatus.pending_confirmation,
//             receiptImageKey: 'seed/receipts/pr1-receipt-b.jpg',
//             notes: 'Final shipment closing out the Amoxicillin line.',
//         },
//     });
//     const receiptBItemAmox = await prisma.purchaseReceiptItem.create({
//         data: {
//             purchaseReceiptId: receiptB.id,
//             purchaseRequestItemId: pr1ItemAmox.id,
//             variantId: variantAmoxicillin.id,
//             expectedQuantity: 200,
//             quantity: 200,
//             quantityDiscrepancy: 0,
//             batchNumber: 'AMX-2026-002',
//             manufacturingDate: new Date('2026-03-15'),
//             expirationDate: new Date('2028-03-15'),
//             purchasePrice: 2.55,
//         },
//     });

//     // Receipt for PR2 (final: IV Cannula 200)
//     const receiptC = await prisma.purchaseReceipt.create({
//         data: {
//             purchaseRequestId: pr2.id,
//             supplierId: supplierGlobalHealth.id,
//             receivedById: userHamedDev.id,
//             receivingDate: new Date('2026-06-05'),
//             type: BatchType.final_batch,
//             status: PurchaseReceiptStatus.pending_confirmation,
//             receiptImageKey: 'seed/receipts/pr2-receipt.jpg',
//         },
//     });
//     const receiptCItemIvCannula = await prisma.purchaseReceiptItem.create({
//         data: {
//             purchaseReceiptId: receiptC.id,
//             purchaseRequestItemId: pr2ItemIvCannula.id,
//             variantId: variantIvCannula.id,
//             expectedQuantity: 200,
//             quantity: 200,
//             quantityDiscrepancy: 0,
//             batchNumber: 'IVC-2026-001',
//             manufacturingDate: new Date('2026-01-20'),
//             expirationDate: new Date('2029-01-20'),
//             purchasePrice: 5.0,
//         },
//     });

//     // Helper: confirm a receipt item -> create Batch + warehouse BatchStock + ledger entry.
//     async function confirmReceiptItem(params: {
//         receiptItemId: string;
//         variantId: string;
//         supplierId: string;
//         batchNumber: string;
//         confirmedQuantity: number;
//         manufacturingDate: Date;
//         expirationDate: Date;
//         purchasePrice: number;
//         receivingDate: Date;
//         confirmedById: string;
//         performedById: string;
//         receiptId: string;
//     }) {
//         await prisma.purchaseReceiptItem.update({
//             where: { id: params.receiptItemId },
//             data: {
//                 confirmedQuantity: params.confirmedQuantity,
//                 confirmedQuantityDiscrepancy: 0,
//             },
//         });

//         const batch = await prisma.batch.create({
//             data: {
//                 purchaseReceiptItemId: params.receiptItemId,
//                 variantId: params.variantId,
//                 supplierId: params.supplierId,
//                 batchNumber: params.batchNumber,
//                 quantityReceived: params.confirmedQuantity,
//                 purchasePrice: params.purchasePrice,
//                 manufacturingDate: params.manufacturingDate,
//                 expirationDate: params.expirationDate,
//                 receivingDate: params.receivingDate,
//                 createdById: params.confirmedById,
//             },
//         });

//         const batchStock = await prisma.batchStock.create({
//             data: {
//                 batchId: batch.id,
//                 departmentId: deptCentralWarehouse.id,
//                 quantity: params.confirmedQuantity,
//             },
//         });

//         await prisma.inventoryTransaction.create({
//             data: {
//                 transactionType: 'purchase_receipt',
//                 variantId: params.variantId,
//                 batchId: batch.id,
//                 departmentId: deptCentralWarehouse.id,
//                 quantity: params.confirmedQuantity,
//                 balanceAfter: Number(batchStock.quantity),
//                 referenceType: 'purchase_receipt',
//                 referenceId: params.receiptId,
//                 performedById: params.performedById,
//             },
//         });

//         return batch;
//     }

//     const batchAmox1 = await confirmReceiptItem({
//         receiptItemId: receiptAItemAmox.id,
//         variantId: variantAmoxicillin.id,
//         supplierId: supplierMedi.id,
//         batchNumber: 'AMX-2026-001',
//         confirmedQuantity: 300,
//         manufacturingDate: new Date('2026-01-10'),
//         expirationDate: new Date('2028-01-10'),
//         purchasePrice: 2.5,
//         receivingDate: new Date('2026-06-01'),
//         confirmedById: userPurchasingManager.id,
//         performedById: userPurchasingManager.id,
//         receiptId: receiptA.id,
//     });
//     const batchParacetamol1 = await confirmReceiptItem({
//         receiptItemId: receiptAItemPara.id,
//         variantId: variantParacetamol.id,
//         supplierId: supplierMedi.id,
//         batchNumber: 'PCM-2026-001',
//         confirmedQuantity: 300,
//         manufacturingDate: new Date('2026-02-01'),
//         expirationDate: new Date('2028-02-01'),
//         purchasePrice: 1.8,
//         receivingDate: new Date('2026-06-01'),
//         confirmedById: userPurchasingManager.id,
//         performedById: userPurchasingManager.id,
//         receiptId: receiptA.id,
//     });
//     await prisma.purchaseReceipt.update({
//         where: { id: receiptA.id },
//         data: {
//             status: PurchaseReceiptStatus.confirmed,
//             confirmedById: userPurchasingManager.id,
//             confirmedAt: new Date('2026-06-01'),
//         },
//     });
//     // Amoxicillin only partially met (300 of 500 approved) -> partially_complete
//     await prisma.purchaseRequestItem.update({
//         where: { id: pr1ItemAmox.id },
//         data: { receivedQuantity: 300, quantityDiscrepancy: 200 },
//     });
//     await prisma.purchaseRequestItem.update({
//         where: { id: pr1ItemPara.id },
//         data: { receivedQuantity: 300, quantityDiscrepancy: 0 },
//     });
//     await prisma.purchaseRequest.update({
//         where: { id: pr1.id },
//         data: { status: RequestStatus.partially_complete },
//     });

//     const batchAmox2 = await confirmReceiptItem({
//         receiptItemId: receiptBItemAmox.id,
//         variantId: variantAmoxicillin.id,
//         supplierId: supplierMedi.id,
//         batchNumber: 'AMX-2026-002',
//         confirmedQuantity: 200,
//         manufacturingDate: new Date('2026-03-15'),
//         expirationDate: new Date('2028-03-15'),
//         purchasePrice: 2.55,
//         receivingDate: new Date('2026-06-10'),
//         confirmedById: userPurchasingManager.id,
//         performedById: userPurchasingManager.id,
//         receiptId: receiptB.id,
//     });
//     await prisma.purchaseReceipt.update({
//         where: { id: receiptB.id },
//         data: {
//             status: PurchaseReceiptStatus.confirmed,
//             confirmedById: userPurchasingManager.id,
//             confirmedAt: new Date('2026-06-10'),
//         },
//     });
//     // Final batch closes out the request regardless -> complete
//     await prisma.purchaseRequestItem.update({
//         where: { id: pr1ItemAmox.id },
//         data: { receivedQuantity: 500, quantityDiscrepancy: 0 },
//     });
//     await prisma.purchaseRequest.update({
//         where: { id: pr1.id },
//         data: { status: RequestStatus.complete },
//     });

//     const batchIvCannula1 = await confirmReceiptItem({
//         receiptItemId: receiptCItemIvCannula.id,
//         variantId: variantIvCannula.id,
//         supplierId: supplierGlobalHealth.id,
//         batchNumber: 'IVC-2026-001',
//         confirmedQuantity: 200,
//         manufacturingDate: new Date('2026-01-20'),
//         expirationDate: new Date('2029-01-20'),
//         purchasePrice: 5.0,
//         receivingDate: new Date('2026-06-05'),
//         confirmedById: userPurchasingManager.id,
//         performedById: userPurchasingManager.id,
//         receiptId: receiptC.id,
//     });
//     await prisma.purchaseReceipt.update({
//         where: { id: receiptC.id },
//         data: {
//             status: PurchaseReceiptStatus.confirmed,
//             confirmedById: userPurchasingManager.id,
//             confirmedAt: new Date('2026-06-05'),
//         },
//     });
//     await prisma.purchaseRequestItem.update({
//         where: { id: pr2ItemIvCannula.id },
//         data: { receivedQuantity: 200, quantityDiscrepancy: 0 },
//     });
//     await prisma.purchaseRequest.update({
//         where: { id: pr2.id },
//         data: { status: RequestStatus.complete },
//     });

//     // ============================================================
//     // DEPARTMENT REFILLS: warehouse -> departments
//     // ============================================================
//     console.log(
//         '--- 19. Department Refill Requests, deliveries, confirmations ---',
//     );

//     async function shipAndConfirm(params: {
//         refillRequestId: string;
//         refillItemId: string;
//         batchId: string;
//         variantId: string;
//         quantity: number;
//         toDepartmentId: string;
//         deliveryType: BatchType;
//         deliveredById: string;
//         receivedById: string;
//     }) {
//         const delivery = await prisma.departmentRefillDelivery.create({
//             data: {
//                 refillRequestId: params.refillRequestId,
//                 deliveredById: params.deliveredById,
//                 type: params.deliveryType,
//             },
//         });
//         const deliveryItem = await prisma.departmentRefillDeliveryItem.create({
//             data: {
//                 deliveryId: delivery.id,
//                 refillItemId: params.refillItemId,
//                 batchId: params.batchId,
//                 shippedQuantity: params.quantity,
//             },
//         });

//         const warehouseStock = await prisma.batchStock.update({
//             where: {
//                 batchId_departmentId: {
//                     batchId: params.batchId,
//                     departmentId: deptCentralWarehouse.id,
//                 },
//             },
//             data: { quantity: { decrement: params.quantity } },
//         });
//         await prisma.inventoryTransaction.create({
//             data: {
//                 transactionType: 'department_transfer_out',
//                 variantId: params.variantId,
//                 batchId: params.batchId,
//                 departmentId: deptCentralWarehouse.id,
//                 quantity: -params.quantity,
//                 balanceAfter: Number(warehouseStock.quantity),
//                 referenceType: 'refill_request',
//                 referenceId: params.refillRequestId,
//                 performedById: params.deliveredById,
//             },
//         });

//         await prisma.departmentRefillDeliveryItem.update({
//             where: { id: deliveryItem.id },
//             data: { receivedQuantity: params.quantity, quantityDiscrepancy: 0 },
//         });
//         const destStock = await prisma.batchStock.create({
//             data: {
//                 batchId: params.batchId,
//                 departmentId: params.toDepartmentId,
//                 quantity: params.quantity,
//             },
//         });
//         await prisma.inventoryTransaction.create({
//             data: {
//                 transactionType: 'department_transfer_in',
//                 variantId: params.variantId,
//                 batchId: params.batchId,
//                 departmentId: params.toDepartmentId,
//                 quantity: params.quantity,
//                 balanceAfter: Number(destStock.quantity),
//                 referenceType: 'department_refill_delivery_item',
//                 referenceId: deliveryItem.id,
//                 performedById: params.receivedById,
//             },
//         });
//         await prisma.departmentRefillDelivery.update({
//             where: { id: delivery.id },
//             data: {
//                 receivedById: params.receivedById,
//                 confirmedAt: new Date(),
//             },
//         });

//         await prisma.departmentRefillItem.update({
//             where: { id: params.refillItemId },
//             data: {
//                 deliveredQuantity: params.quantity,
//                 quantityDiscrepancy: 0,
//             },
//         });

//         return delivery;
//     }

//     // RR1: Pharmacy — Amoxicillin + Paracetamol, delivered & confirmed -> complete
//     const rr1 = await prisma.departmentRefillRequest.create({
//         data: {
//             requestNumber: generateRequestNumber('DRF'),
//             departmentId: deptPharmacy.id,
//             requestedById: userBashar.id,
//             status: RequestStatus.preparing,
//             priority: RefillRequestPriority.normal,
//             requestType: RefillRequestType.normal,
//             hospitalApprovedById: userHassan.id,
//             hospitalApprovedAt: new Date('2026-06-12'),
//             approvedById: userHamedDev.id,
//             approvedAt: new Date('2026-06-12'),
//             notes: 'Pharmacy baseline restock.',
//         },
//     });
//     const rr1ItemAmox = await prisma.departmentRefillItem.create({
//         data: {
//             refillRequestId: rr1.id,
//             variantId: variantAmoxicillin.id,
//             requestedQuantity: 100,
//             approvedQuantity: 100,
//             quantityDiscrepancy: 100,
//         },
//     });
//     const rr1ItemPara = await prisma.departmentRefillItem.create({
//         data: {
//             refillRequestId: rr1.id,
//             variantId: variantParacetamol.id,
//             requestedQuantity: 50,
//             approvedQuantity: 50,
//             quantityDiscrepancy: 50,
//         },
//     });
//     await shipAndConfirm({
//         refillRequestId: rr1.id,
//         refillItemId: rr1ItemAmox.id,
//         batchId: batchAmox1.id,
//         variantId: variantAmoxicillin.id,
//         quantity: 100,
//         toDepartmentId: deptPharmacy.id,
//         deliveryType: BatchType.batch,
//         deliveredById: userHamedDev.id,
//         receivedById: userBashar.id,
//     });
//     await shipAndConfirm({
//         refillRequestId: rr1.id,
//         refillItemId: rr1ItemPara.id,
//         batchId: batchParacetamol1.id,
//         variantId: variantParacetamol.id,
//         quantity: 50,
//         toDepartmentId: deptPharmacy.id,
//         deliveryType: BatchType.batch,
//         deliveredById: userHamedDev.id,
//         receivedById: userBashar.id,
//     });
//     await prisma.departmentRefillRequest.update({
//         where: { id: rr1.id },
//         data: { status: RequestStatus.complete },
//     });

//     // RR2: Emergency — IV Cannula, delivered & confirmed -> complete
//     const rr2 = await prisma.departmentRefillRequest.create({
//         data: {
//             requestNumber: generateRequestNumber('DRF'),
//             departmentId: deptEmergency.id,
//             requestedById: userEmergencyManager.id,
//             status: RequestStatus.preparing,
//             priority: RefillRequestPriority.urgent,
//             requestType: RefillRequestType.normal,
//             hospitalApprovedById: userHassan.id,
//             hospitalApprovedAt: new Date('2026-06-13'),
//             approvedById: userHamedDev.id,
//             approvedAt: new Date('2026-06-13'),
//             notes: 'IV cannula restock for Emergency.',
//         },
//     });
//     const rr2ItemIvCannula = await prisma.departmentRefillItem.create({
//         data: {
//             refillRequestId: rr2.id,
//             variantId: variantIvCannula.id,
//             requestedQuantity: 80,
//             approvedQuantity: 80,
//             quantityDiscrepancy: 80,
//         },
//     });
//     await shipAndConfirm({
//         refillRequestId: rr2.id,
//         refillItemId: rr2ItemIvCannula.id,
//         batchId: batchIvCannula1.id,
//         variantId: variantIvCannula.id,
//         quantity: 80,
//         toDepartmentId: deptEmergency.id,
//         deliveryType: BatchType.final_batch,
//         deliveredById: userHamedDev.id,
//         receivedById: userEmergencyManager.id,
//     });
//     await prisma.departmentRefillRequest.update({
//         where: { id: rr2.id },
//         data: { status: RequestStatus.complete },
//     });

//     // RR3: Pediatrics — Paracetamol, delivered & confirmed -> complete
//     const rr3 = await prisma.departmentRefillRequest.create({
//         data: {
//             requestNumber: generateRequestNumber('DRF'),
//             departmentId: deptPediatrics.id,
//             requestedById: userPediatricsManager.id,
//             status: RequestStatus.preparing,
//             priority: RefillRequestPriority.normal,
//             requestType: RefillRequestType.normal,
//             hospitalApprovedById: userHassan.id,
//             hospitalApprovedAt: new Date('2026-06-14'),
//             approvedById: userHamedDev.id,
//             approvedAt: new Date('2026-06-14'),
//             notes: 'Paracetamol restock for Pediatrics ward.',
//         },
//     });
//     const rr3ItemPara = await prisma.departmentRefillItem.create({
//         data: {
//             refillRequestId: rr3.id,
//             variantId: variantParacetamol.id,
//             requestedQuantity: 50,
//             approvedQuantity: 50,
//             quantityDiscrepancy: 50,
//         },
//     });
//     await shipAndConfirm({
//         refillRequestId: rr3.id,
//         refillItemId: rr3ItemPara.id,
//         batchId: batchParacetamol1.id,
//         variantId: variantParacetamol.id,
//         quantity: 50,
//         toDepartmentId: deptPediatrics.id,
//         deliveryType: BatchType.final_batch,
//         deliveredById: userHamedDev.id,
//         receivedById: userPediatricsManager.id,
//     });
//     await prisma.departmentRefillRequest.update({
//         where: { id: rr3.id },
//         data: { status: RequestStatus.complete },
//     });

//     // RR4: Internal Medicine — approved, awaiting shipment (no delivery yet)
//     const rr4 = await prisma.departmentRefillRequest.create({
//         data: {
//             requestNumber: generateRequestNumber('DRF'),
//             departmentId: deptInternalMedicine.id,
//             requestedById: userInternalMedManager.id,
//             status: RequestStatus.preparing,
//             priority: RefillRequestPriority.normal,
//             requestType: RefillRequestType.normal,
//             hospitalApprovedById: userHassan.id,
//             hospitalApprovedAt: new Date('2026-06-15'),
//             approvedById: userHamedDev.id,
//             approvedAt: new Date('2026-06-15'),
//             notes: 'Approved — awaiting warehouse shipment.',
//         },
//     });
//     await prisma.departmentRefillItem.create({
//         data: {
//             refillRequestId: rr4.id,
//             variantId: variantAmoxicillin.id,
//             requestedQuantity: 80,
//             approvedQuantity: 80,
//             quantityDiscrepancy: 80,
//         },
//     });

//     console.log(
//         '--- 20. Recurring refill origins -> Periodic Refill Schedules ---',
//     );

//     async function createRecurringOrigin(params: {
//         departmentId: string;
//         requestedById: string;
//         variantId: string;
//         quantity: number;
//         requestType: RefillRequestType;
//         frequencyInterval: number;
//         approvalPolicy: ScheduleApprovalPolicy;
//         approvedById: string;
//         notes: string;
//     }) {
//         const request = await prisma.departmentRefillRequest.create({
//             data: {
//                 requestNumber: generateRequestNumber('DRF'),
//                 departmentId: params.departmentId,
//                 requestedById: params.requestedById,
//                 status: RequestStatus.preparing,
//                 priority: RefillRequestPriority.normal,
//                 requestType: params.requestType,
//                 frequencyInterval: params.frequencyInterval,
//                 hospitalApprovedById: userHassan.id,
//                 hospitalApprovedAt: new Date('2026-06-16'),
//                 approvedById: params.approvedById,
//                 approvedAt: new Date('2026-06-16'),
//                 notes: params.notes,
//             },
//         });
//         await prisma.departmentRefillItem.create({
//             data: {
//                 refillRequestId: request.id,
//                 variantId: params.variantId,
//                 requestedQuantity: params.quantity,
//                 approvedQuantity: params.quantity,
//                 quantityDiscrepancy: params.quantity,
//             },
//         });

//         const unit: FrequencyUnit =
//             params.requestType === RefillRequestType.daily
//                 ? FrequencyUnit.day
//                 : params.requestType === RefillRequestType.weekly
//                   ? FrequencyUnit.week
//                   : FrequencyUnit.month;
//         const approvedAt = new Date('2026-06-16');
//         const nextRunDate = computeCycleEnd(
//             approvedAt,
//             unit,
//             params.frequencyInterval,
//         );

//         const schedule = await prisma.periodicRefillSchedule.create({
//             data: {
//                 departmentId: params.departmentId,
//                 createdById: params.requestedById,
//                 originRequestId: request.id,
//                 approvalPolicy: params.approvalPolicy,
//                 requestType: params.requestType,
//                 frequencyInterval: params.frequencyInterval,
//                 approvedById: params.approvedById,
//                 approvedAt,
//                 nextRunDate,
//             },
//         });

//         await prisma.departmentRefillRequest.update({
//             where: { id: request.id },
//             data: { periodicScheduleId: schedule.id },
//         });

//         return { request, schedule };
//     }

//     const { schedule: scheduleMonthly } = await createRecurringOrigin({
//         departmentId: deptInternalMedicine.id,
//         requestedById: userInternalMedManager.id,
//         variantId: variantAmoxicillin.id,
//         quantity: 30,
//         requestType: RefillRequestType.monthly,
//         frequencyInterval: 1,
//         approvalPolicy: ScheduleApprovalPolicy.auto_approved,
//         approvedById: userHamedDev.id,
//         notes: 'Monthly recurring Amoxicillin refill for Internal Medicine.',
//     });
//     const { schedule: scheduleWeekly } = await createRecurringOrigin({
//         departmentId: deptPediatrics.id,
//         requestedById: userPediatricsManager.id,
//         variantId: variantParacetamol.id,
//         quantity: 20,
//         requestType: RefillRequestType.weekly,
//         frequencyInterval: 1,
//         approvalPolicy: ScheduleApprovalPolicy.approval_required_each_cycle,
//         approvedById: userHamedDev.id,
//         notes: 'Weekly recurring Paracetamol refill for Pediatrics.',
//     });
//     const { schedule: scheduleDaily } = await createRecurringOrigin({
//         departmentId: deptPharmacy.id,
//         requestedById: userBashar.id,
//         variantId: variantAmoxicillin.id,
//         quantity: 10,
//         requestType: RefillRequestType.daily,
//         frequencyInterval: 1,
//         approvalPolicy: ScheduleApprovalPolicy.auto_approved,
//         approvedById: userHamedDev.id,
//         notes: 'Daily recurring Amoxicillin top-up for Pharmacy.',
//     });
//     void scheduleMonthly;
//     void scheduleWeekly;
//     void scheduleDaily;

//     // ============================================================
//     // INVENTORY: adjustments, consumption, stock counts
//     // ============================================================
//     console.log('--- 21. Inventory adjustments ---');

//     async function recordAdjustment(params: {
//         variantId: string;
//         departmentId: string;
//         batchId: string;
//         adjustmentType: AdjustmentType;
//         quantity: number;
//         increasing: boolean;
//         reportedById: string;
//         notes: string;
//         referenceType?: string;
//         referenceId?: string;
//     }) {
//         const adjustment = await prisma.inventoryAdjustment.create({
//             data: {
//                 variantId: params.variantId,
//                 departmentId: params.departmentId,
//                 batchId: params.batchId,
//                 adjustmentType: params.adjustmentType,
//                 quantity: params.quantity,
//                 notes: params.notes,
//                 reportedById: params.reportedById,
//                 referenceType: params.referenceType,
//                 referenceId: params.referenceId,
//             },
//         });

//         const stock = await prisma.batchStock.update({
//             where: {
//                 batchId_departmentId: {
//                     batchId: params.batchId,
//                     departmentId: params.departmentId,
//                 },
//             },
//             data: {
//                 quantity: params.increasing
//                     ? { increment: params.quantity }
//                     : { decrement: params.quantity },
//             },
//         });

//         const txTypeMap: Record<AdjustmentType, string> = {
//             damaged: 'adjustment_damaged',
//             expired: 'adjustment_expired',
//             shrinkage: 'adjustment_shrinkage',
//             found: 'adjustment_found',
//         };
//         await prisma.inventoryTransaction.create({
//             data: {
//                 transactionType: txTypeMap[params.adjustmentType] as any,
//                 variantId: params.variantId,
//                 batchId: params.batchId,
//                 departmentId: params.departmentId,
//                 quantity: params.increasing
//                     ? params.quantity
//                     : -params.quantity,
//                 balanceAfter: Number(stock.quantity),
//                 referenceType: (params.referenceType as any) ?? 'adjustment',
//                 referenceId: params.referenceId ?? adjustment.id,
//                 performedById: params.reportedById,
//             },
//         });

//         return adjustment;
//     }

//     await recordAdjustment({
//         variantId: variantIvCannula.id,
//         departmentId: deptEmergency.id,
//         batchId: batchIvCannula1.id,
//         adjustmentType: AdjustmentType.damaged,
//         quantity: 5,
//         increasing: false,
//         reportedById: userEmergencyManager.id,
//         notes: 'Packaging torn during transport, unit discarded.',
//     });
//     await recordAdjustment({
//         variantId: variantAmoxicillin.id,
//         departmentId: deptPharmacy.id,
//         batchId: batchAmox1.id,
//         adjustmentType: AdjustmentType.expired,
//         quantity: 10,
//         increasing: false,
//         reportedById: userBashar.id,
//         notes: 'Expired stock pulled during routine shelf check.',
//     });
//     await recordAdjustment({
//         variantId: variantParacetamol.id,
//         departmentId: deptPediatrics.id,
//         batchId: batchParacetamol1.id,
//         adjustmentType: AdjustmentType.found,
//         quantity: 5,
//         increasing: true,
//         reportedById: userPediatricsManager.id,
//         notes: 'Miscounted units found in secondary storage.',
//     });

//     console.log('--- 22. Department consumption ---');

//     async function recordConsumption(params: {
//         variantId: string;
//         departmentId: string;
//         batchId: string;
//         quantity: number;
//         performedById: string;
//         notes: string;
//     }) {
//         const stock = await prisma.batchStock.update({
//             where: {
//                 batchId_departmentId: {
//                     batchId: params.batchId,
//                     departmentId: params.departmentId,
//                 },
//             },
//             data: { quantity: { decrement: params.quantity } },
//         });
//         await prisma.inventoryTransaction.create({
//             data: {
//                 transactionType: 'department_consumption',
//                 variantId: params.variantId,
//                 batchId: params.batchId,
//                 departmentId: params.departmentId,
//                 quantity: -params.quantity,
//                 balanceAfter: Number(stock.quantity),
//                 performedById: params.performedById,
//                 notes: params.notes,
//             },
//         });
//     }

//     await recordConsumption({
//         variantId: variantIvCannula.id,
//         departmentId: deptEmergency.id,
//         batchId: batchIvCannula1.id,
//         quantity: 5,
//         performedById: userDrHamed90.id,
//         notes: 'General procedure supplies used during shift.',
//     });
//     await recordConsumption({
//         variantId: variantParacetamol.id,
//         departmentId: deptPediatrics.id,
//         batchId: batchParacetamol1.id,
//         quantity: 5,
//         performedById: userDrLina.id,
//         notes: 'Ward stock used for inpatient care.',
//     });

//     console.log('--- 23. Stock count sessions ---');

//     const scPharmacy = await prisma.stockCountSession.create({
//         data: {
//             departmentId: deptPharmacy.id,
//             initiatedById: userBashar.id,
//             status: StockCountStatus.draft,
//             countDate: new Date('2026-07-20'),
//         },
//     });
//     // Expected quantities below are filled in AFTER dispensing (section 25),
//     // so they match the true live stock at the time of counting.

//     const scEmergency = await prisma.stockCountSession.create({
//         data: {
//             departmentId: deptEmergency.id,
//             initiatedById: userEmergencyManager.id,
//             status: StockCountStatus.draft,
//             countDate: new Date('2026-07-25'),
//         },
//     });
//     const scEmergencyItem = await prisma.stockCountItem.create({
//         data: {
//             sessionId: scEmergency.id,
//             variantId: variantIvCannula.id,
//             batchId: batchIvCannula1.id,
//             expectedQuantity: 0,
//             countedQuantity: 0,
//             variance: 0,
//             notes: 'Filled in below once live stock is known.',
//         },
//     });

//     const scPediatrics = await prisma.stockCountSession.create({
//         data: {
//             departmentId: deptPediatrics.id,
//             initiatedById: userPediatricsManager.id,
//             status: StockCountStatus.draft,
//             countDate: new Date('2026-07-28'),
//         },
//     });

//     // ============================================================
//     // PATIENTS, QUEUE, VISITS, PRESCRIPTIONS, DISPENSING
//     // ============================================================
//     console.log('--- 24. Patients ---');

//     const patient1 = await prisma.patient.create({
//         data: {
//             fullName: 'Ahmad Khaled',
//             nationalId: '12345678901',
//             familyBookNumber: '5001',
//             registeredById: userReceptionOne.id,
//         },
//     });
//     const patient2 = await prisma.patient.create({
//         data: {
//             fullName: 'Fatima Ali',
//             nationalId: '22345678901',
//             familyBookNumber: '5002',
//             registeredById: userNewDoctor.id,
//         },
//     });
//     const patientId3 = generateRequestNumber('PT');
//     const patient3 = await prisma.patient.create({
//         data: {
//             fullName: 'Youssef Omar',
//             patientId: patientId3,
//             registeredById: userNewDoctor.id,
//         },
//     });

//     console.log(
//         '--- 25. Department queue, visits, prescriptions, dispensing ---',
//     );

//     // Q1: Emergency — Ahmad Khaled, already completed into a visit.
//     const q1 = await prisma.departmentQueue.create({
//         data: {
//             departmentId: deptEmergency.id,
//             patientId: patient1.id,
//             status: QueueStatus.waiting,
//             addedById: userReceptionOne.id,
//             addedAt: new Date('2026-07-10T08:00:00Z'),
//         },
//     });
//     await prisma.departmentQueue.update({
//         where: { id: q1.id },
//         data: {
//             status: QueueStatus.in_consultation,
//             lockedById: userDrHamed90.id,
//             lockedAt: new Date('2026-07-10T08:10:00Z'),
//         },
//     });

//     const v1 = await prisma.medicalVisit.create({
//         data: {
//             patientId: patient1.id,
//             doctorId: userDrHamed90.id,
//             departmentId: deptEmergency.id,
//             queueEntryId: q1.id,
//             visitDate: new Date('2026-07-10T08:30:00Z'),
//             status: VisitStatus.completed,
//             clinicalNotes: 'Presented with abdominal pain and fever.',
//             diagnosis: 'Acute gastritis',
//         },
//     });
//     await prisma.departmentQueue.update({
//         where: { id: q1.id },
//         data: {
//             status: QueueStatus.completed,
//             completedAt: new Date('2026-07-10T08:45:00Z'),
//         },
//     });

//     const rx1 = await prisma.prescription.create({
//         data: {
//             visitId: v1.id,
//             patientId: patient1.id,
//             doctorId: userDrHamed90.id,
//             status: PrescriptionStatus.active,
//             startDate: new Date('2026-07-10'),
//             currentCycleStart: new Date('2026-07-10'),
//             currentCycleEnd: new Date('2026-07-10'),
//             currentCycleStatus: CycleStatus.ready,
//         },
//     });
//     const rx1Item = await prisma.prescriptionItem.create({
//         data: {
//             prescriptionId: rx1.id,
//             variantId: variantAmoxicillin.id,
//             prescribedQuantity: 20,
//             dosage: '1 capsule',
//             frequency: 'Twice daily',
//             durationDays: 10,
//         },
//     });
//     const rx4 = await prisma.prescription.create({
//         data: {
//             visitId: v1.id,
//             patientId: patient1.id,
//             doctorId: userDrHamed90.id,
//             status: PrescriptionStatus.active,
//             startDate: new Date('2026-07-10'),
//             currentCycleStart: new Date('2026-07-10'),
//             currentCycleEnd: new Date('2026-07-10'),
//             currentCycleStatus: CycleStatus.ready,
//         },
//     });
//     const rx4Item = await prisma.prescriptionItem.create({
//         data: {
//             prescriptionId: rx4.id,
//             variantId: variantParacetamol.id,
//             prescribedQuantity: 3,
//             dosage: '1 tablet',
//             frequency: 'As needed for pain',
//             durationDays: 5,
//         },
//     });
//     await prisma.pharmacyDispenseQueue.create({
//         data: {
//             prescriptionId: rx1.id,
//             patientId: patient1.id,
//             nationalId: patient1.nationalId,
//             familyBookNumber: patient1.familyBookNumber,
//             patientName: patient1.fullName,
//             cycleNumber: 1,
//             medicationSummary: `Amoxicillin 500mg - Box of 100 x20`,
//             status: CycleStatus.ready,
//             readySince: new Date('2026-07-10T08:45:00Z'),
//         },
//     });
//     await prisma.pharmacyDispenseQueue.create({
//         data: {
//             prescriptionId: rx4.id,
//             patientId: patient1.id,
//             nationalId: patient1.nationalId,
//             familyBookNumber: patient1.familyBookNumber,
//             patientName: patient1.fullName,
//             cycleNumber: 1,
//             medicationSummary: `Paracetamol 500mg - Bottle of 200 x3`,
//             status: CycleStatus.ready,
//             readySince: new Date('2026-07-10T08:45:00Z'),
//         },
//     });

//     // Q4: Pediatrics — Fatima Ali, an earlier, already-completed visit (no prescription).
//     const q4 = await prisma.departmentQueue.create({
//         data: {
//             departmentId: deptPediatrics.id,
//             patientId: patient2.id,
//             status: QueueStatus.waiting,
//             addedById: userNewDoctor.id,
//             addedAt: new Date('2026-07-05T09:00:00Z'),
//         },
//     });
//     await prisma.departmentQueue.update({
//         where: { id: q4.id },
//         data: {
//             status: QueueStatus.in_consultation,
//             lockedById: userDrLina.id,
//             lockedAt: new Date('2026-07-05T09:05:00Z'),
//         },
//     });
//     const v2 = await prisma.medicalVisit.create({
//         data: {
//             patientId: patient2.id,
//             doctorId: userDrLina.id,
//             departmentId: deptPediatrics.id,
//             queueEntryId: q4.id,
//             visitDate: new Date('2026-07-05T09:20:00Z'),
//             status: VisitStatus.completed,
//             clinicalNotes: 'Mild upper respiratory symptoms.',
//             diagnosis: 'Common cold',
//         },
//     });
//     await prisma.departmentQueue.update({
//         where: { id: q4.id },
//         data: {
//             status: QueueStatus.completed,
//             completedAt: new Date('2026-07-05T09:30:00Z'),
//         },
//     });
//     const rx3 = await prisma.prescription.create({
//         data: {
//             visitId: v2.id,
//             patientId: patient2.id,
//             doctorId: userDrLina.id,
//             status: PrescriptionStatus.active,
//             startDate: new Date('2026-07-05'),
//             currentCycleStart: new Date('2026-07-05'),
//             currentCycleEnd: new Date('2026-07-05'),
//             currentCycleStatus: CycleStatus.ready,
//         },
//     });
//     const rx3Item = await prisma.prescriptionItem.create({
//         data: {
//             prescriptionId: rx3.id,
//             variantId: variantAmoxicillin.id,
//             prescribedQuantity: 5,
//             dosage: '1 capsule',
//             frequency: 'Twice daily',
//             durationDays: 3,
//         },
//     });
//     await prisma.pharmacyDispenseQueue.create({
//         data: {
//             prescriptionId: rx3.id,
//             patientId: patient2.id,
//             nationalId: patient2.nationalId,
//             familyBookNumber: patient2.familyBookNumber,
//             patientName: patient2.fullName,
//             cycleNumber: 1,
//             medicationSummary: `Amoxicillin 500mg - Box of 100 x5`,
//             status: CycleStatus.ready,
//             readySince: new Date('2026-07-05T09:30:00Z'),
//         },
//     });

//     // Q2: Pediatrics — Fatima Ali, current waiting entry (new complaint).
//     await prisma.departmentQueue.create({
//         data: {
//             departmentId: deptPediatrics.id,
//             patientId: patient2.id,
//             status: QueueStatus.waiting,
//             addedById: userNewDoctor.id,
//             addedAt: new Date('2026-07-29T10:00:00Z'),
//         },
//     });

//     // Q5: Internal Medicine — Youssef Omar, earlier completed visit with a
//     // recurring monthly prescription (drives cycle-log history below).
//     const q5 = await prisma.departmentQueue.create({
//         data: {
//             departmentId: deptInternalMedicine.id,
//             patientId: patient3.id,
//             status: QueueStatus.waiting,
//             addedById: userReceptionOne.id,
//             addedAt: new Date('2026-06-01T11:00:00Z'),
//         },
//     });
//     await prisma.departmentQueue.update({
//         where: { id: q5.id },
//         data: {
//             status: QueueStatus.in_consultation,
//             lockedById: userDrSara.id,
//             lockedAt: new Date('2026-06-01T11:05:00Z'),
//         },
//     });
//     const v3 = await prisma.medicalVisit.create({
//         data: {
//             patientId: patient3.id,
//             doctorId: userDrSara.id,
//             departmentId: deptInternalMedicine.id,
//             queueEntryId: q5.id,
//             visitDate: new Date('2026-06-01T11:20:00Z'),
//             status: VisitStatus.completed,
//             clinicalNotes: 'Routine hypertension follow-up.',
//             diagnosis: 'Hypertension follow-up',
//         },
//     });
//     await prisma.departmentQueue.update({
//         where: { id: q5.id },
//         data: {
//             status: QueueStatus.completed,
//             completedAt: new Date('2026-06-01T11:40:00Z'),
//         },
//     });

//     const rx2StartDate = new Date('2026-06-01');
//     const rx2CycleEnd = computeCycleEnd(rx2StartDate, FrequencyUnit.month, 1);
//     const rx2 = await prisma.prescription.create({
//         data: {
//             visitId: v3.id,
//             patientId: patient3.id,
//             doctorId: userDrSara.id,
//             status: PrescriptionStatus.active,
//             frequencyUnit: FrequencyUnit.month,
//             frequencyInterval: 1,
//             totalCycles: 3,
//             startDate: rx2StartDate,
//             currentCycleStart: rx2StartDate,
//             currentCycleEnd: rx2CycleEnd,
//             currentCycleStatus: CycleStatus.ready,
//         },
//     });
//     const rx2Item = await prisma.prescriptionItem.create({
//         data: {
//             prescriptionId: rx2.id,
//             variantId: variantParacetamol.id,
//             prescribedQuantity: 10,
//             dosage: '1 tablet',
//             frequency: 'Once daily',
//             durationDays: 30,
//         },
//     });
//     await prisma.pharmacyDispenseQueue.create({
//         data: {
//             prescriptionId: rx2.id,
//             patientId: patient3.id,
//             nationalId: patient3.nationalId,
//             familyBookNumber: patient3.familyBookNumber,
//             patientName: patient3.fullName,
//             cycleNumber: 1,
//             medicationSummary: `Paracetamol 500mg - Bottle of 200 x10`,
//             status: CycleStatus.ready,
//             readySince: new Date('2026-06-01T11:40:00Z'),
//         },
//     });

//     // Q3: Internal Medicine — Youssef Omar, current in-consultation follow-up (no visit yet).
//     const q3 = await prisma.departmentQueue.create({
//         data: {
//             departmentId: deptInternalMedicine.id,
//             patientId: patient3.id,
//             status: QueueStatus.waiting,
//             addedById: userReceptionOne.id,
//             addedAt: new Date('2026-07-30T09:00:00Z'),
//         },
//     });
//     await prisma.departmentQueue.update({
//         where: { id: q3.id },
//         data: {
//             status: QueueStatus.in_consultation,
//             lockedById: userDrSara.id,
//             lockedAt: new Date('2026-07-30T09:05:00Z'),
//         },
//     });

//     console.log('--- 26. Dispensing ---');

//     async function dispense(params: {
//         prescriptionId: string;
//         prescriptionItemId: string;
//         variantId: string;
//         batchId: string;
//         quantity: number;
//         cycleNumber: number;
//         dispensedById: string;
//         notes?: string;
//     }) {
//         const dispenseRecord = await prisma.prescriptionDispense.create({
//             data: {
//                 prescriptionId: params.prescriptionId,
//                 cycleNumber: params.cycleNumber,
//                 dispensedById: params.dispensedById,
//                 notes: params.notes,
//             },
//         });
//         await prisma.prescriptionDispenseItem.create({
//             data: {
//                 dispenseId: dispenseRecord.id,
//                 prescriptionItemId: params.prescriptionItemId,
//                 variantId: params.variantId,
//                 batchId: params.batchId,
//                 quantity: params.quantity,
//             },
//         });

//         const stock = await prisma.batchStock.update({
//             where: {
//                 batchId_departmentId: {
//                     batchId: params.batchId,
//                     departmentId: deptPharmacy.id,
//                 },
//             },
//             data: { quantity: { decrement: params.quantity } },
//         });
//         await prisma.inventoryTransaction.create({
//             data: {
//                 transactionType: 'prescription_dispense',
//                 variantId: params.variantId,
//                 batchId: params.batchId,
//                 departmentId: deptPharmacy.id,
//                 quantity: -params.quantity,
//                 balanceAfter: Number(stock.quantity),
//                 referenceType: 'prescription_dispense',
//                 referenceId: dispenseRecord.id,
//                 performedById: params.dispensedById,
//             },
//         });

//         await prisma.prescriptionItem.update({
//             where: { id: params.prescriptionItemId },
//             data: { dispensedQuantity: { increment: params.quantity } },
//         });

//         return dispenseRecord;
//     }

//     // RX1 — Amoxicillin, one-time, fully dispensed -> completed.
//     await dispense({
//         prescriptionId: rx1.id,
//         prescriptionItemId: rx1Item.id,
//         variantId: variantAmoxicillin.id,
//         batchId: batchAmox1.id,
//         quantity: 20,
//         cycleNumber: 1,
//         dispensedById: userBashar.id,
//     });
//     await prisma.prescriptionCycleLog.create({
//         data: {
//             prescriptionId: rx1.id,
//             cycleNumber: 1,
//             periodStart: new Date('2026-07-10'),
//             periodEnd: new Date('2026-07-10'),
//             resolvedStatus: CycleStatus.delivered,
//             resolvedAt: new Date('2026-07-10T14:00:00Z'),
//         },
//     });
//     await prisma.prescription.update({
//         where: { id: rx1.id },
//         data: {
//             status: PrescriptionStatus.completed,
//             currentCycleStatus: CycleStatus.delivered,
//         },
//     });
//     await prisma.pharmacyDispenseQueue.deleteMany({
//         where: { prescriptionId: rx1.id },
//     });

//     // RX3 — Amoxicillin, one-time, fully dispensed -> completed.
//     await dispense({
//         prescriptionId: rx3.id,
//         prescriptionItemId: rx3Item.id,
//         variantId: variantAmoxicillin.id,
//         batchId: batchAmox1.id,
//         quantity: 5,
//         cycleNumber: 1,
//         dispensedById: userBashar.id,
//     });
//     await prisma.prescriptionCycleLog.create({
//         data: {
//             prescriptionId: rx3.id,
//             cycleNumber: 1,
//             periodStart: new Date('2026-07-05'),
//             periodEnd: new Date('2026-07-05'),
//             resolvedStatus: CycleStatus.delivered,
//             resolvedAt: new Date('2026-07-05T15:00:00Z'),
//         },
//     });
//     await prisma.prescription.update({
//         where: { id: rx3.id },
//         data: {
//             status: PrescriptionStatus.completed,
//             currentCycleStatus: CycleStatus.delivered,
//         },
//     });
//     await prisma.pharmacyDispenseQueue.deleteMany({
//         where: { prescriptionId: rx3.id },
//     });

//     // RX2 — Paracetamol, monthly recurring, cycle 1 dispensed across two visits
//     // to the pharmacy window (partial, then the remainder) -> advances to cycle 2.
//     await dispense({
//         prescriptionId: rx2.id,
//         prescriptionItemId: rx2Item.id,
//         variantId: variantParacetamol.id,
//         batchId: batchParacetamol1.id,
//         quantity: 6,
//         cycleNumber: 1,
//         dispensedById: userBashar.id,
//         notes: 'Partial pickup — patient will return for the rest.',
//     });
//     await prisma.prescription.update({
//         where: { id: rx2.id },
//         data: { currentCycleStatus: CycleStatus.partially_delivered },
//     });
//     await prisma.pharmacyDispenseQueue.updateMany({
//         where: { prescriptionId: rx2.id },
//         data: { status: CycleStatus.partially_delivered },
//     });

//     await dispense({
//         prescriptionId: rx2.id,
//         prescriptionItemId: rx2Item.id,
//         variantId: variantParacetamol.id,
//         batchId: batchParacetamol1.id,
//         quantity: 4,
//         cycleNumber: 1,
//         dispensedById: userBashar.id,
//         notes: 'Remainder of cycle 1 picked up.',
//     });
//     await prisma.prescriptionCycleLog.create({
//         data: {
//             prescriptionId: rx2.id,
//             cycleNumber: 1,
//             periodStart: rx2StartDate,
//             periodEnd: rx2CycleEnd,
//             resolvedStatus: CycleStatus.delivered,
//             resolvedAt: new Date('2026-07-01T12:00:00Z'),
//         },
//     });
//     const rx2NextCycleStart = rx2CycleEnd;
//     const rx2NextCycleEnd = computeCycleEnd(
//         rx2NextCycleStart,
//         FrequencyUnit.month,
//         1,
//     );
//     await prisma.prescription.update({
//         where: { id: rx2.id },
//         data: {
//             currentCycleNumber: 2,
//             currentCycleStart: rx2NextCycleStart,
//             currentCycleEnd: rx2NextCycleEnd,
//             currentCycleStatus: CycleStatus.ready,
//         },
//     });
//     await prisma.pharmacyDispenseQueue.updateMany({
//         where: { prescriptionId: rx2.id },
//         data: {
//             cycleNumber: 2,
//             status: CycleStatus.ready,
//             readySince: new Date('2026-07-01T12:00:00Z'),
//         },
//     });

//     console.log(
//         '--- 27. Finish stock counts (now that live stock is known) ---',
//     );

//     const pharmacyAmoxStock = await prisma.batchStock.findUniqueOrThrow({
//         where: {
//             batchId_departmentId: {
//                 batchId: batchAmox1.id,
//                 departmentId: deptPharmacy.id,
//             },
//         },
//     });
//     const pharmacyParaStock = await prisma.batchStock.findUniqueOrThrow({
//         where: {
//             batchId_departmentId: {
//                 batchId: batchParacetamol1.id,
//                 departmentId: deptPharmacy.id,
//             },
//         },
//     });
//     await prisma.stockCountItem.create({
//         data: {
//             sessionId: scPharmacy.id,
//             variantId: variantAmoxicillin.id,
//             batchId: batchAmox1.id,
//             expectedQuantity: pharmacyAmoxStock.quantity,
//             countedQuantity: pharmacyAmoxStock.quantity,
//             variance: 0,
//             notes: 'Matches system count.',
//         },
//     });
//     const pharmacyParaCounted = Number(pharmacyParaStock.quantity) - 2;
//     await prisma.stockCountItem.create({
//         data: {
//             sessionId: scPharmacy.id,
//             variantId: variantParacetamol.id,
//             batchId: batchParacetamol1.id,
//             expectedQuantity: pharmacyParaStock.quantity,
//             countedQuantity: pharmacyParaCounted,
//             variance: pharmacyParaCounted - Number(pharmacyParaStock.quantity),
//         },
//     });

//     const pediatricsParaStock = await prisma.batchStock.findUniqueOrThrow({
//         where: {
//             batchId_departmentId: {
//                 batchId: batchParacetamol1.id,
//                 departmentId: deptPediatrics.id,
//             },
//         },
//     });
//     await prisma.stockCountItem.create({
//         data: {
//             sessionId: scPediatrics.id,
//             variantId: variantParacetamol.id,
//             batchId: batchParacetamol1.id,
//             expectedQuantity: pediatricsParaStock.quantity,
//             countedQuantity: pediatricsParaStock.quantity,
//             variance: 0,
//         },
//     });

//     // Emergency session: complete it, with a 2-unit shrinkage variance that
//     // triggers the same auto-adjustment your StockCountsRepository.completeSession()
//     // would create.
//     const emergencyIvStock = await prisma.batchStock.findUniqueOrThrow({
//         where: {
//             batchId_departmentId: {
//                 batchId: batchIvCannula1.id,
//                 departmentId: deptEmergency.id,
//             },
//         },
//     });
//     const emergencyCounted = Number(emergencyIvStock.quantity) - 2;
//     await prisma.stockCountItem.update({
//         where: { id: scEmergencyItem.id },
//         data: {
//             expectedQuantity: emergencyIvStock.quantity,
//             countedQuantity: emergencyCounted,
//             variance: emergencyCounted - Number(emergencyIvStock.quantity),
//             notes: '2 units unaccounted for.',
//         },
//     });
//     await prisma.stockCountSession.update({
//         where: { id: scEmergency.id },
//         data: {
//             status: StockCountStatus.completed,
//             completedAt: new Date('2026-07-25T16:00:00Z'),
//         },
//     });
//     await recordAdjustment({
//         variantId: variantIvCannula.id,
//         departmentId: deptEmergency.id,
//         batchId: batchIvCannula1.id,
//         adjustmentType: AdjustmentType.shrinkage,
//         quantity: 2,
//         increasing: false,
//         reportedById: userEmergencyManager.id,
//         notes: 'Auto-generated from stock count variance.',
//         referenceType: 'stock_count',
//         referenceId: scEmergency.id,
//     });

//     console.log('--- 28. Notifications & device tokens ---');
//     await prisma.notification.createMany({
//         data: [
//             {
//                 userId: userBashar.id,
//                 type: NOTIFICATION_TYPES.STOCK_BELOW_MINIMUM,
//                 category: NotificationCategory.inventory,
//                 title: 'Stock below minimum',
//                 body: 'Paracetamol 500mg - Bottle of 200 at Pharmacy is approaching its minimum threshold.',
//                 data: {
//                     variantId: variantParacetamol.id,
//                     departmentId: deptPharmacy.id,
//                 },
//             },
//             {
//                 userId: userPurchasingManager.id,
//                 type: NOTIFICATION_TYPES.PURCHASE_REQUEST_STATUS_CHANGED,
//                 category: NotificationCategory.purchasing,
//                 title: 'Purchase request status updated',
//                 body: `Purchase request ${pr1.requestNumber} is now "complete".`,
//                 data: { purchaseRequestId: pr1.id, status: 'complete' },
//             },
//             {
//                 userId: userBashar.id,
//                 type: NOTIFICATION_TYPES.REFILL_REQUEST_STATUS_CHANGED,
//                 category: NotificationCategory.inventory,
//                 title: 'Refill request status updated',
//                 body: `Refill request ${rr1.requestNumber} is now "complete".`,
//                 data: { refillRequestId: rr1.id, status: 'complete' },
//             },
//             {
//                 userId: userEmergencyManager.id,
//                 type: NOTIFICATION_TYPES.BATCH_EXPIRATION_ALERT,
//                 category: NotificationCategory.inventory,
//                 title: 'Batch expiring soon',
//                 body: 'IV Cannula 18G, batch IVC-2026-001 at Emergency has 900+ day(s) left before expiring.',
//                 data: {
//                     batchId: batchIvCannula1.id,
//                     departmentId: deptEmergency.id,
//                 },
//             },
//         ],
//     });

//     await prisma.deviceToken.createMany({
//         data: [
//             {
//                 userId: userBashar.id,
//                 platform: SessionPlatform.mobile,
//                 fcmToken: `seed-fcm-${randomBytes(8).toString('hex')}`,
//             },
//             {
//                 userId: userEmergencyManager.id,
//                 platform: SessionPlatform.web,
//                 fcmToken: `seed-fcm-${randomBytes(8).toString('hex')}`,
//             },
//             {
//                 userId: userDrHamed90.id,
//                 platform: SessionPlatform.mobile,
//                 fcmToken: `seed-fcm-${randomBytes(8).toString('hex')}`,
//             },
//         ],
//     });

//     console.log('--- Done. ---');
//     console.log(`Users: ${await prisma.user.count()}`);
//     console.log(`Departments: ${await prisma.department.count()}`);
//     console.log(
//         `Products: ${await prisma.product.count()} / Variants: ${await prisma.productVariant.count()}`,
//     );
//     console.log(
//         `Purchase Requests: ${await prisma.purchaseRequest.count()} / Receipts: ${await prisma.purchaseReceipt.count()}`,
//     );
//     console.log(
//         `Refill Requests: ${await prisma.departmentRefillRequest.count()} / Deliveries: ${await prisma.departmentRefillDelivery.count()}`,
//     );
//     console.log(
//         `Batches: ${await prisma.batch.count()} / BatchStock rows: ${await prisma.batchStock.count()}`,
//     );
//     console.log(
//         `Patients: ${await prisma.patient.count()} / Visits: ${await prisma.medicalVisit.count()} / Prescriptions: ${await prisma.prescription.count()}`,
//     );

//     // Referenced so unused-var checks don't complain if you trim things later.
//     void deptCentralWarehouse;
//     void receiptAItemAmox;
//     void receiptAItemPara;
//     void receiptBItemAmox;
//     void receiptCItemIvCannula;
//     void rx4Item;
//     void userDoctorOne;
//     void userDoctorTwo;
// }

// main()
//     .catch((e) => {
//         console.error(e);
//         process.exitCode = 1;
//     })
//     .finally(async () => {
//         await prisma.$disconnect();
//     });
