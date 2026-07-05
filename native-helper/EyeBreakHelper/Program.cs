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
    private const int OverrideHoldMs = 5000;
    private const ushort OverrideVkQ = 0x51; // 'Q'
    private const ushort OverrideVkCtrl = 0x11;
    private const ushort OverrideVkAlt = 0x12;
    private const ushort OverrideVkShift = 0x10;
    private const ushort OverrideVkEsc = 0x1B; // VK_ESCAPE — secondary override
    private const int SecondaryOverridePresses = 5; // press Esc 5x rapidly
    private const int SecondaryOverrideWindowMs = 3000; // within 3 seconds

    private static DateTime _lastHeartbeat = DateTime.UtcNow;
    private static bool _isBlocking = false;
    private static DateTime _lastInputTime = DateTime.UtcNow;
    private static readonly object _lock = new();

    // Override key-hold tracking (primary: Ctrl+Alt+Shift+Q 5s hold)
    private static DateTime? _overrideHoldStart = null;

    // Secondary override tracking (Esc 5x rapid press)
    private static readonly List<DateTime> _escPressTimes = new();

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
                        AcquireBlock(seq);
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

    private static void AcquireBlock(string? seq)
    {
        lock (_lock)
        {
            var ok = NativeMethods.BlockInput(true);
            if (!ok)
            {
                ReplyError(seq, "BlockInput(TRUE) failed — may require same-session active desktop");
                return;
            }
            _isBlocking = true;
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
            _overrideHoldStart = null; // reset override progress on unblock
        }
    }

    private static void OnKeyEvent(int vk, bool down)
    {
        lock (_lock)
        {
            // Track last-input regardless
            _lastInputTime = DateTime.UtcNow;

            if (!_isBlocking) return;

            // ── Primary override: Ctrl+Alt+Shift+Q held for 5 seconds ──
            bool ctrl = (NativeMethods.GetAsyncKeyState(OverrideVkCtrl) & 0x8000) != 0;
            bool alt = (NativeMethods.GetAsyncKeyState(OverrideVkAlt) & 0x8000) != 0;
            bool shift = (NativeMethods.GetAsyncKeyState(OverrideVkShift) & 0x8000) != 0;
            bool qDown = (NativeMethods.GetAsyncKeyState(OverrideVkQ) & 0x8000) != 0;

            if (ctrl && alt && shift && qDown)
            {
                if (_overrideHoldStart == null)
                {
                    _overrideHoldStart = DateTime.UtcNow;
                }
                else
                {
                    var held = (DateTime.UtcNow - _overrideHoldStart.Value).TotalMilliseconds;
                    if (held >= OverrideHoldMs)
                    {
                        // Trigger!
                        EmitOverride();
                        ReleaseBlockInternal();
                        _overrideHoldStart = null;
                        return;
                    }
                }
            }
            else
            {
                _overrideHoldStart = null; // released too early → restart
            }

            // ── Secondary override: press Esc 5 times rapidly (within 3s) ──
            if (vk == OverrideVkEsc && down)
            {
                var now = DateTime.UtcNow;
                _escPressTimes.Add(now);
                _escPressTimes.RemoveAll(t => (now - t).TotalMilliseconds > SecondaryOverrideWindowMs);
                if (_escPressTimes.Count >= SecondaryOverridePresses)
                {
                    EmitOverride();
                    ReleaseBlockInternal();
                    _escPressTimes.Clear();
                }
            }
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
}
