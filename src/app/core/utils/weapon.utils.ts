/**
 * Utility functions for Weapon enums
 */

// WeaponType Enum
export enum WeaponType {
    Pistol = 1,
    Rifle = 2,
    Shotgun = 3,
    MachineGun = 4,
    SniperRifle = 5,
    Carbine = 6,
    SubmachineGun = 7,
    GrenadeLauncher = 8,
    Mortar = 9,
    AntiTank = 10
}

// ActionType Enum
export enum ActionType {
    BoltAction = 1,
    LeverAction = 2,
    PumpAction = 3,
    SemiAutomatic = 4,
    Automatic = 5,
    BreakAction = 6,
    Revolver = 7,
    SingleShot = 8
}

export const getWeaponTypeOptions = (): { label: string; value: string }[] => {
    return Object.keys(WeaponType)
        .filter(key => isNaN(Number(key)))
        .map(key => ({
            label: key.replace(/([A-Z])/g, ' $1').trim(), // Add space before capital letters
            value: key // Use enum name as value to match backend JsonStringEnumConverter
        }));
};

export const getActionTypeOptions = (): { label: string; value: number }[] => {
    return Object.keys(ActionType)
        .filter(key => isNaN(Number(key)))
        .map(key => ({
            label: key.replace(/([A-Z])/g, ' $1').trim(),
            value: ActionType[key as keyof typeof ActionType]
        }));
};

export const getWeaponTypeName = (value: number): string => {
    return WeaponType[value] || 'Unknown';
};

export const getActionTypeName = (value: number): string => {
    return ActionType[value] || 'Unknown';
};
