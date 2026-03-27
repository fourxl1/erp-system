function BrandMark({ compact = false, centered = false }) {
  return (
    <div
      className={`brand-mark${compact ? " brand-mark--compact" : ""}${
        centered ? " brand-mark--centered" : ""
      }`}
    >
      <div className="brand-mark__title">LATEX FOAM</div>
      <div className="brand-mark__subtitle">STORE</div>

      <div className="brand-mark__crest">
        <div className="brand-mark__figures" aria-hidden="true">
          <span className="brand-mark__figure brand-mark__figure--dark" />
          <span className="brand-mark__figure brand-mark__figure--light" />
        </div>

        <div className="brand-mark__script">LATEX FOAM</div>
        <div className="brand-mark__mattress">STORE</div>
      </div>
    </div>
  );
}

export default BrandMark;
