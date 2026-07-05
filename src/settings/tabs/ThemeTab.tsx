import type { EyeBreakSettings } from '../../../shared/types';

const THEMES = [
  { id: 'void' as const, label: 'Void', desc: 'Deep dark. Ion purple + plasma cyan. The classic Liquid Glass look.' },
  { id: 'aurora' as const, label: 'Aurora', desc: 'Midnight blue. Cool teal + magenta plasma. Cosmic, meditative.' },
  { id: 'dawn' as const, label: 'Dawn', desc: 'Warm cream. Peach + sky blue. Light, airy, Apple-like.' },
];

const THEME_COLORS: Record<string, string[]> = {
  void:   ['#08080C', '#7C6FF7', '#00D4AA'],
  aurora: ['#050B1F', '#4DD0E1', '#FF5DA2'],
  dawn:   ['#FBF7F4', '#FF8A65', '#4FC3F7'],
};

const ICONS = {
  check: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
};

export function ThemeTab({
  settings, update,
}: {
  settings: EyeBreakSettings;
  update: (p: Partial<EyeBreakSettings>) => void;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <p className="text-sm mb-6 leading-relaxed text-center max-w-sm" style={{ color: 'var(--text-muted)' }}>
        Themes control the color palette across the break overlay, settings, and onboarding screens.
      </p>

      <div className="w-full max-w-sm space-y-3">
        {THEMES.map((t) => {
          const active = settings.theme === t.id;
          const colors = THEME_COLORS[t.id];
          return (
            <button
              key={t.id}
              onClick={() => update({ theme: t.id })}
              className={`w-full text-left rounded-xl border transition-all overflow-hidden ${
                active
                  ? 'border-surf-strong surf-3'
                  : 'border-surf surf-1 hover:border-surf-strong hover:surf-2'
              }`}
            >
              {/* Full-width color preview strip */}
              <div className="flex h-3 w-full">
                {colors.map((c, i) => (
                  <div key={i} className="flex-1" style={{ background: c }} />
                ))}
              </div>

              <div className="p-4 flex items-center gap-4">
                {/* Selected indicator */}
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    active ? 'border-plasma bg-plasma/20' : 'border-surf'
                  }`}
                >
                  {active && <div style={{ color: 'var(--plasma)' }}>{ICONS.check}</div>}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>{t.label}</div>
                  <div className="text-xs leading-relaxed mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.desc}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
