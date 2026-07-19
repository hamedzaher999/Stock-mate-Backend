import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Existing roles
    const doctorRole = await prisma.role.findUniqueOrThrow({
        where: { name: 'doctor' },
    });

    // Departments
    const cardiology = await prisma.department.create({
        data: {
            name: 'Cardiology',
            type: 'standard',
            tracksInventory: false,
        },
    });

    const neurology = await prisma.department.create({
        data: {
            name: 'Neurology',
            type: 'standard',
            tracksInventory: false,
        },
    });

    // Doctors
    const d1 = await prisma.user.create({
        data: {
            fullName: 'Doctor One',
            email: 'd1@gmail.com',
            roleId: doctorRole.id,
            departmentId: cardiology.id,
            specialty: 'Cardiology',
        },
    });

    const d2 = await prisma.user.create({
        data: {
            fullName: 'Doctor Two',
            email: 'd2@gmail.com',
            roleId: doctorRole.id,
            departmentId: neurology.id,
            specialty: 'Neurology',
        },
    });

    // Third doctor for second prescription requirement
    const d3 = await prisma.user.create({
        data: {
            fullName: 'Doctor Three',
            email: 'd3@gmail.com',
            roleId: doctorRole.id,
            departmentId: cardiology.id,
            specialty: 'Internal Medicine',
        },
    });

    // Patients
    const patient1 = await prisma.patient.create({
        data: {
            fullName: 'Ahmad Hassan',
            nationalId: '100000001',
            familyBookNumber: 'FB001',
            patientId: 'PT-001',
            registeredById: d1.id,
        },
    });

    const patient2 = await prisma.patient.create({
        data: {
            fullName: 'Sara Ali',
            nationalId: '100000002',
            familyBookNumber: 'FB002',
            patientId: 'PT-002',
            registeredById: d2.id,
        },
    });

    // Helper function for visits
    async function createVisit(
        patientId: string,
        doctorId: string,
        departmentId: string,
        notes: string,
        diagnosis: string,
    ) {
        return prisma.medicalVisit.create({
            data: {
                patientId,
                doctorId,
                departmentId,
                clinicalNotes: notes,
                diagnosis,
                status: 'completed',
            },
        });
    }

    // Patient 1 history
    const p1v1 = await createVisit(
        patient1.id,
        d1.id,
        cardiology.id,
        'Patient complained about chest discomfort.',
        'Mild hypertension',
    );

    const p1v2 = await createVisit(
        patient1.id,
        d2.id,
        neurology.id,
        'Patient reported recurring headaches.',
        'Migraine symptoms',
    );

    const p1v3 = await createVisit(
        patient1.id,
        d1.id,
        cardiology.id,
        'Follow up visit. Blood pressure improved.',
        'Controlled hypertension',
    );

    // Patient 2 history
    const p2v1 = await createVisit(
        patient2.id,
        d2.id,
        neurology.id,
        'Initial neurological examination.',
        'Neurological evaluation',
    );

    const p2v2 = await createVisit(
        patient2.id,
        d1.id,
        cardiology.id,
        'Routine cardiac check.',
        'Normal cardiac function',
    );

    const p2v3 = await createVisit(
        patient2.id,
        d3.id,
        cardiology.id,
        'Follow up and medication adjustment.',
        'Stable condition',
    );

    // Get any medication variant already seeded
    const variant = await prisma.productVariant.findFirstOrThrow();

    // Patient 1: two prescriptions from d1 and d3
    await prisma.prescription.create({
        data: {
            visitId: p1v3.id,
            patientId: patient1.id,
            doctorId: d1.id,
            frequencyUnit: 'day',
            frequencyInterval: 1,
            totalCycles: 30,
            startDate: new Date(),
            currentCycleStart: new Date(),
            currentCycleEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            items: {
                create: {
                    variantId: variant.id,
                    prescribedQuantity: 30,
                    dosage: '1 tablet',
                    frequency: 'Once daily',
                    durationDays: 30,
                },
            },
        },
    });

    await prisma.prescription.create({
        data: {
            visitId: p1v2.id,
            patientId: patient1.id,
            doctorId: d3.id,
            frequencyUnit: 'day',
            frequencyInterval: 1,
            totalCycles: 10,
            startDate: new Date(),
            currentCycleStart: new Date(),
            currentCycleEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            items: {
                create: {
                    variantId: variant.id,
                    prescribedQuantity: 10,
                    dosage: '1 capsule',
                    frequency: 'Every morning',
                    durationDays: 10,
                },
            },
        },
    });

    // Patient 2: one prescription
    await prisma.prescription.create({
        data: {
            visitId: p2v3.id,
            patientId: patient2.id,
            doctorId: d3.id,
            frequencyUnit: 'week',
            frequencyInterval: 1,
            totalCycles: 4,
            startDate: new Date(),
            currentCycleStart: new Date(),
            currentCycleEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            items: {
                create: {
                    variantId: variant.id,
                    prescribedQuantity: 4,
                    dosage: '1 dose',
                    frequency: 'Weekly',
                    durationDays: 28,
                },
            },
        },
    });

    console.log('Medical history seed completed');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
