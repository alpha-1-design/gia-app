import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ModuleRegistry from './ModuleRegistry';

const TransitionLayer = () => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="module-wrapper"
        initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 1.02, filter: 'blur(10px)' }}
        transition={{
          duration: 0.4,
          ease: [0.4, 0, 0.2, 1], // Standard cubic-bezier for a "smooth" high-end feel
        }}
        className="h-full w-full"
      >
        <ModuleRegistry />
      </motion.div>
    </AnimatePresence>
  );
};

export default TransitionLayer;
