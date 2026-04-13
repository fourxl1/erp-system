function SortHeader({
  label,
  columnKey,
  sortKey,
  sortDirection,
  onSort,
  align = "left"
}) {
  const isActive = String(sortKey || "") === String(columnKey || "");
  const indicator = isActive ? (sortDirection === "asc" ? "^" : "v") : "<>";
  const className = [
    "table-sort-button",
    align === "right" ? "table-sort-button--right" : "",
    align === "center" ? "table-sort-button--center" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={className} onClick={() => onSort(columnKey)}>
      <span>{label}</span>
      <span className={`table-sort-button__icon ${isActive ? "table-sort-button__icon--active" : ""}`}>
        {indicator}
      </span>
    </button>
  );
}

export default SortHeader;
