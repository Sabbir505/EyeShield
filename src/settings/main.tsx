import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GlassPanel } from '../components/GlassPanel';
import { useTheme } from '../components/useTheme';
import { GeneralTab } from './tabs/GeneralTab';
import { ScheduleTab } from './tabs/ScheduleTab';
import { SoundTab } from './tabs/SoundTab';
import { ThemeTab } from './tabs/ThemeTab';
import { StatsTab } from './tabs/StatsTab';
import '../types/global';
import type { EyeBreakSettings, StatsPayload } from '../../shared/types';
import '../styles/index.css';

type Tab = 'general' | 'schedule' | 'sound' | 'theme' | 'stats';
const TABS: Tab[] = ['general', 'schedule', 'sound', 'theme', 'stats'];

function Settings() {
  const [tab, setTab] = useState<Tab>('general');
  const [settings, setSettings] = useState<EyeBreakSettings | null>(null);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [statsRange, setStatsRange] = useState<'day' | 'week'>('week');

  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!window.eyeshield) {
      setErr('window.eyeshield API not exposed (preload failed)');
      return;
    }
    window.eyeshield.settings.get().then(setSettings).catch((e) => {
      console.error('[settings] settings.get failed:', e);
      setErr(String(e?.message ?? e));
    });
  }, []);

  useTheme(settings?.theme);

  useEffect(() => {
    if (!settings || !window.eyeshield) return;
    window.eyeshield.stats.get(statsRange).then(setStats).catch((e) => {
      console.error('[settings] stats.get failed:', e);
    });
  }, [statsRange, settings]);

  const update = async (patch: Partial<EyeBreakSettings>) => {
    await window.eyeshield.settings.set(patch);
    setSettings((prev) => prev ? { ...prev, ...patch } : prev);
  };

  if (err) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-6 text-white">
        <div className="max-w-md p-6 rounded-xl bg-red-900/40 border border-red-500/40">
          <h1 className="text-lg font-semibold mb-2">Settings failed to load</h1>
          <pre className="text-xs whitespace-pre-wrap">{err}</pre>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-6" style={{ color: 'var(--text-muted)' }}>
        Loading settings…
      </div>
    );
  }

  return (
    <div className="w-[560px] h-[560px] flex items-center justify-center overflow-hidden bg-transparent rounded-window-mask">
      <GlassPanel
        className="w-[560px] h-[560px] flex flex-col overflow-hidden [&::before]:hidden light-glass glass-panel-flat rounded-glass"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Header (draggable) — title + tabs + close */}
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-surf flex-shrink-0">
          <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>EyeShield</h1>
          <div className="flex items-center gap-1.5">
            <nav className="flex gap-0.5 text-xs">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                    tab === t ? 'surf-3' : 'hover:surf-2'
                  }`}
                  style={{ color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  {t}
                </button>
              ))}
            </nav>
            <button
              onClick={() => window.eyeshield.settings.close()}
              className="ml-1 w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors hover:surf-2"
              style={{ color: 'var(--text-muted)' }}
              title="Close"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Content — scrollable tab body */}
        <main className="overflow-y-auto scrollbar-hide px-5 py-4 flex-1" data-no-drag>
          {tab === 'general' && <GeneralTab settings={settings} update={update} />}
          {tab === 'schedule' && <ScheduleTab settings={settings} update={update} />}
          {tab === 'sound' && <SoundTab settings={settings} update={update} />}
          {tab === 'theme' && <ThemeTab settings={settings} update={update} />}
          {tab === 'stats' && stats && (
            <StatsTab stats={stats} range={statsRange} onRange={setStatsRange} />
          )}
        </main>
      </GlassPanel>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Settings />);
