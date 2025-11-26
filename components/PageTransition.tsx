
import React from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

const PageTransition: React.FC<PageTransitionProps> = ({ children, className = "" }) => {
  return (
    <motion.div
      initial={{ opacity: 0, zIndex: 10 }}
      animate={{ opacity: 1, zIndex: 10 }}
      exit={{ opacity: 0, zIndex: 0 }}
      transition={{ duration: 0.2 }}
      // Grid Stack Trick: Force into the same grid cell
      className={`col-start-1 row-start-1 w-full h-full bg-slate-50 dark:bg-slate-950 flex flex-col ${className}`}
      style={{ isolation: 'isolate' }}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
