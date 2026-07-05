import type { StatsPayload } from '../../../shared/types';

const ICONS = {
  trophy: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
  ),
  checkCircle: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  activity: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  check: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  alert: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  download: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  calendar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  week: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="8" y2="18"/><line x1="12" y1="18" x2="12" y2="18"/><line x1="16" y1="18" x2="16" y2="18"/>
    </svg>
  ),
  incident: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
};

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: 'plasma' | 'ion-purple';
}) {
  const accentColor = accent === 'plasma' ? 'var(--plasma)' : accent === 'ion-purple' ? 'var(--ion-purple)' : 'var(--text-primary)';
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-surf surf-1">
      <div style={{ color: 'var(--text-muted)' }}>{icon}</div>
      <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-3xl font-bold mono" style={{ color: accentColor }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

export function StatsTab({
  stats, range, onRange,
}: {
  stats: StatsPayload;
  range: 'day' | 'week';
  onRange: (r: 'day' | 'week') => void;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      {/* Segmented control + export */}
      <div className="flex items-center gap-2 mb-5 w-full max-w-md">
        <div className="flex rounded-lg border border-surf surf-1 p-0.5">
          {(['day', 'week'] as const).map((r) => (
            <button
              key={r}
              onClick={() => onRange(r)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                range === r
                  ? 'surf-3 border border-surf-strong'
                  : 'hover:surf-2'
              }`}
              style={{ color: range === r ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              {r === 'day' ? ICONS.calendar : ICONS.week}
              {r === 'day' ? 'Last 24h' : 'Last 7 days'}
            </button>
          ))}
        </div>
        <button
          className="ml-auto p-2 rounded-lg surf-1 border border-surf hover:surf-2 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onClick={() => window.eyeshield.stats.export().then((csv: string) => {
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `eyeshield-stats-${new Date().toISOString().slice(0,10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          })}
          title="Export CSV"
        >
          {ICONS.download}
        </button>
      </div>

      <div className="w-full max-w-md space-y-3">
        {/* Main stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={ICONS.checkCircle}
            label="Compliance"
            value={`${stats.compliancePct}%`}
            sub={stats.compliancePct >= 80 ? 'Great!' : stats.compliancePct >= 50 ? 'Keep going' : 'Needs work'}
          />
          <StatCard
            icon={ICONS.trophy}
            label="Streak"
            value={`${stats.streak}d`}
            sub={stats.streak > 0 ? 'On fire' : 'Start today'}
          />
          <StatCard
            icon={ICONS.activity}
            label="Breaks"
            value={String(stats.total)}
          />
        </div>

        {/* Secondary stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={ICONS.check}
            label="Completed"
            value={String(stats.completed)}
            accent="plasma"
          />
          <StatCard
            icon={ICONS.alert}
            label="Overridden"
            value={String(stats.overridden)}
            accent="ion-purple"
          />
        </div>

        {/* Incidents */}
        <div className="rounded-xl border border-surf surf-1 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div style={{ color: 'var(--text-muted)' }}>{ICONS.incident}</div>
            <h3 className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Incidents</h3>
          </div>
          {stats.incidents.length === 0 ? (
            <p className="text-sm text-center py-2" style={{ color: 'var(--text-muted)' }}>No incidents in this range.</p>
          ) : (
            <ul className="space-y-0">
              {stats.incidents.map((i, idx) => (
                <li
                  key={idx}
                  className={`flex items-center gap-3 py-2 text-sm mono ${
                    idx < stats.incidents.length - 1 ? 'border-b border-surf' : ''
                  }`}
                >
                  <span className="flex-shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(i.at).toLocaleString()}
                  </span>
                  <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-xs surf-2" style={{ color: 'var(--plasma)' }}>
                    {i.type}
                  </span>
                  <span className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{i.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
