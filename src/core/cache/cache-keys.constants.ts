export const CacheKeys = {
    effectivePermissions: (userId: string) => `permissions:effective:${userId}`,
    variantDetail: (variantId: string) => `catalog:variant:${variantId}`,
};
