// Maps ammunition type display text to numeric ID
export const getAmmunitionTypeId = (displayText: string): number | null => {
  switch (displayText) {
    case 'Small':
      return 1;
    case 'Medium':
      return 2;
    case 'Large':
      return 3;
    default:
      return null;
  }
}

// Maps ammunition type numeric ID to display text
export const getAmmunitionTypeDisplayText = (typeId: number): string | null => {
  switch (typeId) {
    case 1:
      return 'Small';
    case 2:
      return 'Medium';
    case 3:
      return 'Large';
    default:
      return null;
  }
}

