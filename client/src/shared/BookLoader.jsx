import "./BookLoader.css";

export default function BookLoader({ size = 80, label = "Loading ..." }) {
  return (
    <div className="book-loader" role="status" aria-live="polite" aria-label={label} style={{ "--book-loader-size": `${size}px` }}>
      <div className="book-loader__book" aria-hidden="true">
        <svg viewBox="0 0 375 319" fill="currentColor" focusable="false">
          <path d="M25 65H51V209Q113 220 185 259Q252 218 308 209V65H334V233Q254 240 185 290Q112 244 25 233Z" />
          <path d="M65 21Q125 20 174 81V246Q122 207 65 196Z" />
          <path d="M186 81Q236 20 294 21V196Q236 205 186 246Z" />
        </svg>
        {[0, 1, 2].map(page => <span key={page} className="book-loader__page" />)}
      </div>
      <span className="book-loader__label" aria-hidden="true">Loading ...</span>
    </div>
  );
}
