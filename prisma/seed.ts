import { PrismaClient, UserStatus, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const NUM_USERS = 300;

async function main() {
    console.log(
        `🚀 Starting Users Seed: Generating ${NUM_USERS} users with random roles and departments...`,
    );

    // 1. Fetch ALL active roles and departments from the database concurrently
    const [availableRoles, availableDepartments] = await Promise.all([
        prisma.role.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
        }),
        prisma.department.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
        }),
    ]);

    if (availableRoles.length === 0) {
        throw new Error(
            '❌ No active roles found in the database. Please seed roles first.',
        );
    }

    if (availableDepartments.length === 0) {
        throw new Error(
            '❌ No active departments found in the database. Please seed departments first.',
        );
    }

    console.log(
        `✅ Found ${availableRoles.length} active roles and ${availableDepartments.length} active departments to assign randomly.`,
    );

    // 2. Generate the user data array with EXPLICIT typing to prevent the 'never[]' error
    const usersData: Prisma.UserCreateManyInput[] = [];

    for (let i = 1; i <= NUM_USERS; i++) {
        // Pad the number to ensure unique, cleanly formatted phone numbers (e.g., +966500000001)
        const paddedIndex = i.toString().padStart(4, '0');

        // Pick a random role and a random department
        const randomRole =
            availableRoles[Math.floor(Math.random() * availableRoles.length)];
        const randomDept =
            availableDepartments[
                Math.floor(Math.random() * availableDepartments.length)
            ];

        usersData.push({
            fullName: `Test User ${i}`,
            email: `user${i}@example.com`,
            phone: `+96650000${paddedIndex}`,
            roleId: randomRole.id,
            departmentId: randomDept.id,
            status: UserStatus.active,
            // If the random role is 'doctor', provide a specialty to satisfy app-level validation rules
            specialty:
                randomRole.name === 'doctor' ? 'General Medicine' : undefined,
        });
    }

    // 3. Bulk insert the users using createMany for maximum performance
    console.log('💾 Inserting users into the database...');

    const result = await prisma.user.createMany({
        data: usersData,
        skipDuplicates: true, // Safely ignores if a user with the same email/phone already exists
    });

    console.log(`✅ Successfully seeded ${result.count} users.`);
    console.log('🎉 Users Seed Complete!');
}

main()
    .catch((e) => {
        console.error('❌ Error during seed:', e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
