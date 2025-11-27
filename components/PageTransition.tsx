
import React from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

const variants = {
  initial: { 
    opacity: 0, 
    scale: 0.96, // Start slightly zoomed out
    filter: 'blur(4px)' 
  },
  enter: { 
    opacity: 1, 
    scale: 1, 
    filter: 'blur(0px)',
    transition: {
      duration: 0.25, // Fast
      ease: [0.4, 0, 0.2, 1] // Crisp easing
    }
  },
  exit: { 
    opacity: 0, 
    scale: 1.04, // Zoom in slightly as it fades out (depth effect)
    filter: 'blur(4px)',
    transition: {
      duration: 0.2, // Faster exit
      ease: "easeIn"
    }
  }
};

const PageTransition: React.FC<PageTransitionProps> = ({ children, className = "" }) => {
  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={variants}
      // Grid Stack Trick: Force into the same grid cell to prevent layout shifts during exit
      className={`col-start-1 row-start-1 w-full h-full ${className}`}
      style={{ 
          isolation: 'isolate',
          willChange: 'transform, opacity, filter' // Performance hint for GPU
      }}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
