/**
 * Utility functions for Explosive enums
 */

// ExplosiveType Enum - MUST match backend exactly
export enum ExplosiveType {
    Grenade = 1,
    Mine = 2,
    PlasticExplosive = 3,
    Rocket = 4,
    Missile = 5,
    Detonator = 6,
    Bomb = 7,
    Other = 99
}

export const getExplosiveTypeOptions = (): { label: string; value: string }[] => {
    return Object.keys(ExplosiveType)
        .filter(key => isNaN(Number(key)))
        .map(key => ({
            label: key.replace(/([A-Z])/g, ' $1').trim(), // "PlasticExplosive" -> "Plastic Explosive"
            value: key // Use enum name as value to match backend JsonStringEnumConverter
        }));
};

export const getExplosiveTypeName = (value: number | string): string => {
    // Handle both number and string values from backend
    if (typeof value === 'string') {
        // If backend sends enum name as string (JsonStringEnumConverter)
        return value.replace(/([A-Z])/g, ' $1').trim();
    }
    
    // Convert numeric enum value to enum name
    // For numeric enums, we need to find the key that matches the value
    const numericValue = value as number;
    const enumKey = Object.keys(ExplosiveType).find(
        key => ExplosiveType[key as keyof typeof ExplosiveType] === numericValue && isNaN(Number(key))
    );
    
    if (!enumKey) {
        return 'Unknown';
    }
    
    // Convert enum name to readable format: "PlasticExplosive" -> "Plastic Explosive"
    return enumKey.replace(/([A-Z])/g, ' $1').trim();
};
