import React from "react";
import Slider from "react-slick";

// Import slick-carousel css
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

const Testimonials = () => {
  const settings = {
    dots: true,
    infinite: true,
    centerMode: true,
    centerPadding: "0px",
    slidesToShow: 3,
    speed: 800,
    autoplay: true,
    autoplaySpeed: 3000,
    cssEase: "ease-in-out",
    arrows: false,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 1,
          centerPadding: "40px",
        },
      },
    ],
  };

  const reviews = [
    {
      id: 1,
      name: "Ahmed Ali",
      role: "E-commerce Vendor",
      comment: "The variety of laces and buttons available here is incredible. It has completely transformed how I stock my shop.",
      initials: "AA",
    },
    {
      id: 2,
      name: "Zainab Mansoor",
      role: "Fashion Designer",
      comment: "Finding high-quality needles and specific thread shades used to be a struggle. This platform is a lifesaver for my boutique.",
      initials: "ZM",
    },
    {
      id: 3,
      name: "Hamza Sheikh",
      role: "Wholesale Buyer",
      comment: "The bulk pricing and the smooth interface make it very easy to manage orders. Highly impressed with the service.",
      initials: "HS",
    },
    {
      id: 4,
      name: "Sara Khan",
      role: "Small Business Owner",
      comment: "Excellent customer support and very fast delivery. The accessories are even better than they look in the photos!",
      initials: "SK",
    },
  ];

  return (
    <section className="py-20 bg-[#fdfbf7] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-800 mb-4">Students Feedback</h2>
          <div className="h-1 w-20 bg-amber-400 mx-auto rounded-full"></div>
        </div>

        {/* Slider */}
        <Slider {...settings} className="testimonial-slider">
          {reviews.map((review) => (
            <div key={review.id} className="py-12 px-4">
              <div className="testimonial-card relative bg-white rounded-3xl p-8 border border-slate-100 shadow-sm transition-all duration-700 ease-in-out">
                {/* Quote Icon Decor */}
                <div className="absolute top-6 right-8 text-6xl text-slate-100 font-serif leading-none select-none">
                  “
                </div>
                
                {/* Content */}
                <div className="relative z-10 text-center">
                  <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 font-bold text-xl border border-amber-100">
                    {review.initials}
                  </div>
                  
                  <p className="text-slate-600 text-lg leading-relaxed italic mb-8">
                    {review.comment}
                  </p>
                  
                  <div className="mt-auto">
                    <h4 className="text-slate-900 font-bold text-lg">{review.name}</h4>
                    <p className="text-amber-600 text-sm font-medium">{review.role}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </Slider>
      </div>

      {/* Logic for Center Slide Scaling */}
      <style>{`
        .testimonial-slider .slick-list {
          overflow: visible;
        }
        
        /* The Card Transition Logic */
        .testimonial-card {
          transform: scale(0.85);
          opacity: 1;
          filter: blur(1px);
        }

        .slick-center .testimonial-card {
          transform: scale(1.1);
          opacity: 1;
          filter: blur(0);
          border-color: #fbbf24; /* amber-400 */
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08);
          z-index: 20;
        }

        /* Customize dots appearance */
        .slick-dots li button:before {
          font-size: 12px;
          color: #fbbf24;
        }
        .slick-dots li.slick-active button:before {
          color: #d97706;
        }
      `}</style>
    </section>
  );
};

export default Testimonials;