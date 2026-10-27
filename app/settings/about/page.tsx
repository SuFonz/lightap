"use client";

import { useRouter } from "next/navigation";
import { FeatherIcon, GlobeIcon } from "@/web/components/ui/icons";
import { useI18n } from "@/web/lib/i18n";
import { useDirectory } from "@/web/stores/directory";

export default function AboutPage() {
    const router = useRouter();
    const { currentUser } = useDirectory();
    const { t } = useI18n();

    return (
        <div className="flex flex-col gap-3">
            <section className="row-quiet flex items-center gap-3 px-5 py-4">
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label={t("common.back")}
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] text-fg-weak transition hover:bg-overlay-strong hover:text-brand-deep active:scale-90"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m12 19-7-7 7-7" />
                        <path d="M19 12H5" />
                    </svg>
                </button>
                <h1 className="font-display text-lg font-black text-fg">{t("about.title")}</h1>
            </section>

            <section className="row-quiet flex flex-col items-center gap-3 px-6 py-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-[#59b5ff] to-[#2e97f4] text-white shadow-md shadow-brand/40">
                    <FeatherIcon size={26} />
                </span>
                <div className="flex flex-col items-center gap-2">
                    <h2 className="font-display text-lg font-black text-brand-ink">LightAP</h2>
                    <p className="text-sm leading-relaxed text-fg-weak">{t("about.tagline")}</p>
                </div>
            </section>

            <section className="row-quiet p-5" aria-label={t("about.info")}>
                <h2 className="mb-3 flex items-center gap-1.5 font-display text-sm font-extrabold text-fg">
                    <GlobeIcon size={15} className="text-brand-deep" /> {t("about.detail")}
                </h2>
                <ul className="flex flex-col gap-2 text-sm text-fg-weak">
                    <li className="flex items-center justify-between">
                        <span>{t("about.instance")}</span>
                        <span className="font-semibold text-fg">{currentUser.instance || "—"}</span>
                    </li>
                    <li className="flex items-center justify-between">
                        <span>{t("about.protocol")}</span>
                        <span className="font-semibold text-fg">ActivityPub</span>
                    </li>
                    <li className="flex items-center justify-between">
                        <span>{t("about.version")}</span>
                        <span className="font-semibold text-fg">LightAP 0.1.0</span>
                    </li>
                </ul>
            </section>
        </div>
    );
}
