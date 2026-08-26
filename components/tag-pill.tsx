import Link from "next/link";
import { cn } from "@/lib/utils";

/* 蓝 / 紫 / 粉 三色胶囊：蓝色为主，紫粉点缀 */
export const toneClasses = {
    blue: "bg-brand/15 text-brand-ink hover:bg-brand/25",
    purple: "bg-magic/15 text-magic-deep hover:bg-magic/25",
    pink: "bg-sakura/20 text-sakura-deep hover:bg-sakura/30",
} as const;

const tones = toneClasses;

export type PillTone = keyof typeof tones;

export const pillTones = ["blue", "purple", "pink"] as const;

export function toneFor(seed: string): PillTone {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    }
    return pillTones[Math.abs(hash) % pillTones.length];
}

interface TagPillProps {
    label: string;
    href?: string;
    tone?: PillTone;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
}

export function TagPill({ label, href, tone, className, onClick }: TagPillProps) {
    const cls = cn(
        "inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[13px] font-bold leading-5 transition-colors",
        tones[tone ?? toneFor(label)],
        className,
    );
    if (!href) {
        return <span className={cls}>{label}</span>;
    }
    return (
        <Link href={href} onClick={onClick} className={cls}>
            {label}
        </Link>
    );
}
