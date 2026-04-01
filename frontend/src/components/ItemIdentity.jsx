import { useState } from "react";
import ImageLightbox from "./ImageLightbox";
import { resolveApiUrl } from "../services/api";

function ItemIdentity({ name, imagePath, meta, compact = false }) {
  const displayName = name || "Unnamed item";
  const [previewImage, setPreviewImage] = useState(null);

  const imageUrl = imagePath
    ? imagePath.startsWith("http")
      ? imagePath
      : resolveApiUrl(imagePath)
    : "";

  const placeholder = displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <>
      <div className={`inventory-item${compact ? " inventory-item--compact" : ""}`}>
        {imageUrl ? (
          <button
            type="button"
            className="inventory-item__image-button"
            onClick={() => setPreviewImage({ src: imageUrl, alt: displayName })}
            aria-label={`Preview ${displayName}`}
          >
            <div className="inventory-item__image">
              <img src={imageUrl} alt={displayName} loading="lazy" />
            </div>
          </button>
        ) : (
          <div className="inventory-item__image inventory-item__image--empty">
            <span>{placeholder}</span>
          </div>
        )}

        <div className="inventory-item__details">
          <strong className="inventory-item__name" title={displayName}>
            {displayName}
          </strong>

          {meta ? (
            <div className="inventory-item__meta">
              {meta}
            </div>
          ) : null}
        </div>
      </div>
      <ImageLightbox image={previewImage} onClose={() => setPreviewImage(null)} />
    </>
  );
}

export default ItemIdentity;
