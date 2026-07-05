import { motion, type HTMLMotionProps } from 'framer-motion';
import { type ReactNode } from 'react';

interface GlassPanelProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  glow?: boolean;
}

export function GlassPanel({ children, glow = false, className = '', ...rest }: GlassPanelProps) {
  return (
    <motion.div
      className={`glass-panel ${className}`}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      style={
        glow
          ? {
              boxShadow:
                '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 60px rgba(124,111,247,0.25)',
            }
          : undefined
      }
      {...rest}
    >
      {children}
    </motion.div>
  );
}
