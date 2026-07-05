import type { EyeBreakSettings } from '../../../shared/types';
import { ICONS as SHARED_ICONS } from '../../components/icons';

const ICONS = {
  ...SHARED_ICONS,
  snooze: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
    </svg>
  ),
  power: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
    </svg>
  ),
};

function StatCard({
  icon,
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-surf surf-1">
      <div style={{ color: 'var(--text-muted)' }}>{icon}</div>
      <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="flex items-baseline gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-16 text-center text-2xl font-semibold bg-transparent border-b-2 focus:outline-none py-1 mono"
          style={{ color: 'var(--text-primary)', borderColor: 'var(--surf-border)' }}
        />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{unit}</span>
      </div>
    </div>
  );
}

export function GeneralTab({
  settings, update,
}: {
  settings: EyeBreakSettings;
  update: (p: Partial<EyeBreakSettings>) => void;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-6">
      {/* Three stat cards in a row */}
      <div className="grid grid-cols-3 gap-3 w-full">
        <StatCard
          icon={ICONS.clock}
          label="Work Interval"
          value={settings.intervalMin}
          min={1}
          max={180}
          unit="min"
          onChange={(n) => update({ intervalMin: n })}
        />
        <StatCard
          icon={ICONS.timer}
          label="Break Duration"
          value={settings.breakDurationSec}
          min={10}
          max={600}
          unit="sec"
          onChange={(n) => update({ breakDurationSec: n })}
        />
        <StatCard
          icon={ICONS.snooze}
          label="Snooze Limit"
          value={settings.snoozeAllowance}
          min={0}
          max={20}
          unit="/day"
          onChange={(n) => update({ snoozeAllowance: n })}
        />
      </div>

      {/* Auto-start toggle */}
      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-surf surf-1 hover:surf-2 transition-colors w-full">
        <div className="w-10 h-10 rounded-lg surf-2 flex items-center justify-center flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          {ICONS.power}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Launch at login</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Start EyeShield automatically when Windows boots</div>
        </div>
        <input
          type="checkbox"
          checked={settings.autoStart}
          onChange={(e) => update({ autoStart: e.target.checked })}
          className="peer sr-only"
        />
        <div
          className="w-11 h-6 rounded-full transition-colors relative peer-checked:bg-ion-purple"
          style={{ background: 'var(--surf-2)' }}
        >
          <div className="absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
        </div>
      </label>
    </div>
  );
}
