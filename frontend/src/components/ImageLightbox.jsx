import { useEffect } from "react";

function ImageLightbox({ image, onClose }) {
  useEffect(() => {
    if (!image) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [image, onClose]);

  if (!image) {
    return null;
  }

  return (
    <div className="image-lightbox" onClick={onClose}>
      <div className="image-lightbox__panel" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="image-lightbox__close"
          onClick={onClose}
          aria-label="Close image preview"
        >
          x
        </button>
        <img src={image.src} alt={image.alt || "Preview"} />
        {image.alt ? <p>{image.alt}</p> : null}
      </div>
    </div>
  );
}

export default ImageLightbox;
