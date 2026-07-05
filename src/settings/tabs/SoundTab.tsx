import { useRef, useCallback, useState } from 'react';
import type { EyeBreakSettings, AmbientSound } from '../../../shared/types';
import { SOURCES } from '../../components/sound-sources';

const PREVIEW_DURATION_MS = 3000;

const SOUNDS = [
  { id: 'none' as const, label: 'None', desc: 'Silent breaks. Just the visual overlay.' },
  { id: 'rain' as const, label: 'Rain', desc: 'Gentle downpour loop. Cozy and immersive.' },
  { id: 'whitenoise' as const, label: 'White Noise', desc: 'Soft underwater hum. Blocks distractions.' },
  { id: 'waves' as const, label: 'Waves', desc: 'Windy sea shore. Rhythmic and meditative.' },
];

const ICONS = {
  mute: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
    </svg>
  ),
  rain: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="16" y1="13" x2="16" y2="21"/><line x1="8" y1="13" x2="8" y2="21"/><line x1="12" y1="15" x2="12" y2="23"/><line x1="20" y1="16" x2="20" y2="21"/><line x1="4" y1="16" x2="4" y2="21"/><path d="M16 7a4 4 0 0 0-8 0 4 4 0 0 0-4 4 2 2 0 0 0 2 2h12a2 2 0 0 0 2-2 4 4 0 0 0-4-4z"/>
    </svg>
  ),
  speaker: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  ),
  waves: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0 4 2 6 0"/><path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0 4 2 6 0"/>
    </svg>
  ),
  volume: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  ),
};

const SOUND_ICONS: Record<string, React.ReactNode> = {
  none: ICONS.mute,
  rain: ICONS.rain,
  whitenoise: ICONS.speaker,
  waves: ICONS.waves,
};

function WaveformIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="flex items-center gap-0.5 h-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="w-0.5 rounded-full bg-plasma animate-pulse"
          style={{
            height: `${Math.max(4, Math.sin((Date.now() / 200) + i) * 8 + 8)}px`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

export function SoundTab({
  settings, update,
}: {
  settings: EyeBreakSettings;
  update: (p: Partial<EyeBreakSettings>) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewing, setPreviewing] = useState<AmbientSound | null>(null);

  const stopPreview = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setPreviewing(null);
  }, []);

  const playPreview = useCallback((sound: AmbientSound) => {
    stopPreview();
    if (sound === 'none') return;

    const audio = new Audio(SOURCES[sound]);
    audio.loop = true;
    audio.volume = 0.4;
    audioRef.current = audio;

    audio.play().catch(() => {});
    setPreviewing(sound);

    timeoutRef.current = setTimeout(() => {
      stopPreview();
    }, PREVIEW_DURATION_MS);
  }, [stopPreview]);

  const handleSelect = (sound: AmbientSound) => {
    update({ ambientSound: sound });
    playPreview(sound);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center">
      {/* Toggle */}
      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-surf surf-1 hover:surf-2 transition-colors w-full max-w-sm mb-4">
        <div className="w-10 h-10 rounded-lg surf-2 flex items-center justify-center flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          {ICONS.volume}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Play ambient sound during breaks</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Background audio for your eye breaks</div>
        </div>
        <input
          type="checkbox"
          checked={settings.soundOn}
          onChange={(e) => update({ soundOn: e.target.checked })}
          className="sr-only peer"
        />
        <div
          className="w-11 h-6 rounded-full transition-colors relative peer-checked:bg-ion-purple"
          style={{ background: settings.soundOn ? undefined : 'var(--surf-2)' }}
        >
          <div
            className="absolute top-[2px] h-5 w-5 rounded-full bg-white transition-transform"
            style={{ left: settings.soundOn ? '22px' : '2px' }}
          />
        </div>
      </label>

      <p className="text-sm mb-3 leading-relaxed text-center max-w-sm" style={{ color: 'var(--text-muted)' }}>
        Choose the ambient sound played during eye breaks. Click a sound to preview it.
      </p>

      <div className="w-full max-w-sm space-y-2">
        {SOUNDS.map((s) => {
          const active = settings.ambientSound === s.id;
          const isPreviewing = previewing === s.id;
          return (
            <button
              key={s.id}
              onClick={() => handleSelect(s.id)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                active
                  ? 'border-surf-strong surf-3'
                  : 'border-surf surf-1 hover:border-surf-strong hover:surf-2'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg surf-2 flex items-center justify-center flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {SOUND_ICONS[s.id]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{s.label}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.desc}</div>
                </div>
                {isPreviewing && (
                  <div className="flex items-center gap-1.5">
                    <WaveformIndicator active={true} />
                    <span className="text-xs px-2 py-0.5 rounded-full surf-2" style={{ color: 'var(--text-muted)' }}>
                      Previewing
                    </span>
                  </div>
                )}
                {active && !isPreviewing && (
                  <div className="w-2 h-2 rounded-full bg-plasma" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
        Sounds are bundled with EyeShield (CC0/Mixkit). Preview plays for 3 seconds.
      </p>
    </div>
  );
}
