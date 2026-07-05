import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { motion } from 'framer-motion';
import { GlassPanel } from '../components/GlassPanel';
import { Countdown } from '../components/Countdown';
import { BreathingGuide } from '../components/BreathingGuide';
import { useTheme } from '../components/useTheme';
import { useAmbientSound } from '../components/useAmbientSound';
import type { Theme, AmbientSound } from '../../shared/types';
import '../types/global';
import '../styles/index.css';

interface OverlaySettings {
  theme: Theme;
  soundOn: boolean;
  ambientSound: AmbientSound;
}

function Overlay() {
  const [remaining, setRemaining] = useState(20);
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings | null>(null);

  useEffect(() => {
    const cleanupCountdown = window.eyeshield.overlay.onCountdown(setRemaining);
    const cleanupSettings = window.eyeshield.overlay.onSettings((s) => {
      setOverlaySettings({
        theme: s.theme as Theme,
        soundOn: s.soundOn,
        ambientSound: s.ambientSound as AmbientSound,
      });
    });
    return () => {
      cleanupCountdown();
      cleanupSettings();
    };
  }, []);

  useTheme(overlaySettings?.theme);
  useAmbientSound(overlaySettings?.soundOn ?? false, overlaySettings?.ambientSound ?? 'none');

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <div className="gradient-bg">
        <div className="blob blob-ion" />
        <div className="blob blob-plasma" />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-12">
        <motion.p
          className="text-sm tracking-[0.3em] uppercase text-text-muted"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          Eye Break
        </motion.p>

        <GlassPanel glow className="px-20 py-16 flex flex-col items-center gap-10">
          <Countdown seconds={remaining} large />
          <div className="flex items-center gap-8">
            <BreathingGuide cycleSec={15} />
          </div>
          <p className="text-text-muted text-base max-w-md text-center leading-relaxed">
            Look at something 20 feet away. Soften your gaze. Breathe.
          </p>
        </GlassPanel>

        <motion.p
          className="text-xs text-text-muted/60 mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
        >
          Emergency override: hold Ctrl+Alt+Shift+Q for 5s, or press Esc 5x rapidly
        </motion.p>
      </div>
    </motion.div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Overlay />);
