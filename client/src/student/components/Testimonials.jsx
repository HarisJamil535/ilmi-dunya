import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Quote } from "lucide-react";

export default function Testimonials({ reviews = [], loading = false }) {
  const track = useRef(null);
  const [position, setPosition] = useState({ start: true, end: false });
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () => setPosition({
      start: element.scrollLeft <= 1,
      end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2,
    });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, [loading, reviews.length]);
  const move = (direction) => {
    const element = track.current;
    if (!element) return;
    element.scrollBy({ left: direction * element.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };

  if (!loading && reviews.length === 0) return null;

  return <section className="home-section home-testimonials" aria-label="Student testimonials">
    <div className="home-width">
      <div className="home-section-heading"><div><p className="home-eyebrow"><Quote size={17} /> Student voices</p><h2>Different journeys.<br /><span>One love for learning.</span></h2></div>
        {reviews.length > 1 && <div className="home-carousel-controls"><button type="button" onClick={() => move(-1)} disabled={position.start} aria-label="Previous testimonials" title="Previous testimonials"><ArrowLeft size={20} /></button><button type="button" onClick={() => move(1)} disabled={position.end} aria-label="Next testimonials" title="Next testimonials"><ArrowRight size={20} /></button></div>}
      </div>
      {loading ? <div className="home-review-loading" role="status" aria-label="Loading student stories"><div /><div /><div /></div> :
        <div className="home-review-track" ref={track} tabIndex={0} aria-label="Student stories">{reviews.map((review, index) =>
          <figure key={review._id || index} className={`home-review home-tone-${["mint", "peach", "lilac"][index % 3]}`}>
            <Quote size={32} strokeWidth={1.4} aria-hidden="true" /><blockquote>{review.comment}</blockquote>
            <figcaption><span className="home-review-avatar">{review.initials || review.name?.slice(0, 2).toUpperCase()}</span><span><strong>{review.name}</strong><small>{review.role}</small></span></figcaption>
          </figure>
        )}</div>}
    </div>
  </section>;
}
