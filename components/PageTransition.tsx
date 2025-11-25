import React from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

const PageTransition: React.FC<PageTransitionProps> = ({ children, className = "" }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }} // Quick transition to minimize overlap feel
      className={`flex flex-col h-full w-full relative ${className}`} // Explicitly relative, full size, flex container
      style={{ isolation: 'isolate' }} // Create new stacking context
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;