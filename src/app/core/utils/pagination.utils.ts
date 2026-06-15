export interface PaginationState {
  currentPage: number;
  rowsPerPage: number;
  totalPages: number;
}

/**
 * Generic list pagination helpers shared across features.
 */
export class PaginationUtils {
  static paginateList<T>(items: T[], currentPage: number, rowsPerPage: number): T[] {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return items.slice(startIndex, startIndex + rowsPerPage);
  }

  static paginateListWithState<T>(
    items: T[],
    state: Pick<PaginationState, 'currentPage' | 'rowsPerPage'>
  ): T[] {
    return PaginationUtils.paginateList(items, state.currentPage, state.rowsPerPage);
  }

  static calculateTotalPages(totalItems: number, rowsPerPage: number): number {
    return Math.ceil(totalItems / rowsPerPage);
  }

  static clampCurrentPage(currentPage: number, totalPages: number): number {
    if (currentPage < 1) {
      return 1;
    }
    if (currentPage > totalPages && totalPages > 0) {
      return totalPages;
    }
    return currentPage;
  }

  static buildState(
    totalItems: number,
    currentPage: number,
    rowsPerPage: number
  ): PaginationState {
    const totalPages = PaginationUtils.calculateTotalPages(totalItems, rowsPerPage);
    return {
      currentPage: PaginationUtils.clampCurrentPage(currentPage, totalPages),
      rowsPerPage,
      totalPages
    };
  }

  /** 1-based start index for "showing X–Y of Z" labels. Returns 0 when empty. */
  static getStartIndex(currentPage: number, rowsPerPage: number, totalItems: number): number {
    if (totalItems === 0) {
      return 0;
    }
    return (currentPage - 1) * rowsPerPage + 1;
  }

  /** 1-based end index for "showing X–Y of Z" labels. */
  static getEndIndex(currentPage: number, rowsPerPage: number, totalItems: number): number {
    return Math.min(currentPage * rowsPerPage, totalItems);
  }
}
