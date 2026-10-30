"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BotCheckWidget } from "@/web/components/auth/bot-check-widget";
import { CloseIcon, FeatherIcon, LockIcon, UserIcon } from "@/web/components/ui/icons";
import { Modal } from "@/web/components/ui/modal";
import { ApiError } from "@/web/lib/api";
import { cn } from "@/web/lib/cn";
import { useI18n } from "@/web/lib/i18n";
import type { TranslationKey } from "@/web/lib/i18n";
import { checkPasswordStrength } from "@/web/lib/password-strength";
import { useSession } from "@/web/stores/session-store";
import type { AuthMode } from "@/web/types";

/** 强度检查的失败原因 → 提示文案 key */
const PASSWORD_REASON_KEY: Record<"format" | "tooWeak" | "repetitive", TranslationKey> = {
    format: "auth.passwordRule",
    tooWeak: "auth.passwordTooWeak",
    repetitive: "auth.passwordRepetitive",
};

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
    // 机器人验证 token：未启用该功能时恒为 null，不影响提交
    const [botToken, setBotToken] = useState<string | null>(null);
    /**
     * Turnstile 重置信号。
     *
     * token 只能用一次，所以每次提交结束后都要让 widget 重新挑战：
     * 否则「用户名被占用」这类失败后再次提交，带的还是已消耗的旧 token，
     * 会被服务端判为 timeout-or-duplicate 而一直 403。
     */
    const [botResetSignal, setBotResetSignal] = useState(0);

    const isLogin = mode === "login";

    useEffect(() => {
        if (!open) return;
        setUsername("");
        setPassword("");
        setConfirmPassword("");
        setError(null);
        setBotToken(null);
        // 重开弹窗时也换一个新 token（旧的可能已经过期或已消耗）
        setBotResetSignal((n) => n + 1);
    }, [open, mode]);

    function validate(): string | null {
        const u = username.trim();
        if (!u) return t("auth.usernameRequired");
        if (u.length < 2) return t("auth.usernameMin");
        if (!/^[a-zA-Z0-9_]+$/.test(u)) return t("auth.usernameCharset");
        if (!password) return t("auth.passwordRequired");
        // 登录只要求非空（历史账号可能是旧规则创建的短密码），
        // 注册才做强度校验，避免老用户被新规则锁在门外
        if (!isLogin) {
            const strength = checkPasswordStrength(password);
            if (!strength.ok) {
                return t(PASSWORD_REASON_KEY[strength.reason]);
            }
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
            if (isLogin) {
                await login(username.trim(), password);
            } else {
                // botToken 只在启用机器人验证时才有值；
                // 未启用时传 undefined，后端也不会校验
                await register(username.trim(), password, botToken ?? undefined);
            }
            onClose();
        } catch (e) {
            if (!isLogin && e instanceof ApiError && e.status === 409) {
                setError(t("auth.taken"));
            } else if (!isLogin && e instanceof ApiError && e.status === 403) {
                // 403 在注册路径上只可能是机器人校验失败
                setError(t("auth.botFailed"));
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
            // 每次提交结束都换一个新 token（成功时弹窗会关，这里重置也无害）。
            // 这是「token 只能用一次」的关键处理：失败后重试必须带新 token。
            setBotResetSignal((n) => n + 1);
        }
    }

    const switchMode: AuthMode = isLogin ? "register" : "login";

    return (
        <Modal
            open={open}
            onClose={onClose}
            label={t(isLogin ? "common.login" : "common.register")}
            alignClassName="items-center justify-center p-3 sm:p-4"
            panelClassName="surface-raised w-full max-w-sm p-6 sm:p-7"
        >
            <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-[#6fbaf5] to-[#4a9de0] text-white shadow-md shadow-brand/40">
                        <FeatherIcon size={17} />
                    </span>
                    <h2 className="font-display text-lg font-black text-fg">
                        {t(isLogin ? "auth.loginTitle" : "auth.registerTitle")}
                    </h2>
                </div>
                <button
                    type="button"
                    aria-label={t("common.close")}
                    onClick={onClose}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-fg-mute transition hover:bg-overlay-strong hover:text-brand-deep active:scale-90"
                >
                    <CloseIcon size={18} />
                </button>
            </div>

            <p className="mb-5 text-sm leading-relaxed text-fg-weak">
                {t(isLogin ? "auth.loginHint" : "auth.registerHint")}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
                <label className="flex items-center gap-2.5 rounded-xl border border-line bg-overlay px-3.5 py-2.5 transition focus-within:border-brand/40 focus-within:bg-overlay">
                    <UserIcon size={17} className="shrink-0 text-brand" />
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t("auth.username")}
                        aria-label={t("auth.username")}
                        autoFocus
                        autoComplete="username"
                        className="w-full bg-transparent text-sm font-medium text-fg placeholder:text-fg-mute focus:outline-none"
                    />
                </label>

                <label className="flex items-center gap-2.5 rounded-xl border border-line bg-overlay px-3.5 py-2.5 transition focus-within:border-brand/40 focus-within:bg-overlay">
                    <LockIcon size={17} className="shrink-0 text-brand" />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t("auth.password")}
                        aria-label={t("auth.password")}
                        autoComplete={isLogin ? "current-password" : "new-password"}
                        className="w-full bg-transparent text-sm font-medium text-fg placeholder:text-fg-mute focus:outline-none"
                    />
                </label>

                {!isLogin && (
                    <label className="flex items-center gap-2.5 rounded-xl border border-line bg-overlay px-3.5 py-2.5 transition focus-within:border-brand/40 focus-within:bg-overlay">
                        <LockIcon size={17} className="shrink-0 text-brand" />
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder={t("auth.confirmPassword")}
                            aria-label={t("auth.confirmPassword")}
                            autoComplete="new-password"
                            className="w-full bg-transparent text-sm font-medium text-fg placeholder:text-fg-mute focus:outline-none"
                        />
                    </label>
                )}

                {/* 机器人验证：只有服务端配置了 siteKey 才渲染，未配置时返回 null */}
                {!isLogin && <BotCheckWidget onTokenChange={setBotToken} resetSignal={botResetSignal} />}

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

            <p className="mt-4 text-center text-sm text-fg-weak">
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
