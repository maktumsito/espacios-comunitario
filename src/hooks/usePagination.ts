import { useState, useMemo, useEffect } from 'react';

export interface UsePaginationOptions {
  initialPageSize?: number;
  initialPage?: number;
}

export interface UsePaginationReturn<T> {
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  paginatedItems: T[];
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;
}

export function usePagination<T>(
  items: readonly T[] | T[],
  options: number | UsePaginationOptions = 10
): UsePaginationReturn<T> {
  const initialSize = typeof options === 'number' ? options : options.initialPageSize ?? 10;
  const initialPage = typeof options === 'number' ? 1 : options.initialPage ?? 1;

  const [pageSize, setPageSizeState] = useState<number>(initialSize);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Auto-correct page if items count shrinks
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const setPageSize = (newSize: number) => {
    setPageSizeState(newSize);
    setCurrentPage(1);
  };

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginatedItems = useMemo(() => {
    if (totalItems === 0) return [];
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex, totalItems]);

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const goToNextPage = () => {
    if (canGoNext) setCurrentPage((prev) => prev + 1);
  };

  const goToPreviousPage = () => {
    if (canGoPrev) setCurrentPage((prev) => prev - 1);
  };

  const goToFirstPage = () => {
    setCurrentPage(1);
  };

  const goToLastPage = () => {
    setCurrentPage(totalPages);
  };

  return {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    paginatedItems,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    canGoNext,
    canGoPrev
  };
}
