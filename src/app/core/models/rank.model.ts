/**
 * Common rank DTO used across order, return, and discard services
 */
export interface RankDto {
    id: number;
    nameAr?: string;
    nameEn?: string;
    name?: string; // Fallback for compatibility
}
