/**
 * Utility functions for Explosive enums
 */

// ExplosiveType Enum
export enum ExplosiveType {
    Grenade = 1,
    Mine = 2,
    Bomb = 3,
    Missile = 4,
    Rocket = 5,
    Torpedo = 6,
    DepthCharge = 7,
    DemolitionCharge = 8,
    Pyrotechnic = 9,
    Flare = 10,
    Dynamite = 11,
    C4 = 12,
    TNT = 13,
    Semtex = 14,
    Cordite = 15,
    Gunpowder = 16
}

export const getExplosiveTypeOptions = (): { label: string; value: number }[] => {
    return Object.keys(ExplosiveType)
        .filter(key => isNaN(Number(key)))
        .map(key => ({
            label: key.replace(/([A-Z])/g, ' $1').trim(),
            value: ExplosiveType[key as keyof typeof ExplosiveType]
        }));
};

export const getExplosiveTypeName = (value: number): string => {
    return ExplosiveType[value] || 'Unknown';
};
