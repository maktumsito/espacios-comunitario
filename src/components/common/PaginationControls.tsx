import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  compact?: boolean;
  className?: string;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  itemLabel = 'registros',
  compact = false,
  className = ''
}) => {
  if (totalItems === 0) return null;

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    const maxVisible = compact ? 3 : 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      const start = Math.max(2, currentPage - (compact ? 1 : 2));
      const end = Math.min(totalPages - 1, currentPage + (compact ? 1 : 2));

      if (start > 2) {
        pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-3 sm:px-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl text-xs text-slate-600 select-none ${className}`}
    >
      {/* Items count & Page Size Selector */}
      <div className="flex items-center flex-wrap gap-2 text-slate-500">
        <span>
          Mostrando{' '}
          <strong className="text-slate-800 font-semibold">{totalItems > 0 ? startIndex + 1 : 0}</strong>
          {' - '}
          <strong className="text-slate-800 font-semibold">{endIndex}</strong> de{' '}
          <strong className="text-slate-800 font-semibold">{totalItems}</strong> {itemLabel}
        </span>

        {onPageSizeChange && pageSize && (
          <div className="flex items-center space-x-1.5 ml-2 pl-2 border-l border-slate-200">
            <span className="text-[11px] text-slate-400">Por pág:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Cantidad de elementos por página"
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page Navigation Buttons */}
      <div className="flex items-center space-x-1">
        {/* First Page */}
        {!compact && totalPages > 4 && (
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            aria-disabled={currentPage === 1}
            aria-label="Primera página"
            title="Primera página"
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition cursor-pointer"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Previous Page */}
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          aria-disabled={currentPage === 1}
          aria-label="Página anterior"
          title="Página anterior"
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-medium transition cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px]">Anterior</span>
        </button>

        {/* Numbered Page Buttons */}
        <div className="flex items-center space-x-1">
          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="px-1.5 py-1 text-slate-400 text-xs font-bold">
                  …
                </span>
              );
            }

            const isCurrent = p === currentPage;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={`Ir a página ${p}`}
                className={`min-w-[28px] h-7 px-2 flex items-center justify-center rounded-lg text-xs font-bold transition cursor-pointer ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-xs border border-blue-600'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          aria-disabled={currentPage === totalPages}
          aria-label="Página siguiente"
          title="Página siguiente"
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-medium transition cursor-pointer"
        >
          <span className="hidden sm:inline text-[11px]">Siguiente</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last Page */}
        {!compact && totalPages > 4 && (
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            aria-disabled={currentPage === totalPages}
            aria-label="Última página"
            title="Última página"
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition cursor-pointer"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
