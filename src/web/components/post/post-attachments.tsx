"use client";

import { useState } from "react";
import { cn } from "@/web/lib/cn";
import { useI18n } from "@/web/lib/i18n";
import { Lightbox } from "@/web/components/post/lightbox";
import type { PostAttachment } from "@/web/types";

/**
 * 帖子附件渲染。
 *
 * 只用于**远程**帖子带来的附件（本站没有上传功能）。
 * 远程媒体直接指向对方实例的地址，所以这里做了几件事：
 *
 * - `loading="lazy"` + `decoding="async"`：时间线里可能有很多图，不全部立刻解码
 * - `referrerPolicy="no-referrer"`：不把本站地址泄漏给对方 CDN
 * - 固定格子 + object-cover：多图必须能平铺对齐，不能让每张图按自身比例撑高
 * - 加载失败降级成链接：远程资源可能 404 / 防盗链，不能让用户看到破图
 *
 * 多图点击进灯箱（可左右切换）；视频/音频用浏览器自带控件，一行一个。
 */
export function PostAttachments({
    attachments,
    onInteract,
}: {
    attachments: PostAttachment[];
    /** 点击附件时阻止冒泡（避免触发「进入帖子详情」） */
    onInteract?: (e: React.MouseEvent) => void;
}) {
    const { t } = useI18n();
    // 灯箱当前显示第几张（null 表示关闭）
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    // 已展开的敏感媒体（url 集合）：用来让顶部提示随展开情况实时变化
    const [revealedUrls, setRevealedUrls] = useState<Set<string>>(() => new Set());

    if (attachments.length === 0) return null;

    // 图片单独成组，其余（视频/音频/文件）按顺序排在下面
    const images = attachments.filter((item) => item.kind === "image");
    const others = attachments.filter((item) => item.kind !== "image");

    // 还没展开的敏感媒体数量：展开一个就少一个，全部展开后提示自动消失
    const hiddenSensitiveCount = attachments.filter(
        (item) => item.sensitive && !revealedUrls.has(item.url),
    ).length;

    const markRevealed = (url: string) =>
        setRevealedUrls((prev) => {
            if (prev.has(url)) return prev;
            const next = new Set(prev);
            next.add(url);
            return next;
        });

    return (
        <div className="mt-2.5 flex flex-col gap-2">
            {hiddenSensitiveCount > 0 && (
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-fg-mute">
                    <WarningGlyph />
                    {t("post.sensitiveMediaCount", { count: hiddenSensitiveCount })}
                </p>
            )}

            {images.length > 0 && (
                <>
                    <div
                        className={cn(
                            "grid gap-1.5 overflow-hidden rounded-xl",
                            // 布局规则：让所有格子尺寸一致，才能平铺对齐
                            // 1 张：单列，用 4:3 的固定比例
                            // 2 张：两列等宽，每格 1:1
                            // 3 张：首图跨两列（16:9），后两张各占一列（1:1）
                            // 4 张及以上：两列网格，全部 1:1，最后一行不足时左对齐
                            images.length === 1 && "grid-cols-1",
                            images.length >= 2 && "grid-cols-2",
                        )}
                    >
                        {images.map((item, index) => (
                            <AttachmentImage
                                key={`${item.url}-${index}`}
                                item={item}
                                index={index}
                                count={images.length}
                                onInteract={onInteract}
                                onOpen={() => setLightboxIndex(index)}
                                onReveal={() => markRevealed(item.url)}
                            />
                        ))}
                    </div>

                    {/* 多图时提示可浏览：单图点开也有灯箱，但不需要提示 */}
                    {images.length > 1 && (
                        <p className="text-[11px] text-fg-mute">
                            共 {images.length} 张图片，点击可浏览大图
                        </p>
                    )}

                    <Lightbox
                        images={images}
                        index={lightboxIndex}
                        onClose={() => setLightboxIndex(null)}
                        onChange={setLightboxIndex}
                    />
                </>
            )}

            {/* 视频 / 音频 / 文件：一行一个，用浏览器自带控件 */}
            {others.map((item, index) => (
                <AttachmentMedia
                    key={`${item.url}-${index}`}
                    item={item}
                    onInteract={onInteract}
                    onReveal={() => markRevealed(item.url)}
                />
            ))}
        </div>
    );
}

/**
 * 单张图片格子。
 *
 * 关键点：格子用**固定比例**（而不是每张图各自的原始比例）。
 * 之前按每张图自己的宽高设 aspect-ratio，导致同一行里两张图高度不同、
 * 跨列的首图又把下面撑开，视觉上就是「没铺平」。
 * 现在统一由外层布局决定格子比例，图片用 object-cover 填满。
 */
function AttachmentImage({
    item,
    index,
    count,
    onInteract,
    onOpen,
    onReveal,
}: {
    item: PostAttachment;
    index: number;
    count: number;
    onInteract?: (e: React.MouseEvent) => void;
    onOpen: () => void;
    /** 敏感媒体被展开时通知父级，用于更新顶部提示的计数 */
    onReveal: () => void;
}) {
    const [failed, setFailed] = useState(false);
    const [loaded, setLoaded] = useState(false);
    // 敏感媒体：默认不挂载 <img>，用户点遮罩后才真正加载
    const [revealed, setRevealed] = useState(!item.sensitive);

    if (failed) {
        return <AttachmentFallback item={item} onInteract={onInteract} />;
    }

    // 布局规则（与父级网格列数配合，保证每行都填满、不参差）：
    // - 1 张：4:3 单图
    // - 2 张：两列各 1:1
    // - 3 张：首图跨两列 16:9，后两张各 1:1
    // - 4 张：2×2，全部 1:1
    // - 5 张及以上：首图跨两列 16:9，其余 1:1 两列铺开
    const isHero = count === 3 || count >= 5 ? index === 0 : false;
    const aspectClass =
        count === 1
            ? "aspect-[4/3]"
            : isHero
              ? "aspect-[16/9] col-span-2"
              : "aspect-square";

    return (
        <div className={cn("relative overflow-hidden rounded-lg bg-overlay-weak", aspectClass)}>
            {revealed ? (
                <ImageBody item={item} index={index} onInteract={onInteract} onOpen={onOpen} onFail={() => setFailed(true)} onLoad={() => setLoaded(true)} loaded={loaded} />
            ) : (
                <SensitiveOverlay
                    onReveal={(e) => {
                        // 点遮罩只负责展开：同时阻止冒泡，避免触发整卡跳转
                        onInteract?.(e);
                        e.stopPropagation();
                        setRevealed(true);
                        // 通知父级：顶部「N 个媒体已隐藏」要随之减少
                        onReveal();
                    }}
                />
            )}
        </div>
    );
}

/** 图片本体（展开后才挂载） */
function ImageBody({
    item,
    index,
    onInteract,
    onOpen,
    onFail,
    onLoad,
    loaded,
}: {
    item: PostAttachment;
    index: number;
    onInteract?: (e: React.MouseEvent) => void;
    onOpen: () => void;
    onFail: () => void;
    onLoad: () => void;
    loaded: boolean;
}) {
    return (
        <button
            type="button"
            onClick={(e) => {
                // 先阻止冒泡（不让整卡跳转），再打开灯箱
                onInteract?.(e);
                onOpen();
            }}
            className="group relative block h-full w-full cursor-zoom-in"
            aria-label={item.name ? `查看大图：${item.name}` : `查看第 ${index + 1} 张图片`}
        >
            {/* 加载中的底色占位：图片出现前不会留白洞 */}
            {!loaded && <span className="absolute inset-0 animate-pulse bg-overlay" aria-hidden="true" />}
            <img
                src={item.url}
                alt={item.name ?? ""}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                draggable={false}
                onLoad={onLoad}
                onError={onFail}
                className={cn(
                    "h-full w-full object-cover transition-[opacity,transform] duration-300",
                    "group-hover:scale-[1.02]",
                    loaded ? "opacity-100" : "opacity-0",
                )}
            />
            {/* hover 时右下角给一个「可放大」的暗示 */}
            <span
                className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                aria-hidden="true"
            >
                点击查看
            </span>
        </button>
    );
}

/** 视频 / 音频 / 文件 */
function AttachmentMedia({
    item,
    onInteract,
    onReveal,
}: {
    item: PostAttachment;
    onInteract?: (e: React.MouseEvent) => void;
    /** 敏感媒体被展开时通知父级，用于更新顶部提示的计数 */
    onReveal: () => void;
}) {
    const [failed, setFailed] = useState(false);
    const { t } = useI18n();
    // 敏感媒体：默认不挂载播放器（不预载、不出声）
    const [revealed, setRevealed] = useState(!item.sensitive);

    if (failed) {
        return <AttachmentFallback item={item} onInteract={onInteract} />;
    }

    const reveal = (e: React.MouseEvent) => {
        onInteract?.(e);
        e.stopPropagation();
        setRevealed(true);
        onReveal();
    };

    if (item.kind === "video") {
        return (
            <div className="relative overflow-hidden rounded-xl bg-black/85">
                {revealed ? (
                    <div onClick={onInteract}>
                        <video
                            src={item.url}
                            controls
                            playsInline
                            preload="metadata"
                            // 远程视频不自动播放，避免时间线里多个视频同时出声
                            onError={() => setFailed(true)}
                            className="max-h-[70vh] w-full"
                        >
                            你的浏览器不支持视频播放。
                        </video>
                    </div>
                ) : (
                    <div className="relative aspect-[16/9]">
                        <SensitiveOverlay onReveal={reveal} />
                    </div>
                )}
            </div>
        );
    }

    if (item.kind === "audio") {
        return (
            <div className="relative overflow-hidden rounded-xl border border-line bg-overlay-weak">
                {revealed ? (
                    <div onClick={onInteract} className="flex items-center gap-2.5 px-3 py-2.5">
                        <span className="text-fg-mute" aria-hidden="true">
                            <AudioGlyph />
                        </span>
                        <div className="min-w-0 flex-1">
                            {item.name && <p className="truncate text-[13px] font-semibold text-fg-weak">{item.name}</p>}
                            <audio
                                src={item.url}
                                controls
                                preload="none"
                                onError={() => setFailed(true)}
                                className="mt-1 w-full"
                            />
                        </div>
                    </div>
                ) : (
                    // 音频没有画面，遮罩不做整块模糊，只留一行可点的提示
                    <button
                        type="button"
                        onClick={reveal}
                        aria-label={t("post.sensitiveAria")}
                        className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-3 text-left transition-colors hover:bg-overlay"
                    >
                        <span className="text-fg-mute" aria-hidden="true">
                            <WarningGlyph />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-display text-[12px] font-bold text-fg-weak">
                            {item.name || t("post.sensitive")}
                        </span>
                        <span className="shrink-0 text-[11px] text-fg-mute">{t("post.showMedia")}</span>
                    </button>
                )}
            </div>
        );
    }

    // document：渲染成可点击的附件条目
    return <AttachmentFallback item={item} onInteract={onInteract} />;
}

/**
 * 敏感媒体遮罩。
 *
 * 关键：遮罩下面**没有真实媒体**——图片/视频要等点击后才挂载，
 * 所以不是「视觉遮挡」而是真的没加载：省流量，也不会在
 * 用户明确同意前把远程资源拉下来。
 */
function SensitiveOverlay({ onReveal }: { onReveal: (e: React.MouseEvent) => void }) {
    const { t } = useI18n();
    return (
        <button
            type="button"
            onClick={onReveal}
            aria-label={t("post.sensitiveAria")}
            className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-1.5 bg-overlay-strong backdrop-blur-md transition-colors hover:bg-overlay"
        >
            <WarningGlyph />
            <span className="font-display text-[11px] font-bold text-fg-weak">{t("post.sensitive")}</span>
            <span className="text-[10px] text-fg-mute">{t("post.showMedia")}</span>
        </button>
    );
}

/** 敏感内容图标（三角警告） */
function WarningGlyph() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" x2="12" y1="9" y2="13" />
            <line x1="12" x2="12.01" y1="17" y2="17" />
        </svg>
    );
}

/** 无法内联展示时统一降级成链接（远程 404 / 防盗链 / PDF 等） */
function AttachmentFallback({ item, onInteract }: { item: PostAttachment; onInteract?: (e: React.MouseEvent) => void }) {
    const label = item.name || fileNameFromUrl(item.url) || "附件";
    return (
        <a
            href={item.url}
            target="_blank"
            rel="noreferrer noopener"
            onClick={onInteract}
            className="flex items-center gap-2.5 rounded-xl border border-line bg-overlay-weak px-3 py-2.5 text-[13px] font-semibold text-fg-weak transition-colors hover:border-brand/30 hover:text-brand-deep"
        >
            <span className="shrink-0 text-fg-mute" aria-hidden="true">
                <FileGlyph />
            </span>
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {item.mediaType && <span className="shrink-0 text-[11px] text-fg-mute">{item.mediaType}</span>}
        </a>
    );
}

/** 从 URL 里取文件名作为展示名 */
function fileNameFromUrl(url: string): string {
    try {
        const path = new URL(url).pathname;
        const name = path.split("/").filter(Boolean).pop() ?? "";
        return decodeURIComponent(name);
    } catch {
        return "";
    }
}

function AudioGlyph() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
        </svg>
    );
}

function FileGlyph() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
        </svg>
    );
}
