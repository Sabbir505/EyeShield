import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion } from 'framer-motion';
import { GlassPanel } from '../components/GlassPanel';
import { useTheme } from '../components/useTheme';
import { ICONS as SHARED_ICONS } from '../components/icons';
import '../types/global';
import type { EyeBreakSettings } from '../types/global';
import '../styles/index.css';

type Step = 'welcome' | 'context' | 'permissions' | 'autostart' | 'done';

const STEPS: Step[] = ['welcome', 'context', 'permissions', 'autostart', 'done'];

const ICONS = {
  ...SHARED_ICONS,
  shield: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  eye: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  heart: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  lock: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  keyboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><line x1="6" y1="8" x2="6" y2="8"/><line x1="10" y1="8" x2="10" y2="8"/><line x1="14" y1="8" x2="14" y2="8"/><line x1="18" y1="8" x2="18" y2="8"/><line x1="6" y1="12" x2="6" y2="12"/><line x1="10" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="14" y2="12"/><line x1="18" y1="12" x2="18" y2="12"/><line x1="6" y1="16" x2="18" y2="16"/>
    </svg>
  ),
  shieldCheck: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 12 15 16 10"/>
    </svg>
  ),
  power: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
    </svg>
  ),
  check: (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  sparkle: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
  ),
};

function StepCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-surf surf-1">
      <div className="w-9 h-9 rounded-lg surf-2 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>{title}</div>
        <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{children}</div>
      </div>
    </div>
  );
}

function Onboarding() {
  const [step, setStep] = useState<Step>('welcome');
  const [reasonForUse, setReasonForUse] = useState('');
  const [intervalMin, setIntervalMin] = useState(20);
  const [breakDurationSec, setBreakDurationSec] = useState(20);
  const [autoStart, setAutoStart] = useState(true);
  const [theme, setTheme] = useState<'void' | 'aurora' | 'dawn'>('void');

  useTheme(theme);

  const finish = async () => {
    try {
      if (!window.eyeshield) {
        console.error('window.eyeshield is undefined — preload not loaded');
        return;
      }
      await window.eyeshield.onboarding.complete({
        reasonForUse,
        intervalMin,
        breakDurationSec,
        autoStart,
        theme,
      });
    } catch (e) {
      console.error('Onboarding complete failed:', e);
    }
  };

  const idx = STEPS.indexOf(step);

  const stepVariants = {
    initial: { opacity: 0, x: 30, scale: 0.98 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -30, scale: 0.98 },
  };

  return (
    <div className="w-[560px] h-[560px] flex items-center justify-center rounded-glass overflow-hidden bg-transparent">
      <GlassPanel
        className="w-[560px] h-[560px] flex flex-col p-6 light-glass !overflow-visible glass-panel-flat"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Header — step indicator */}
        <header className="flex items-center gap-2 mb-6 flex-shrink-0">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 rounded-full transition-all ${
                i === idx ? 'w-8 bg-plasma' : i < idx ? 'w-4 bg-ion-purple' : 'w-4 bg-white/20'
              }`}
            />
          ))}
          <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
            Step {idx + 1} of {STEPS.length}
          </span>
        </header>

        {/* Content — animated step body */}
        <main className="flex-1 overflow-y-auto scrollbar-hide -mx-1 px-1" data-no-drag>
          <AnimatePresence mode="wait">
            {step === 'welcome' && (
              <motion.div
                key="welcome"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="flex flex-col items-center text-center pt-4"
              >
                <div className="w-20 h-20 rounded-2xl surf-2 flex items-center justify-center mb-6" style={{ color: 'var(--plasma)' }}>
                  {ICONS.eye}
                </div>
                <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Welcome to EyeShield</h1>
                <p className="mb-2 leading-relaxed text-sm max-w-xs" style={{ color: 'var(--text-muted)' }}>
                  A calm, forced eye-break tool. Unlike dismissible reminders, EyeShield
                  locks your screen for the full break duration — because you deserve real
                  rest, not a suggestion you can click away.
                </p>
                <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                  We'll set things up in four quick steps.
                </p>
              </motion.div>
            )}

            {step === 'context' && (
              <motion.div
                key="context"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="pt-2"
              >
                <h1 className="text-2xl font-bold mb-2 text-center" style={{ color: 'var(--text-primary)' }}>Your break rhythm</h1>
                <p className="mb-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                  Set sensible defaults now — you can change everything later in Settings.
                </p>

                {/* Reason card */}
                <div className="rounded-xl border border-surf surf-1 p-4 mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div style={{ color: 'var(--text-muted)' }}>{ICONS.heart}</div>
                    <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Why are you using EyeShield? (optional)</span>
                  </div>
                  <textarea
                    value={reasonForUse}
                    onChange={(e) => setReasonForUse(e.target.value)}
                    placeholder="e.g., diagnosed dry-eye, doctor recommended 20-20-20…"
                    className="w-full bg-transparent border-b-2 focus:outline-none py-2 resize-none text-sm"
                    style={{ color: 'var(--text-primary)', borderColor: 'var(--surf-border)' }}
                    rows={2}
                  />
                </div>

                {/* Interval + Duration cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-surf surf-1">
                    <div style={{ color: 'var(--text-muted)' }}>{ICONS.clock}</div>
                    <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Work Interval</div>
                    <div className="flex items-baseline gap-1">
                      <input
                        type="number"
                        value={intervalMin}
                        min={1}
                        max={180}
                        onChange={(e) => setIntervalMin(Number(e.target.value))}
                        className="w-14 text-center text-2xl font-semibold bg-transparent border-b-2 focus:outline-none py-1 mono"
                        style={{ color: 'var(--text-primary)', borderColor: 'var(--surf-border)' }}
                      />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>min</span>
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Default 20 (20-20-20)</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-surf surf-1">
                    <div style={{ color: 'var(--text-muted)' }}>{ICONS.timer}</div>
                    <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Break Duration</div>
                    <div className="flex items-baseline gap-1">
                      <input
                        type="number"
                        value={breakDurationSec}
                        min={10}
                        max={600}
                        onChange={(e) => setBreakDurationSec(Number(e.target.value))}
                        className="w-14 text-center text-2xl font-semibold bg-transparent border-b-2 focus:outline-none py-1 mono"
                        style={{ color: 'var(--text-primary)', borderColor: 'var(--surf-border)' }}
                      />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>sec</span>
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Default 20s</span>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 'permissions' && (
              <motion.div
                key="permissions"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="pt-2"
              >
                <div className="flex flex-col items-center text-center mb-5">
                  <div className="w-16 h-16 rounded-2xl surf-2 flex items-center justify-center mb-3" style={{ color: 'var(--ion-purple)' }}>
                    {ICONS.shield}
                  </div>
                  <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Why EyeShield needs elevated access</h1>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Your safety and control come first</p>
                </div>

                <div className="space-y-2">
                  <StepCard icon={ICONS.lock} title="Screen lock">
                    Uses Windows' <span className="mono" style={{ color: 'var(--plasma)' }}>BlockInput</span> API to block all keyboard and mouse input system-wide during breaks — so you actually rest.
                  </StepCard>
                  <StepCard icon={ICONS.keyboard} title="Emergency override">
                    Press <span className="mono" style={{ color: 'var(--plasma)' }}>Esc 5×</span> rapidly to release a break early — but it's limited to a few uses per day, so you're nudged toward real rest rather than trapped.
                  </StepCard>
                  <StepCard icon={ICONS.shieldCheck} title="Antivirus notice">
                    Your antivirus may flag the keyboard hook. This is expected for any app that intercepts input at this level. The helper is open-source and does nothing besides BlockInput + the override listener.
                  </StepCard>
                </div>
              </motion.div>
            )}

            {step === 'autostart' && (
              <motion.div
                key="autostart"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="flex flex-col items-center justify-center h-full pt-4"
              >
                <div className="w-16 h-16 rounded-2xl surf-2 flex items-center justify-center mb-4" style={{ color: 'var(--text-muted)' }}>
                  {ICONS.power}
                </div>
                <h1 className="text-2xl font-bold mb-2 text-center" style={{ color: 'var(--text-primary)' }}>Run at login?</h1>
                <p className="mb-6 text-sm text-center max-w-xs" style={{ color: 'var(--text-muted)' }}>
                  EyeShield only works if it's running. We recommend enabling auto-start
                  so you don't have to remember to launch it each morning.
                </p>

                <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-surf surf-1 hover:surf-2 transition-colors w-full max-w-xs">
                  <div className="w-10 h-10 rounded-lg surf-2 flex items-center justify-center flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {ICONS.power}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Launch at login</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Start automatically when Windows boots</div>
                  </div>
                  <input type="checkbox" checked={autoStart} onChange={(e) => setAutoStart(e.target.checked)} className="peer sr-only" />
                <div className="w-11 h-6 rounded-full transition-colors relative peer-checked:bg-ion-purple" style={{ background: 'var(--surf-2)' }}>
                  <div className="absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
                </div>
              </label>
              </motion.div>
            )}

            {step === 'done' && (
              <motion.div
                key="done"
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="flex flex-col items-center text-center pt-6"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                  className="w-20 h-20 rounded-full bg-plasma/20 flex items-center justify-center mb-5 border-2 border-plasma"
                  style={{ color: 'var(--plasma)' }}
                >
                  {ICONS.check}
                </motion.div>
                <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>You're all set</h1>
                <p className="mb-4 text-sm leading-relaxed max-w-xs" style={{ color: 'var(--text-muted)' }}>
                  EyeShield will run in your system tray. Your first break is in
                  <span className="mono" style={{ color: 'var(--plasma)' }}> {intervalMin} minutes</span>.
                </p>
                <div className="flex items-center gap-2 p-3 rounded-xl border border-surf surf-1 max-w-xs">
                  <div style={{ color: 'var(--text-muted)' }}>{ICONS.sparkle}</div>
                  <p className="text-xs leading-relaxed text-left" style={{ color: 'var(--text-muted)' }}>
                    Remember the override: <span className="mono" style={{ color: 'var(--plasma)' }}>Esc 5×</span> — but try not to use it. It's capped a few times per day, and the point is real rest.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer — navigation */}
        <footer className="flex gap-2 pt-4 mt-2 border-t border-surf flex-shrink-0" data-no-drag>
          {step !== 'welcome' && (
            <button className="btn-ghost" onClick={() => setStep(step === 'context' ? 'welcome' : step === 'permissions' ? 'context' : step === 'autostart' ? 'permissions' : 'autostart')}>
              Back
            </button>
          )}
          {step !== 'done' && (
            <button className="btn-primary ml-auto" onClick={() => setStep(step === 'welcome' ? 'context' : step === 'context' ? 'permissions' : step === 'permissions' ? 'autostart' : 'done')}>
              {step === 'welcome' ? 'Begin' : 'Continue'}
            </button>
          )}
          {step === 'done' && (
            <button className="btn-primary ml-auto" onClick={finish}>
              Start protecting my eyes
            </button>
          )}
        </footer>
      </GlassPanel>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Onboarding />);
