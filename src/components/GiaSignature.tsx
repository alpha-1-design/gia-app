const GiaSignature = () => (
  <div className="gia-signature" aria-label="GIA signature">
    <svg className="gia-sig-glyph" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor" opacity="0.6" />
      <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.9" />
    </svg>
    <span className="gia-sig-text">GIA</span>
  </div>
);

export default GiaSignature;
