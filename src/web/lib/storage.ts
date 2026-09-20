/** localStorage 的带命名空间封装，SSR 与隐私模式下自动降级。 */

const PREFIX = "lightap:";

export function readStorage<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try {
        const raw = window.localStorage.getItem(PREFIX + key);
        if (raw === null) return fallback;
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

export function writeStorage(key: string, value: unknown): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
        // localStorage 不可用时静默忽略
    }
}
