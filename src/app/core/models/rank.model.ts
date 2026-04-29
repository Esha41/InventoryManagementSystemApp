/**
 * Common rank DTO used across order, return, and discard services
 */
/** @see `ettadbackend/Project.Module.Logic/Dtos/RankDto.cs` */
export interface RankDto {
    id: number;
    nameAr?: string;
    nameEn?: string;
    name?: string; // Fallback for compatibility
    isDeleted?: boolean;
}
