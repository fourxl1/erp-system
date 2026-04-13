const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50];

function TablePagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS
}) {
  if (!totalItems || totalItems <= 0) {
    return null;
  }

  const startIndex = (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalItems);

  return (
    <div className="table-pagination">
      <div className="table-pagination__meta">
        Showing {startIndex}-{endIndex} of {totalItems}
      </div>

      <div className="table-pagination__controls">
        <label className="table-pagination__size">
          Rows
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="secondary-button secondary-button--small"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Prev
        </button>

        <span className="table-pagination__page">
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          className="secondary-button secondary-button--small"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default TablePagination;
