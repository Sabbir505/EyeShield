import { motion } from 'framer-motion';

interface CountdownProps {
  seconds: number;
  /** When true, show the value larger and more prominent (break mode). */
  large?: boolean;
}

export function Countdown({ seconds, large = false }: CountdownProps) {
  const mm = Math.floor(Math.max(0, seconds) / 60);
  const ss = Math.max(0, seconds) % 60;
  const display = mm > 0 ? `${mm}:${String(ss).padStart(2, '0')}` : `${ss}`;

  return (
    <motion.div
      key={display}
      initial={{ opacity: 0.6, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`countdown ${large ? 'text-[16vh]' : 'text-[10vh]'} leading-none`}
      style={{
        background: 'linear-gradient(135deg, #F5F5F7 0%, #9B98B5 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}
    >
      {display}
    </motion.div>
  );
}
