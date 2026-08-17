// prisma/seed-history.ts
import {
    PrismaClient,
    MaterialType,
    DepartmentType,
    VisitStatus,
    TransactionType,
    AdjustmentType,
    UserStatus,
    RequestStatus,
    RefillRequestPriority,
} from '@prisma/client';

const prisma = new PrismaClient();

// Helper to get a random date within the last X days
function randomPastDate(maxDaysAgo: number) {
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(Math.random() * maxDaysAgo));
    d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
    return d;
}

// Helper to pick a random element from an array
function randomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
    console.log('🚀 Starting Historical Data Generation...');

    // 1. Fetch Core Entities (Requires base seed to be run first)
    const users = await prisma.user.findMany({
        where: { status: UserStatus.active },
    });
    const userHassan = users.find(
        (u) => u.email === 'hassanmohammad0010@gmail.com',
    );
    const userHamedDev = users.find(
        (u) => u.email === 'hamedzaher.dev@gmail.com',
    );
    const userPurchasing = users.find((u) => u.email === 'ghj8919@gmail.com');

    const doctors = users.filter(
        (u) => u.specialty !== null && u.specialty !== undefined,
    );
    const receptionists = users.filter(
        (u) => u.email?.includes('reception') || u.email === 'r@gmail.com',
    );
    const allActiveUsers = users; // Fallback pool

    if (!userHassan || !userHamedDev || !userPurchasing) {
        throw new Error(
            '❌ Missing core users. Please run the base seed (npx prisma db seed) first!',
        );
    }

    const departments = await prisma.department.findMany();
    const centralWarehouse = departments.find(
        (d) => d.type === DepartmentType.central_warehouse,
    );
    const pharmacy = departments.find(
        (d) => d.type === DepartmentType.pharmacy,
    );
    const standardDepts = departments.filter(
        (d) => d.type === DepartmentType.standard,
    );

    if (!centralWarehouse || !pharmacy || standardDepts.length === 0) {
        throw new Error('❌ Missing core departments. Run base seed first.');
    }

    // 2. Create Historical Products & Variants
    console.log('📦 Creating Historical Products & Variants...');
    let catMed = await prisma.category.findFirst({
        where: { name: 'Medications' },
    });
    if (!catMed)
        catMed = await prisma.category.create({
            data: { name: 'Medications' },
        });

    let unitBox = await prisma.unit.findFirst({
        where: { abbreviation: 'box' },
    });
    if (!unitBox)
        unitBox = await prisma.unit.create({
            data: { name: 'Box', abbreviation: 'box' },
        });

    let unitPiece = await prisma.unit.findFirst({
        where: { abbreviation: 'pc' },
    });
    if (!unitPiece)
        unitPiece = await prisma.unit.create({
            data: { name: 'Piece', abbreviation: 'pc' },
        });

    let supplier = await prisma.supplier.findFirst();
    if (!supplier)
        supplier = await prisma.supplier.create({
            data: { name: 'Historical Supplier' },
        });

    const historicalItems = [
        {
            name: 'Ibuprofen 400mg',
            sku: 'HIST-IBU400',
            type: MaterialType.consumable,
        },
        {
            name: 'Cetirizine 10mg',
            sku: 'HIST-CET10',
            type: MaterialType.consumable,
        },
        {
            name: 'Omeprazole 20mg',
            sku: 'HIST-OME20',
            type: MaterialType.consumable,
        },
        {
            name: 'Metformin 500mg',
            sku: 'HIST-MET500',
            type: MaterialType.consumable,
        },
        {
            name: 'Amlodipine 5mg',
            sku: 'HIST-AML5',
            type: MaterialType.consumable,
        },
        {
            name: 'Atorvastatin 20mg',
            sku: 'HIST-ATOR20',
            type: MaterialType.consumable,
        },
        {
            name: 'Saline Solution 500ml',
            sku: 'HIST-SAL500',
            type: MaterialType.consumable,
        },
        {
            name: 'Dexamethasone 4mg',
            sku: 'HIST-DEX4',
            type: MaterialType.consumable,
        },
        {
            name: 'Diclofenac Gel 50g',
            sku: 'HIST-DIC50',
            type: MaterialType.consumable,
        },
        {
            name: 'Surgical Gloves (Box)',
            sku: 'HIST-GLOVES',
            type: MaterialType.consumable,
        },
        {
            name: 'Amoxicillin 500mg (Hist)',
            sku: 'HIST-AMOX500',
            type: MaterialType.consumable,
        },
        {
            name: 'Paracetamol 500mg (Hist)',
            sku: 'HIST-PARA500',
            type: MaterialType.consumable,
        },
    ];

    const variants: any[] = [];
    for (const item of historicalItems) {
        let product = await prisma.product.findFirst({
            where: { name: item.name },
        });
        if (!product) {
            product = await prisma.product.create({
                data: {
                    name: item.name,
                    categoryId: catMed.id,
                    materialType: item.type,
                    createdById: userHamedDev.id,
                },
            });
        }
        let variant = await prisma.productVariant.findFirst({
            where: { sku: item.sku },
        });
        if (!variant) {
            variant = await prisma.productVariant.create({
                data: {
                    productId: product.id,
                    variantName: `${item.name} - Box`,
                    sku: item.sku,
                    unitId:
                        item.sku.includes('GLOVES') ||
                        item.sku.includes('SAL500')
                            ? unitBox.id
                            : unitPiece.id,
                    createdById: userHamedDev.id,
                },
            });
        }
        variants.push(variant);
    }

    // 3. Create Batches and Base Stock (Simulating 1 year of purchases)
    console.log('🏭 Creating Batches and Base Stock...');
    const batches: any[] = [];

    for (const variant of variants) {
        for (let i = 0; i < 3; i++) {
            const receivingDate = randomPastDate(365);
            const manufacturingDate = new Date(receivingDate);
            manufacturingDate.setMonth(manufacturingDate.getMonth() - 6);
            const expirationDate = new Date(manufacturingDate);
            expirationDate.setFullYear(expirationDate.getFullYear() + 2);

            const batch = await prisma.batch.create({
                data: {
                    variantId: variant.id,
                    supplierId: supplier.id,
                    batchNumber: `${variant.sku}-B${i + 1}-${receivingDate.getFullYear()}`,
                    quantityReceived: 5000,
                    purchasePrice: Math.random() * 10 + 1,
                    manufacturingDate,
                    expirationDate,
                    receivingDate,
                    createdById: userPurchasing.id,
                },
            });
            batches.push(batch);

            // Distribute stock to Central Warehouse, Pharmacy, and Standard Depts
            await prisma.batchStock.create({
                data: {
                    batchId: batch.id,
                    departmentId: centralWarehouse.id,
                    quantity: 2000,
                },
            });
            await prisma.batchStock.create({
                data: {
                    batchId: batch.id,
                    departmentId: pharmacy.id,
                    quantity: 1000,
                },
            });
            for (const dept of standardDepts) {
                await prisma.batchStock.create({
                    data: {
                        batchId: batch.id,
                        departmentId: dept.id,
                        quantity: 500,
                    },
                });
            }
        }
    }

    // 4. Generate 3000 Inventory Transactions (The meat of the reports)
    console.log('📊 Generating 3000 Inventory Transactions...');
    const txTypes: TransactionType[] = [
        'purchase_receipt',
        'department_transfer_out',
        'department_transfer_in',
        'prescription_dispense',
        'department_consumption',
        'adjustment_damaged',
        'adjustment_expired',
        'adjustment_shrinkage',
        'adjustment_found',
    ];

    const txData: any[] = [];
    for (let i = 0; i < 3000; i++) {
        const variant = randomElement(variants);
        const variantBatches = batches.filter(
            (b: any) => b.variantId === variant.id,
        );
        const batch = randomElement(variantBatches);
        const dept = randomElement([
            centralWarehouse,
            pharmacy,
            ...standardDepts,
        ]);
        const type = randomElement(txTypes);

        let quantity = 0;
        if (
            type === 'purchase_receipt' ||
            type === 'department_transfer_in' ||
            type === 'adjustment_found'
        ) {
            quantity = Math.floor(Math.random() * 50) + 1;
        } else {
            quantity = -(Math.floor(Math.random() * 20) + 1);
        }

        txData.push({
            transactionType: type,
            variantId: variant.id,
            batchId: batch.id,
            departmentId: dept.id,
            quantity,
            balanceAfter: Math.floor(Math.random() * 1000), // Mock balance for historical charts
            referenceType: 'adjustment',
            performedById: randomElement(allActiveUsers).id,
            transactionDate: randomPastDate(365),
            notes: `Historical ${type}`,
        });
    }

    // Bulk insert transactions (chunking to avoid memory issues)
    const chunkSize = 500;
    for (let i = 0; i < txData.length; i += chunkSize) {
        await prisma.inventoryTransaction.createMany({
            data: txData.slice(i, i + chunkSize),
        });
    }

    // 5. Generate 500 Inventory Adjustments
    console.log('🛠️ Generating 500 Inventory Adjustments...');
    const adjTypes: AdjustmentType[] = [
        'damaged',
        'expired',
        'shrinkage',
        'found',
    ];
    const adjData: any[] = [];
    for (let i = 0; i < 500; i++) {
        const variant = randomElement(variants);
        const variantBatches = batches.filter(
            (b: any) => b.variantId === variant.id,
        );
        const batch = randomElement(variantBatches);
        const dept = randomElement([pharmacy, ...standardDepts]);

        adjData.push({
            variantId: variant.id,
            departmentId: dept.id,
            batchId: batch.id,
            adjustmentType: randomElement(adjTypes),
            quantity: Math.floor(Math.random() * 10) + 1,
            reportedById: randomElement(allActiveUsers).id,
            notes: `Historical adjustment`,
            createdAt: randomPastDate(365),
        });
    }
    for (let i = 0; i < adjData.length; i += chunkSize) {
        await prisma.inventoryAdjustment.createMany({
            data: adjData.slice(i, i + chunkSize),
        });
    }

    // 6. Generate Patients and Medical Visits
    console.log('🏥 Generating Patients and Medical Visits...');
    const patients: any[] = [];
    for (let i = 0; i < 100; i++) {
        const p = await prisma.patient.create({
            data: {
                fullName: `Historical Patient ${i + 1}`,
                // Random 11-digit National ID to avoid unique constraint errors on re-runs
                nationalId: `1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
                registeredById: randomElement(
                    receptionists.length > 0 ? receptionists : allActiveUsers,
                ).id,
            },
        });
        patients.push(p);
    }

    const visitData: any[] = [];
    for (let i = 0; i < 500; i++) {
        const patient = randomElement(patients);
        const doctor = randomElement(
            doctors.length > 0 ? doctors : allActiveUsers,
        );
        const dept = doctor.departmentId
            ? departments.find((d) => d.id === doctor.departmentId)
            : randomElement(standardDepts);

        visitData.push({
            patientId: patient.id,
            doctorId: doctor.id,
            departmentId: dept!.id,
            visitDate: randomPastDate(365),
            status: VisitStatus.completed,
            diagnosis: `Historical Diagnosis ${Math.floor(Math.random() * 10)}`,
            clinicalNotes: 'Routine historical visit.',
        });
    }
    await prisma.medicalVisit.createMany({ data: visitData });

    // 7. Generate Historical Purchase Requests
    console.log('📝 Generating Historical Purchase Requests...');
    const prData: any[] = [];
    for (let i = 0; i < 50; i++) {
        prData.push({
            requestNumber: `PR-HIST-${i}-${Date.now()}`,
            requestedById: userPurchasing.id,
            status: RequestStatus.complete,
            priority: RefillRequestPriority.normal,
            hospitalApprovedById: userHassan.id,
            hospitalApprovedAt: randomPastDate(365),
            approvedById: userPurchasing.id,
            approvedAt: randomPastDate(365),
            notes: 'Historical purchase request',
            createdAt: randomPastDate(365),
        });
    }
    await prisma.purchaseRequest.createMany({ data: prData });

    console.log('✅ Historical Data Generation Complete!');
    console.log(
        `Generated: 12 Variants, ${batches.length} Batches, 3000 Transactions, 500 Adjustments, 100 Patients, 500 Visits, 50 PRs.`,
    );
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
