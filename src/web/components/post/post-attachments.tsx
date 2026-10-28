"use client";

import { useState } from "react";
import { cn } from "@/web/lib/cn";
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
    // 灯箱当前显示第几张（null 表示关闭）
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    if (attachments.length === 0) return null;

    // 图片单独成组，其余（视频/音频/文件）按顺序排在下面
    const images = attachments.filter((item) => item.kind === "image");
    const others = attachments.filter((item) => item.kind !== "image");

    return (
        <div className="mt-2.5 flex flex-col gap-2">
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
                <AttachmentMedia key={`${item.url}-${index}`} item={item} onInteract={onInteract} />
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
}: {
    item: PostAttachment;
    index: number;
    count: number;
    onInteract?: (e: React.MouseEvent) => void;
    onOpen: () => void;
}) {
    const [failed, setFailed] = useState(false);
    const [loaded, setLoaded] = useState(false);

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
        <button
            type="button"
            onClick={(e) => {
                // 先阻止冒泡（不让整卡跳转），再打开灯箱
                onInteract?.(e);
                onOpen();
            }}
            className={cn(
                "group relative block w-full cursor-zoom-in overflow-hidden rounded-lg bg-overlay-weak",
                aspectClass,
            )}
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
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
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
function AttachmentMedia({ item, onInteract }: { item: PostAttachment; onInteract?: (e: React.MouseEvent) => void }) {
    const [failed, setFailed] = useState(false);

    if (failed) {
        return <AttachmentFallback item={item} onInteract={onInteract} />;
    }

    if (item.kind === "video") {
        return (
            <div onClick={onInteract} className="overflow-hidden rounded-xl bg-black/85">
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
        );
    }

    if (item.kind === "audio") {
        return (
            <div
                onClick={onInteract}
                className="flex items-center gap-2.5 rounded-xl border border-line bg-overlay-weak px-3 py-2.5"
            >
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
        );
    }

    // document：渲染成可点击的附件条目
    return <AttachmentFallback item={item} onInteract={onInteract} />;
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
