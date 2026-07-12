using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace EyeBreakHelper;

/// <summary>
/// Native Windows input-block helper for EyeShield.
///
/// Responsibilities:
///   - BlockInput(TRUE/FALSE) on command from Electron
///   - WH_KEYBOARD_LL hook that survives BlockInput to detect the
///     Ctrl+Alt+Shift+Q 5-second-hold emergency override
///   - Heartbeat watchdog: if Electron goes silent for >5s while a block is
///     active, automatically BlockInput(FALSE) and exit lock state
///   - Track last-input timestamp for Electron's idle detection
///   - Emit "override" event back to Electron when the combo is held
///
/// Communication: line-delimited JSON on stdin/stdout.
///   Inbound:  {"type":"block"|"unblock"|"heartbeat"|"status","seq":"..."}
///   Outbound: {"ok":true,"status":"...","lastInputMs":N,"seq":"..."}
///             {"event":"override"}
/// </summary>
internal static class Program
{
    private const int HeartbeatTimeoutMs = 5000;
    private const ushort OverrideVkEsc = 0x1B; // VK_ESCAPE — emergency override
    private const int OverridePresses = 5; // press Esc 5x rapidly
    private const int OverrideWindowMs = 3000; // within 3 seconds

    private static DateTime _lastHeartbeat = DateTime.UtcNow;
    private static bool _isBlocking = false;
    private static DateTime _lastInputTime = DateTime.UtcNow;
    private static readonly object _lock = new();

    // Override tracking (Esc 5x rapid press)
    private static readonly List<DateTime> _escPressTimes = new();

    // Daily override cap. Electron sends overridesLeft with each block command;
    // the helper enforces the hard cap: once the daily allowance is exhausted,
    // Esc-5x is refused and the block stays until the break timer ends.
    private static int _overridesLeftToday = -1; // -1 = no cap (Electron not enforcing)
    private static string _overrideDate = DateTime.UtcNow.ToString("yyyy-MM-dd");

    private static int Main(string[] args)
    {
        if (args.Length == 0 || args[0] != "--stdio")
        {
            Console.Error.WriteLine("EyeBreakHelper — must be launched by EyeShield with --stdio");
            return 1;
        }

        // BlockInput requires the process to be running with the right session;
        // it does NOT require admin on the calling desktop session in most cases.
        // If it fails, we surface the error to Electron.

        // Start the keyboard hook BEFORE we ever block, so the override is
        // guaranteed to be armed whenever a block is active.
        KeyboardHook.Install(OnKeyEvent);

        // Start stdin reader on a background thread
        var readerThread = new Thread(ReadStdinLoop) { IsBackground = true };
        readerThread.Start();

        // Watchdog loop: 10Hz
        var watchdog = new Thread(WatchdogLoop) { IsBackground = true };
        watchdog.Start();

        // Keep main thread alive
        while (true)
        {
            Thread.Sleep(1000);
        }
    }

    private static void WatchdogLoop()
    {
        while (true)
        {
            Thread.Sleep(200);
            lock (_lock)
            {
                if (_isBlocking)
                {
                    var sinceHeartbeat = (DateTime.UtcNow - _lastHeartbeat).TotalMilliseconds;
                    if (sinceHeartbeat > HeartbeatTimeoutMs)
                    {
                        Console.Error.WriteLine($"[helper] heartbeat lost ({sinceHeartbeat}ms) — auto-unblocking");
                        ReleaseBlockInternal();
                        continue;
                    }
                }
            }
        }
    }

    private static void ReadStdinLoop()
    {
        var stdin = Console.OpenStandardInput();
        var sr = new StreamReader(stdin);
        string? line;
        while ((line = sr.ReadLine()) != null)
        {
            line = line.Trim();
            if (string.IsNullOrEmpty(line)) continue;
            try
            {
                using var doc = JsonDocument.Parse(line);
                var root = doc.RootElement;
                var type = root.GetProperty("type").GetString();
                var seq = root.TryGetProperty("seq", out var sEl) ? sEl.GetString() : null;

                _lastHeartbeat = DateTime.UtcNow; // any message counts as heartbeat

                switch (type)
                {
                    case "block":
                        // overridesLeft: how many emergency overrides remain today
                        // (persisted by Electron; rolled over at midnight). -1/absent
                        // means "no cap" (back-compat / Electron not enforcing).
                        int overridesLeft = -1;
                        if (root.TryGetProperty("overridesLeft", out var olEl) && olEl.TryGetInt32(out var ol))
                        {
                            overridesLeft = ol;
                        }
                        AcquireBlock(seq, overridesLeft);
                        break;
                    case "unblock":
                        ReleaseBlockInternal();
                        ReplyOk(seq);
                        break;
                    case "heartbeat":
                        ReplyOk(seq);
                        break;
                    case "status":
                        ReplyOk(seq, _isBlocking ? "blocking" : "idle");
                        break;
                    default:
                        ReplyError(seq, $"unknown type: {type}");
                        break;
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[helper] parse error: {ex.Message}");
            }
        }

        // stdin closed → Electron died → release and exit
        lock (_lock)
        {
            if (_isBlocking) ReleaseBlockInternal();
        }
        Environment.Exit(0);
    }

    private static void AcquireBlock(string? seq, int overridesLeft)
    {
        lock (_lock)
        {
            // The keyboard is blocked by the WH_KEYBOARD_LL hook (see OnKeyEvent),
            // NOT by BlockInput — BlockInput returns ACCESS_DENIED (error 5) in
            // this process/session, so relying on it left the block failing AND
            // gated the override behind a flag (_isBlocking) that could never
            // become true. We now set _isBlocking unconditionally and let the
            // hook swallow keys.
            //
            // BlockInput is still attempted as best-effort for the mouse — if it
            // succeeds, the cursor is also frozen; if it fails (likely error 5),
            // the fullscreen overlay window covers the mouse visually.
            var ok = NativeMethods.BlockInput(true);
            if (!ok)
            {
                int err = Marshal.GetLastWin32Error();
                Console.Error.WriteLine($"[helper] BlockInput(TRUE) best-effort FAILED (GetLastError={err}) — keyboard still blocked via hook; mouse falls back to overlay");
            }
            // Roll over the daily override counter at UTC midnight. Electron is
            // the source of truth for the cap (it persists across restarts and
            // knows the local timezone); the helper just enforces whatever
            // overridesLeft it was told for the current day.
            var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
            if (today != _overrideDate)
            {
                _overrideDate = today;
            }
            _overridesLeftToday = overridesLeft;
            _isBlocking = true;
            _escPressTimes.Clear();
            _lastHeartbeat = DateTime.UtcNow;
            ReplyOk(seq, "blocking");
        }
    }

    private static void ReleaseBlockInternal()
    {
        lock (_lock)
        {
            try
            {
                NativeMethods.BlockInput(false);
            }
            catch { /* ignore */ }
            _isBlocking = false;
            _escPressTimes.Clear();
        }
    }

    /// <summary>
    /// Returns true if the key should be SWALLOWED (not forwarded to the
    /// system / next hook). During a block we swallow EVERYTHING so the
    /// keyboard is effectively locked — except we still observe the override
    /// combo and Esc-5x to release. Outside a block we swallow nothing.
    /// </summary>
    private static bool OnKeyEvent(int vk, bool down)
    {
        lock (_lock)
        {
            // Track last-input regardless of block state
            _lastInputTime = DateTime.UtcNow;

            if (!_isBlocking)
            {
                return false; // not blocking → never swallow
            }

            // ── Override: press Esc 5 times rapidly (within 3s) ──
            if (vk == OverrideVkEsc && down)
            {
                var now = DateTime.UtcNow;
                _escPressTimes.Add(now);
                _escPressTimes.RemoveAll(t => (now - t).TotalMilliseconds > OverrideWindowMs);
                if (_escPressTimes.Count >= OverridePresses)
                {
                    _escPressTimes.Clear();
                    // Enforce the daily cap. Electron sent overridesLeft with the
                    // block command; once exhausted, the override is refused and
                    // the block stays until the break timer ends. -1 = no cap.
                    if (_overridesLeftToday == 0)
                    {
                        Console.Error.WriteLine("[helper] override DENIED — daily override cap reached; block stays");
                        EmitOverrideDenied();
                    }
                    else
                    {
                        if (_overridesLeftToday > 0) _overridesLeftToday--;
                        EmitOverride();
                        ReleaseBlockInternal();
                    }
                }
            }

            // While blocking, swallow every key. The override keys are still
            // observed above (we track state ourselves), so swallowing them
            // doesn't blind us.
            return true;
        }
    }

    private static void ReplyOk(string? seq, string status = "ok")
    {
        int idleMs;
        lock (_lock)
        {
            idleMs = (int)(DateTime.UtcNow - _lastInputTime).TotalMilliseconds;
        }
        var obj = new { ok = true, status, lastInputMs = idleMs, seq };
        Console.Out.WriteLine(JsonSerializer.Serialize(obj));
        Console.Out.Flush();
    }

    private static void ReplyError(string? seq, string error)
    {
        var obj = new { ok = false, error, seq };
        Console.Out.WriteLine(JsonSerializer.Serialize(obj));
        Console.Out.Flush();
    }

    private static void EmitOverride()
    {
        var obj = new { @event = "override" };
        Console.Out.WriteLine(JsonSerializer.Serialize(obj));
        Console.Out.Flush();
    }

    /// <summary>
    /// Emitted when the user hit the Esc-5x combo but the daily override cap was
    /// already exhausted. The block is NOT released. Electron logs this as an
    /// accountability incident (the user tried to escape a forced break).
    /// </summary>
    private static void EmitOverrideDenied()
    {
        var obj = new { @event = "override-denied", reason = "daily-cap" };
        Console.Out.WriteLine(JsonSerializer.Serialize(obj));
        Console.Out.Flush();
    }
}
