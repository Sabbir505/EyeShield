import { useState } from 'react';
import type { EyeBreakSettings } from '../../../shared/types';
import { ICONS as SHARED_ICONS } from '../../components/icons';

type ScheduleRule = EyeBreakSettings['scheduleRules'][number];

const ICONS = {
  ...SHARED_ICONS,
  arrowRight: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  trash: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  plus: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
};

function formatHour(h: number) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour} ${ampm}`;
}

function RuleCard({
  rule,
  index,
  onChange,
  onRemove,
}: {
  rule: ScheduleRule;
  index: number;
  onChange: (i: number, next: ScheduleRule) => void;
  onRemove: (i: number) => void;
}) {
  const [editing, setEditing] = useState<'from' | 'to' | 'interval' | null>(null);

  return (
    <div className="rounded-xl border border-surf surf-1 p-4 transition-colors hover:surf-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div style={{ color: 'var(--text-muted)' }}>{ICONS.clock}</div>
          <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Rule {index + 1}</span>
        </div>
        <button
          className="p-1.5 rounded-lg surf-2 hover:bg-white/10 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onClick={() => onRemove(index)}
          title="Remove rule"
        >
          {ICONS.trash}
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        {/* From */}
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>From</div>
          {editing === 'from' ? (
            <input
              type="number"
              value={rule.fromHour}
              min={0}
              max={23}
              autoFocus
              onBlur={() => setEditing(null)}
              onKeyDown={(e) => e.key === 'Enter' && setEditing(null)}
              onChange={(e) => onChange(index, { ...rule, fromHour: Number(e.target.value) })}
              className="w-full text-center text-xl font-semibold bg-transparent border-b-2 focus:outline-none py-1 mono"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--surf-border)' }}
            />
          ) : (
            <button
              onClick={() => setEditing('from')}
              className="w-full text-left text-xl font-semibold mono"
              style={{ color: 'var(--text-primary)' }}
            >
              {formatHour(rule.fromHour)}
            </button>
          )}
        </div>

        <div style={{ color: 'var(--text-muted)' }}>{ICONS.arrowRight}</div>

        {/* To */}
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>To</div>
          {editing === 'to' ? (
            <input
              type="number"
              value={rule.toHour}
              min={0}
              max={23}
              autoFocus
              onBlur={() => setEditing(null)}
              onKeyDown={(e) => e.key === 'Enter' && setEditing(null)}
              onChange={(e) => onChange(index, { ...rule, toHour: Number(e.target.value) })}
              className="w-full text-center text-xl font-semibold bg-transparent border-b-2 focus:outline-none py-1 mono"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--surf-border)' }}
            />
          ) : (
            <button
              onClick={() => setEditing('to')}
              className="w-full text-left text-xl font-semibold mono"
              style={{ color: 'var(--text-primary)' }}
            >
              {formatHour(rule.toHour)}
            </button>
          )}
        </div>
      </div>

      {/* Interval */}
      <div className="flex items-center gap-2 p-2 rounded-lg surf-2">
        <div style={{ color: 'var(--text-muted)' }}>{ICONS.timer}</div>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Interval</div>
          {editing === 'interval' ? (
            <input
              type="number"
              value={rule.intervalMin}
              min={1}
              max={180}
              autoFocus
              onBlur={() => setEditing(null)}
              onKeyDown={(e) => e.key === 'Enter' && setEditing(null)}
              onChange={(e) => onChange(index, { ...rule, intervalMin: Number(e.target.value) })}
              className="w-full bg-transparent border-b-2 focus:outline-none py-0.5 mono text-sm"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--surf-border)' }}
            />
          ) : (
            <button
              onClick={() => setEditing('interval')}
              className="w-full text-left mono text-sm"
              style={{ color: 'var(--text-primary)' }}
            >
              {rule.intervalMin} min
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ScheduleTab({
  settings, update,
}: {
  settings: EyeBreakSettings;
  update: (p: Partial<EyeBreakSettings>) => void;
}) {
  const rules = settings.scheduleRules ?? [];

  const handleChange = (i: number, next: ScheduleRule) => {
    const updated = [...rules];
    updated[i] = next;
    update({ scheduleRules: updated });
  };

  const handleRemove = (i: number) => {
    update({ scheduleRules: rules.filter((_, j) => j !== i) });
  };

  const handleAdd = () => {
    update({
      scheduleRules: [
        ...rules,
        { fromHour: 13, toHour: 17, intervalMin: 15, breakDurationSec: 60 },
      ],
    });
  };

  return (
    <div className="h-full flex flex-col items-center justify-center">
      <p className="text-sm mb-5 leading-relaxed text-center max-w-sm" style={{ color: 'var(--text-muted)' }}>
        Override the default interval for specific times of day. Useful for longer afternoon breaks when eye strain peaks.
      </p>

      <div className="w-full max-w-sm space-y-3">
        {rules.map((r, i) => (
          <RuleCard
            key={`${r.fromHour}-${r.toHour}-${i}`}
            rule={r}
            index={i}
            onChange={handleChange}
            onRemove={handleRemove}
          />
        ))}

        <button
          onClick={handleAdd}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-surf surf-1 hover:surf-2 transition-colors"
        >
          <div style={{ color: 'var(--text-muted)' }}>{ICONS.plus}</div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Add time-of-day rule</span>
        </button>
      </div>
    </div>
  );
}
