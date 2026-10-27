"use client";

import {
 createContext,
 useCallback,
 useContext,
 useEffect,
 useMemo,
 useState,
 type ReactNode,
} from "react";
import { readStorage, writeStorage } from "@/web/lib/storage";

export type ThemeMode ="light" |"dark" |"system";

/** 预设强调色：给用户几个近似 Misskey 配色直觉的选项 */
export interface AccentPreset {
 hue: number;
 key: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
 { hue: 210, key:"blue" },
 { hue: 265, key:"purple" },
 { hue: 330, key:"pink" },
 { hue: 165, key:"teal" },
 { hue: 25, key:"orange" },
 { hue: 355, key:"red" },
];

const STORAGE_KEY ="theme";

export interface ThemeSettings {
 mode: ThemeMode;
 accentHue: number;
}

const DEFAULT_SETTINGS: ThemeSettings = { mode:"system", accentHue: 210 };

interface ThemeValue extends ThemeSettings {
 /** 实际生效的主题（system 已解析成具体值） */
 resolvedMode:"light" |"dark";
 /** 是否已完成首屏读取（避免设置面板闪一下默认值） */
 ready: boolean;
 setMode: (mode: ThemeMode) => void;
 setAccentHue: (hue: number) => void;
 reset: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function prefersDark(): boolean {
 if (typeof window ==="undefined") return false;
 return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** 把设置写到 <html> 上，CSS 变量据此生效 */
export function applyTheme({ mode, accentHue }: ThemeSettings):"light" |"dark" {
 const root = document.documentElement;
 const resolved:"light" |"dark" = mode ==="system" ? (prefersDark() ?"dark" :"light") : mode;
 root.dataset.theme = resolved;
 root.dataset.themeMode = mode;
 root.style.setProperty("--accent-hue", String(accentHue));

 // 派生色相：不是简单加减角度，而是围绕强调色取「相邻色」，
 // 保证无论主色是什么，辅助色都落在邻近色域里，不会跳到绿色这类冲突色。
 // magic 取主色 -28°，sakura 取主色 +32°，cool 取主色 -14°。
 const wrap = (h: number) => ((h % 360) + 360) % 360;
 root.style.setProperty("--magic-hue", String(wrap(accentHue - 28)));
 root.style.setProperty("--magic-hue-deep", String(wrap(accentHue - 22)));
 root.style.setProperty("--sakura-hue", String(wrap(accentHue + 32)));
 root.style.setProperty("--cool-hue", String(wrap(accentHue - 14)));
 return resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
 // 首屏值由 layout 里的阻塞脚本写好（见 theme-script.ts），
 // 这里读回来的目的只是让 React state 与 DOM 一致。
 const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS);
 const [resolvedMode, setResolvedMode] = useState<"light" |"dark">("light");
 const [ready, setReady] = useState(false);

 useEffect(() => {
 const stored = readStorage<ThemeSettings>(STORAGE_KEY, DEFAULT_SETTINGS);
 const next: ThemeSettings = {
 mode: stored.mode ?? DEFAULT_SETTINGS.mode,
 accentHue: typeof stored.accentHue ==="number" ? stored.accentHue : DEFAULT_SETTINGS.accentHue,
 };
 setSettings(next);
 setResolvedMode(applyTheme(next));
 setReady(true);
 }, []);

 // system 模式下跟随系统切换
 useEffect(() => {
 if (settings.mode !=="system") return;
 const query = window.matchMedia("(prefers-color-scheme: dark)");
 const onChange = () => setResolvedMode(applyTheme(settings));
 query.addEventListener("change", onChange);
 return () => query.removeEventListener("change", onChange);
 }, [settings]);

 const update = useCallback((patch: Partial<ThemeSettings>) => {
 setSettings((prev) => {
 const next = { ...prev, ...patch };
 writeStorage(STORAGE_KEY, next);
 setResolvedMode(applyTheme(next));
 return next;
 });
 }, []);

 const setMode = useCallback((mode: ThemeMode) => update({ mode }), [update]);
 const setAccentHue = useCallback((accentHue: number) => update({ accentHue }), [update]);
 const reset = useCallback(() => update(DEFAULT_SETTINGS), [update]);

 const value = useMemo<ThemeValue>(
 () => ({ ...settings, resolvedMode, ready, setMode, setAccentHue, reset }),
 [settings, resolvedMode, ready, setMode, setAccentHue, reset],
 );

 return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
 const ctx = useContext(ThemeContext);
 if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
 return ctx;
}

/**
 * 首屏阻塞脚本：在 React 水合前就把 data-theme / --accent-hue 写到 <html>，
 * 避免深色用户看到一帧白屏（FOUC）。
 */
export const THEME_INIT_SCRIPT = `
(function(){
 try {
 var raw = localStorage.getItem('lightap:theme');
 var s = raw ? JSON.parse(raw) : null;
 var mode = (s && s.mode) || 'system';
 var hue = (s && typeof s.accentHue === 'number') ? s.accentHue : 210;
 var dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
 var root = document.documentElement;
 root.dataset.theme = dark ? 'dark' : 'light';
 root.dataset.themeMode = mode;
 var wrap = function(h){ return ((h % 360) + 360) % 360; };
 root.style.setProperty('--accent-hue', String(hue));
 root.style.setProperty('--magic-hue', String(wrap(hue - 28)));
 root.style.setProperty('--magic-hue-deep', String(wrap(hue - 22)));
 root.style.setProperty('--sakura-hue', String(wrap(hue + 32)));
 root.style.setProperty('--cool-hue', String(wrap(hue - 14)));
 } catch (e) {}
})();
`;
