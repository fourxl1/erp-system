import { resolveApiUrl } from "../services/api";

function ItemIdentity({ name, imagePath, meta, compact = false }) {
  const displayName = name || "Unnamed item";

  const imageUrl = imagePath
    ? imagePath.startsWith("http")
      ? imagePath
      : resolveApiUrl(imagePath)
    : "";

  const placeholder = displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className={`inventory-item${compact ? " inventory-item--compact" : ""}`}>
      
      {/* IMAGE */}
      <div
        className={`inventory-item__image ${
          imageUrl ? "" : " inventory-item__image--empty"
        }`}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={displayName} loading="lazy" />
        ) : (
          <span>{placeholder}</span>
        )}
      </div>

      {/* DETAILS */}
      <div className="inventory-item__details">
        <strong className="inventory-item__name" title={displayName}>
          {displayName}
        </strong>

        {meta && (
          <div className="inventory-item__meta">
            {meta}
          </div>
        )}
      </div>
    </div>
  );
}

export default ItemIdentity;