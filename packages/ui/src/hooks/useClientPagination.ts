'use client';

import { useEffect, useMemo, useState } from 'react';

export type UseClientPaginationOptions = {
  pageSize?: number;
  pageSizeOptions?: number[];
};

export type UseClientPaginationResult<T> = {
  pageItems: T[];
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  setPageSize: (size: number) => void;
  pageSizeOptions: number[];
};

export function useClientPagination<T>(
  items: T[],
  options: UseClientPaginationOptions = {},
): UseClientPaginationResult<T> {
  const pageSizeOptions = options.pageSizeOptions ?? [10, 25, 50];
  const defaultPageSize = options.pageSize ?? pageSizeOptions[1] ?? 25;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [items.length, pageSize]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  function setPageSize(size: number): void {
    setPageSizeState(size);
    setPage(1);
  }

  return {
    pageItems,
    page,
    setPage,
    totalPages,
    totalItems,
    pageSize,
    setPageSize,
    pageSizeOptions,
  };
}
