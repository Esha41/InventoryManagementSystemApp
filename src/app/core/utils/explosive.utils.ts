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

export const getExplosiveTypeName = (value: number): string => {
    return ExplosiveType[value] || 'Unknown';
};
