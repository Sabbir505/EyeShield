import { motion } from 'framer-motion';

interface BreathingGuideProps {
  /** Total cycle length in seconds (inhale + hold + exhale). Default 15 = 4+7+4. */
  cycleSec?: number;
}

/**
 * Soft pulsing circle synced to a 4-7-4 breathing cadence:
 * inhale 4s → hold 7s → exhale 4s = 15s total.
 */
export function BreathingGuide({ cycleSec = 15 }: BreathingGuideProps) {
  const inhale = 4 / cycleSec;
  const holdEnd = 11 / cycleSec; // 4 + 7

  return (
    <motion.div
      className="relative"
      style={{ width: 180, height: 180 }}
      initial={{ scale: 0.6, opacity: 0.4 }}
      animate={{
        scale: [0.6, 1, 1, 0.6],
        opacity: [0.4, 0.9, 0.9, 0.4],
      }}
      transition={{
        duration: cycleSec,
        times: [0, inhale, holdEnd, 1],
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(124,111,247,0.5) 0%, rgba(0,212,170,0.2) 60%, transparent 100%)',
          filter: 'blur(20px)',
        }}
      />
      <div
        className="absolute inset-0 rounded-full border"
        style={{ borderColor: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}
      />
      <div
        className="absolute inset-6 rounded-full border"
        style={{ borderColor: 'rgba(255,255,255,0.12)' }}
      />
    </motion.div>
  );
}
