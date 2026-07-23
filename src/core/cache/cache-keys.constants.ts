export const CacheKeys = {
    effectivePermissions: (userId: string) => `permissions:effective:${userId}`,
    variantDetail: (variantId: string) => `catalog:variant:${variantId}`,
    userScope: (userId: string) => `users:scope:${userId}`,
    department: (departmentId: string) => `departments:byId:${departmentId}`,
    departmentByType: (type: string) => `departments:byType:${type}`,
    unitsList: () => `catalog:units:list`,
    categoriesList: () => `catalog:categories:list`,
};
