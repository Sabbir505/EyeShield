/**
 * IPC channel name constants — single source of truth.
 * Used by main.ts (handlers), preload.ts (invokes), and global.ts (types).
 */
export const IPC = {
  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_CLOSE: 'settings:close',
  // Stats
  STATS_GET: 'stats:get',
  STATS_EXPORT: 'stats:export',
  // Schedule
  SCHEDULE_PAUSE: 'schedule:pause',
  SCHEDULE_RESUME: 'schedule:resume',
  SCHEDULE_SNOOZE: 'schedule:snooze',
  SCHEDULE_STATE: 'schedule:state',
  // Onboarding
  ONBOARDING_COMPLETE: 'onboarding:complete',
  // Overlay (main→renderer)
  OVERLAY_COUNTDOWN: 'overlay:countdown',
  OVERLAY_SETTINGS: 'overlay:settings',
} as const;
