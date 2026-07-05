using System;
using System.Runtime.InteropServices;
using System.Threading;

namespace EyeBreakHelper;

internal static partial class NativeMethods
{
    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool BlockInput([MarshalAs(UnmanagedType.Bool)] bool blockIt);

    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    public static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr GetModuleHandle(string lpModuleName);

    public const int WH_KEYBOARD_LL = 13;
    public const int WM_KEYDOWN = 0x0100;
    public const int WM_KEYUP = 0x0101;
    public const int WM_SYSKEYDOWN = 0x0104;
    public const int WM_SYSKEYUP = 0x0105;

    public delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);
}

/// <summary>
/// Global low-level keyboard hook. Runs in our process but receives every
/// keystroke system-wide, including during BlockInput (low-level hooks fire
/// before BlockInput's filter in practice). Used solely for the emergency
/// override combo — we don't swallow any keys here, just observe.
/// </summary>
internal static class KeyboardHook
{
    private static NativeMethods.LowLevelKeyboardProc? _proc;
    private static IntPtr _hook = IntPtr.Zero;
    private static Action<int, bool>? _onKey;
    private static Thread? _messagePump;

    public static void Install(Action<int, bool> onKey)
    {
        _onKey = onKey;
        _proc = HookCallback;
        // The hook must have a message pump on the installing thread.
        // We run that pump on a dedicated thread so the main thread can do
        // stdin reading + watchdog work.
        _messagePump = new Thread(MessagePumpLoop) { IsBackground = true };
        _messagePump.Start();
    }

    private static void MessagePumpLoop()
    {
        using var process = System.Diagnostics.Process.GetCurrentProcess();
        using var module = process.MainModule!;
        var hMod = NativeMethods.GetModuleHandle(module.ModuleName!);
        _hook = NativeMethods.SetWindowsHookEx(NativeMethods.WH_KEYBOARD_LL, _proc!, hMod, 0);

        // Standard message pump — required for low-level hooks to fire
        NativeMessage msg;
        while (NativeMethods.GetMessage(out msg, IntPtr.Zero, 0, 0) > 0)
        {
            NativeMethods.TranslateMessage(ref msg);
            NativeMethods.DispatchMessage(ref msg);
        }

        // Clean up the hook on message pump exit (defensive — normally the
        // process exits without this, but Windows cleans up on process exit).
        if (_hook != IntPtr.Zero)
        {
            NativeMethods.UnhookWindowsHookEx(_hook);
            _hook = IntPtr.Zero;
        }
    }

    private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0 && _onKey != null)
        {
            int vk = Marshal.ReadInt32(lParam);
            int msg = wParam.ToInt32();
            bool down = msg == NativeMethods.WM_KEYDOWN || msg == NativeMethods.WM_SYSKEYDOWN;
            bool up = msg == NativeMethods.WM_KEYUP || msg == NativeMethods.WM_SYSKEYUP;
            if (down || up)
            {
                _onKey(vk, down);
            }
        }
        return NativeMethods.CallNextHookEx(_hook, nCode, wParam, lParam);
    }
}

[StructLayout(LayoutKind.Sequential)]
internal struct NativeMessage
{
    public IntPtr hWnd;
    public uint message;
    public IntPtr wParam;
    public IntPtr lParam;
    public uint time;
    public Point pt;
}

[StructLayout(LayoutKind.Sequential)]
internal struct Point
{
    public int X;
    public int Y;
}

internal static partial class NativeMethods
{
    [DllImport("user32.dll")]
    public static extern int GetMessage(out NativeMessage lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

    [DllImport("user32.dll")]
    public static extern bool TranslateMessage(ref NativeMessage lpMsg);

    [DllImport("user32.dll")]
    public static extern IntPtr DispatchMessage(ref NativeMessage lpMsg);
}
