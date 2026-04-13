import { useCallback, useMemo, useState } from "react";

function normalizeComparableValue(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  const text = String(value).trim();
  if (!text) {
    return "";
  }

  const numeric = Number(text);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
    return numeric;
  }

  const timestamp = Date.parse(text);
  if (!Number.isNaN(timestamp)) {
    return timestamp;
  }

  return text.toLowerCase();
}

function compareValues(left, right) {
  const normalizedLeft = normalizeComparableValue(left);
  const normalizedRight = normalizeComparableValue(right);

  if (normalizedLeft === null && normalizedRight === null) {
    return 0;
  }

  if (normalizedLeft === null) {
    return 1;
  }

  if (normalizedRight === null) {
    return -1;
  }

  if (normalizedLeft > normalizedRight) {
    return 1;
  }

  if (normalizedLeft < normalizedRight) {
    return -1;
  }

  return 0;
}

export function useSortedPagination(rows, options = {}) {
  const {
    initialSortKey = null,
    initialSortDirection = "asc",
    initialPageSize = 10,
    getSortValue
  } = options;

  const [sortKey, setSortKey] = useState(initialSortKey);
  const [sortDirection, setSortDirection] = useState(initialSortDirection);
  const [pageState, setPageState] = useState(1);
  const [pageSizeState, setPageSizeState] = useState(initialPageSize);
  const pageSize = Math.max(1, Number(pageSizeState || initialPageSize || 10));

  const sortedRows = useMemo(() => {
    const safeRows = Array.isArray(rows) ? rows : [];

    if (!sortKey) {
      return safeRows;
    }

    const multiplier = sortDirection === "desc" ? -1 : 1;
    const resolver =
      typeof getSortValue === "function"
        ? getSortValue
        : (row, key) => row?.[key];

    return [...safeRows].sort((left, right) => {
      const leftValue = resolver(left, sortKey);
      const rightValue = resolver(right, sortKey);
      return compareValues(leftValue, rightValue) * multiplier;
    });
  }, [getSortValue, rows, sortDirection, sortKey]);

  const totalItems = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(Math.max(Number(pageState || 1), 1), totalPages);

  const pagedRows = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return sortedRows.slice(startIndex, startIndex + pageSize);
  }, [page, pageSize, sortedRows]);

  const setPage = useCallback((nextPage) => {
    const numericPage = Number(nextPage);
    setPageState(Number.isFinite(numericPage) ? Math.max(1, Math.floor(numericPage)) : 1);
  }, []);

  const setPageSize = useCallback((nextPageSize) => {
    const numericPageSize = Number(nextPageSize);
    const normalizedPageSize =
      Number.isFinite(numericPageSize) && numericPageSize > 0
        ? Math.floor(numericPageSize)
        : initialPageSize;

    setPageSizeState(normalizedPageSize);
    setPageState(1);
  }, [initialPageSize]);

  const toggleSort = useCallback((nextKey) => {
    if (!nextKey) {
      return;
    }

    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      setPageState(1);
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
    setPageState(1);
  }, [sortKey]);

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    sortKey,
    sortDirection,
    setSortKey,
    setSortDirection,
    toggleSort,
    totalItems,
    totalPages,
    sortedRows,
    pagedRows
  };
}

export default useSortedPagination;
