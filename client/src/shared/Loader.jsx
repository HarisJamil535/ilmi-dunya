import React from 'react';

// Using your primary logo purple for accents
const PRIMARY_PURPLE = '#7c3aed'; // A vibrant violet that matches your brand

const Loader = () => {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        
        {/* Animated Logo Assembly */}
        <div style={styles.bookWrapper}>
          
          {/* Static Book Structure (Left page and bottom spine) */}
          <svg style={styles.staticBookSvg} viewBox="0 0 100 80">
            {/* The primary book shape (matching your uploaded structure) */}
            <path 
              d="M50,75 L10,65 L10,15 L50,25" 
              fill={PRIMARY_PURPLE}
              stroke={PRIMARY_PURPLE} 
              strokeWidth="2"
            />
            {/* The spine */}
            <path d="M50,75 L50,25" stroke="white" strokeWidth="1.5" />
          </svg>

          {/* Fully Animated Page Fan (The Right Side) */}
          {/* This animates the right side fanning into layers and arcing knowledge */}
          <div style={styles.rightPageAnimWrapper}>
            {[...Array(5)].map((_, index) => (
              <div 
                key={index} 
                style={{
                  ...styles.animatedPageLayer,
                  animationDelay: `${index * 0.15}s`, // Stagger the layers
                  zIndex: 5 - index,
                  // Vary the purples
                  background: index === 0 ? PRIMARY_PURPLE : `rgba(124, 58, 237, ${0.9 - (index * 0.15)})`
                }}
              />
            ))}
          </div>

          {/* Floating 'Globe' Element (Top Right) */}
          {/* A soft pulse on the small globe icon found on your logo */}
          <div style={styles.globePulseWrapper}>
            <svg style={styles.globeSvg} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="white" fillOpacity="0.2"/>
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" fill="white" />
              <path d="M12 2a10 10 0 1 1-10 10A10 10 0 0 1 12 2zm0 18a8 8 0 1 0 8-8 8 8 0 0 0-8 8z" fill="white" fillOpacity="0.3" />
            </svg>
          </div>
          
        </div>

        {/* Branding and Tagline */}
        <h1 style={styles.platformName}>ILMIDUNYA</h1>
        <p style={styles.tagline}>Connecting Knowledge, Inspiring Futures</p>
        
        {/* Subtle, standard loading bar below the brand */}
        <div style={styles.progressBar}>
          <div style={styles.progressValue} />
        </div>
      </div>

      {/* Embedded CSS for Keyframes */}
      <style>{`
        /* 1. Staggered, cascading fan effect for the right page layers */
        @keyframes fanCascade {
          0%, 100% {
            transform: rotateY(0deg) skewX(0deg);
            opacity: 1;
          }
          50% {
            /* Open fully and fan out */
            transform: rotateY(-35deg) skewX(-2deg) translateX(4px);
            opacity: 0.8;
          }
        }

        /* 2. Soft, organic pulse for the 'globe' knowledge hub */
        @keyframes globePulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        /* 3. Smooth, continuous loading progress bar */
        @keyframes progressFlow {
          0% { left: -40%; width: 30%; }
          50% { width: 50%; }
          100% { left: 110%; width: 30%; }
        }
      `}</style>
    </div>
  );
};

// Inline, highly customizable styles
const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: '#ffffff', // Clean white background
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
    fontFamily: '"Poppins", "Segoe UI", sans-serif',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  bookWrapper: {
    position: 'relative',
    width: '100px', // Scaling size
    height: '80px',
    marginBottom: '20px',
    perspective: '1000px', // Crucial for 3D page animations
  },
  staticBookSvg: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  rightPageAnimWrapper: {
    position: 'absolute',
    left: '50px', // Alignment with spine
    top: '25px', // Alignment with path top
    width: '40px',
    height: '50px', // matching height of path L10,65
    transformOrigin: 'left center',
  },
  animatedPageLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    transformOrigin: 'left center',
    borderTopRightRadius: '4px',
    borderBottomRightRadius: '4px',
    borderLeft: `1.5px solid white`, // The 'spine' white line
    animation: 'fanCascade 2s infinite ease-in-out',
    boxShadow: '2px 2px 5px rgba(0,0,0,0.1)', // Subtle depth
  },
  globePulseWrapper: {
    position: 'absolute',
    top: '15%',
    right: '15%',
    width: '20px',
    height: '20px',
    zIndex: 10,
    opacity: 0.5,
    animation: 'globePulse 3s infinite ease-in-out',
  },
  globeSvg: {
    width: '100%',
    height: '100%',
  },
  platformName: {
    fontSize: '28px',
    fontWeight: '700',
    color: PRIMARY_PURPLE,
    margin: '0 0 6px 0',
    letterSpacing: '1px',
    textTransform: 'uppercase', // Match logo capitalization
  },
  tagline: {
    fontSize: '14px',
    color: '#6b7280', // Soft grey
    margin: '0 0 24px 0',
    maxWidth: '220px',
    lineHeight: '1.4',
    animation: 'globePulse 2s infinite ease-in-out', // Reuse simple pulse
  },
  progressBar: {
    width: '160px',
    height: '4px',
    backgroundColor: '#ede9fe', // Very light purple
    borderRadius: '10px',
    overflow: 'hidden',
    position: 'relative',
  },
  progressValue: {
    height: '100%',
    position: 'absolute',
    backgroundColor: PRIMARY_PURPLE,
    borderRadius: '10px',
    animation: 'progressFlow 2s infinite ease-in-out',
  }
};

export default Loader;