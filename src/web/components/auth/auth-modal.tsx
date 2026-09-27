"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CloseIcon, FeatherIcon, LockIcon, UserIcon } from "@/web/components/ui/icons";
import { Modal } from "@/web/components/ui/modal";
import { ApiError } from "@/web/lib/api";
import { cn } from "@/web/lib/cn";
import { useI18n } from "@/web/lib/i18n";
import { useSession } from "@/web/stores/session-store";
import type { AuthMode } from "@/web/types";

interface AuthModalProps {
    open: boolean;
    mode: AuthMode;
    onClose: () => void;
    onSwitchMode?: (mode: AuthMode) => void;
}

export function AuthModal({ open, mode, onClose, onSwitchMode }: AuthModalProps) {
    const { login, register } = useSession();
    const { t } = useI18n();
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
    }, [open, mode]);

    function validate(): string | null {
        const u = username.trim();
        if (!u) return t("auth.usernameRequired");
        if (u.length < 2) return t("auth.usernameMin");
        if (!/^[a-zA-Z0-9_]+$/.test(u)) return t("auth.usernameCharset");
        if (!password) return t("auth.passwordRequired");
        if (password.length < 6) return t("auth.passwordMin");
        if (!isLogin) {
            if (!confirmPassword) return t("auth.confirmRequired");
            if (confirmPassword !== password) return t("auth.confirmMismatch");
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
            if (isLogin) await login(username.trim(), password);
            else await register(username.trim(), password);
            onClose();
        } catch (e) {
            if (!isLogin && e instanceof ApiError && e.status === 409) {
                setError(t("auth.taken"));
            } else {
                setError(
                    e instanceof Error && e.message
                        ? e.message
                        : isLogin
                          ? t("auth.loginFailed")
                          : t("auth.registerFailed"),
                );
            }
        } finally {
            setSubmitting(false);
        }
    }

    const switchMode: AuthMode = isLogin ? "register" : "login";

    return (
        <Modal
            open={open}
            onClose={onClose}
            label={t(isLogin ? "common.login" : "common.register")}
            alignClassName="items-center justify-center p-3 sm:p-4"
            panelClassName="glass-strong w-full max-w-sm p-6 sm:p-7"
        >
            <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-[#59b5ff] to-[#2e97f4] text-white shadow-md shadow-brand/40">
                        <FeatherIcon size={17} />
                    </span>
                    <h2 className="font-display text-lg font-black text-slate-800">
                        {t(isLogin ? "auth.loginTitle" : "auth.registerTitle")}
                    </h2>
                </div>
                <button
                    type="button"
                    aria-label={t("common.close")}
                    onClick={onClose}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-slate-400 transition hover:bg-white/80 hover:text-brand-deep active:scale-90"
                >
                    <CloseIcon size={18} />
                </button>
            </div>

            <p className="mb-5 text-sm leading-relaxed text-slate-500">
                {t(isLogin ? "auth.loginHint" : "auth.registerHint")}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
                <label className="flex items-center gap-2.5 rounded-xl border border-white/70 bg-white/70 px-3.5 py-2.5 transition focus-within:border-brand/40 focus-within:bg-white">
                    <UserIcon size={17} className="shrink-0 text-brand" />
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t("auth.username")}
                        aria-label={t("auth.username")}
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
                        placeholder={t("auth.password")}
                        aria-label={t("auth.password")}
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
                            placeholder={t("auth.confirmPassword")}
                            aria-label={t("auth.confirmPassword")}
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
                    {submitting ? t("auth.pleaseWait") : t(isLogin ? "common.login" : "common.register")}
                </button>
            </form>

            <p className="mt-4 text-center text-sm text-slate-500">
                {t(isLogin ? "auth.noAccount" : "auth.hasAccount")}
                <button
                    type="button"
                    onClick={() => {
                        setError(null);
                        onSwitchMode?.(switchMode);
                    }}
                    className={cn("mx-1 cursor-pointer font-bold transition hover:underline", "text-brand-deep")}
                >
                    {t(isLogin ? "auth.goRegister" : "auth.goLogin")}
                </button>
            </p>
        </Modal>
    );
}
