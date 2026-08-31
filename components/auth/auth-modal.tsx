"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CloseIcon, FeatherIcon, LockIcon, UserIcon } from "@/components/icons";
import { useAuth, type AuthMode } from "@/components/auth/auth-provider";
import { cn } from "@/lib/client/utils";

interface AuthModalProps {
    open: boolean;
    mode: AuthMode;
    onClose: () => void;
    onSwitchMode?: (mode: AuthMode) => void;
}

export function AuthModal({ open, mode, onClose, onSwitchMode }: AuthModalProps) {
    const { login, register } = useAuth();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isLogin = mode === "login";

    useEffect(() => {
        if (!open) return;
        setUsername("");
        setPassword("");
        setConfirmPassword("");
        setError(null);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose, mode]);

    if (!open) return null;

    function validate(): string | null {
        const u = username.trim();
        if (!u) return "请输入用户名";
        if (u.length < 2) return "用户名至少 2 个字符";
        if (!/^[a-zA-Z0-9_]+$/.test(u)) return "用户名只能包含字母、数字和下划线";
        if (!password) return "请输入密码";
        if (password.length < 6) return "密码至少 6 位";
        if (!isLogin) {
            if (!confirmPassword) return "请再次输入密码";
            if (confirmPassword !== password) return "两次输入的密码不一致";
        }
        return null;
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const err = validate();
        if (err) {
            setError(err);
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            if (isLogin) await login(username, password);
            else await register(username, password);
            onClose();
        } catch {
            setError(isLogin ? "登录失败，请稍后重试" : "注册失败，请稍后重试");
        } finally {
            setSubmitting(false);
        }
    }

    const switchMode: AuthMode = isLogin ? "register" : "login";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/20 p-3 backdrop-blur-sm sm:p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={isLogin ? "登录" : "注册"}
        >
            <div
                className="glass-strong w-full max-w-sm p-6 sm:p-7"
                style={{ animation: "drop-in .32s cubic-bezier(.34,1.4,.64,1)" }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-[#59b5ff] to-[#2e97f4] text-white shadow-md shadow-brand/40">
                            <FeatherIcon size={17} />
                        </span>
                        <h2 className="font-display text-lg font-black text-slate-800">
                            {isLogin ? "登录 LightAP" : "加入 LightAP"}
                        </h2>
                    </div>
                    <button
                        type="button"
                        aria-label="关闭"
                        onClick={onClose}
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-slate-400 transition hover:bg-white/80 hover:text-brand-deep active:scale-90"
                    >
                        <CloseIcon size={18} />
                    </button>
                </div>

                <p className="mb-5 text-sm leading-relaxed text-slate-500">
                    {isLogin
                        ? "欢迎回来！输入用户名和密码即可继续。"
                        : "创建一个账号，加入联邦宇宙，分享你的日常。"}
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
                    <label className="flex items-center gap-2.5 rounded-xl border border-white/70 bg-white/70 px-3.5 py-2.5 transition focus-within:border-brand/40 focus-within:bg-white">
                        <UserIcon size={17} className="shrink-0 text-brand" />
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="用户名"
                            aria-label="用户名"
                            autoFocus
                            autoComplete="username"
                            className="w-full bg-transparent text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none"
                        />
                    </label>

                    <label className="flex items-center gap-2.5 rounded-xl border border-white/70 bg-white/70 px-3.5 py-2.5 transition focus-within:border-brand/40 focus-within:bg-white">
                        <LockIcon size={17} className="shrink-0 text-brand" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="密码"
                            aria-label="密码"
                            autoComplete={isLogin ? "current-password" : "new-password"}
                            className="w-full bg-transparent text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none"
                        />
                    </label>

                    {!isLogin && (
                        <label className="flex items-center gap-2.5 rounded-xl border border-white/70 bg-white/70 px-3.5 py-2.5 transition focus-within:border-brand/40 focus-within:bg-white">
                            <LockIcon size={17} className="shrink-0 text-brand" />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="确认密码"
                                aria-label="确认密码"
                                autoComplete="new-password"
                                className="w-full bg-transparent text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none"
                            />
                        </label>
                    )}

                    {error && (
                        <p role="alert" className="rounded-lg bg-sakura/10 px-3 py-2 text-xs font-bold text-sakura-deep">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="btn-solid w-full py-2.5 font-display text-sm font-extrabold tracking-wide"
                    >
                        {submitting ? "请稍候…" : isLogin ? "登录" : "注册"}
                    </button>
                </form>

                <p className="mt-4 text-center text-sm text-slate-500">
                    {isLogin ? "还没有账号？" : "已经有账号了？"}
                    <button
                        type="button"
                        onClick={() => {
                            setError(null);
                            onSwitchMode?.(switchMode);
                        }}
                        className={cn(
                            "mx-1 cursor-pointer font-bold transition hover:underline",
                            "text-brand-deep",
                        )}
                    >
                        {isLogin ? "去注册" : "去登录"}
                    </button>
                </p>
            </div>
        </div>
    );
}
