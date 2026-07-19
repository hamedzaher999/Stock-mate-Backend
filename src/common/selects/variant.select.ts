import { Prisma } from '@prisma/client';

export const variantInventorySelect = {
    id: true,
    variantName: true,
    sku: true,
    unit: { select: { id: true, name: true, abbreviation: true } },
    product: {
        select: {
            id: true,
            name: true,
            materialType: true,
            category: { select: { id: true, name: true } },
        },
    },
    stockSettings: {
        select: {
            id: true,
            departmentId: true,
            minimumStock: true,
            maximumStock: true,
        },
    },
} satisfies Prisma.ProductVariantSelect;

export const variantMinimalSelect = {
    id: true,
    variantName: true,
    sku: true,
} satisfies Prisma.ProductVariantSelect;
