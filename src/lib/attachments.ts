import type { APDocument, APDocumentType } from "@/src/activitypub/ap";

/**
 * 远程 Note 的附件解析。
 *
 * 只处理**远程**帖子带来的附件；本站发帖不产生附件（上传功能不在范围内）。
 *
 * 为什么需要一层解析而不是直接存：ActivityPub 只规定 `attachment` 是一个对象数组，
 * 但各家实现的实际字段形态差异很大，直接透传会拿到不可渲染的数据：
 *
 * - `type`：标准是 Image / Video / Audio / Document，但有的用 `Link`、
 *   `type` 为数组、或者干脆缺失（只能靠 MIME 猜）。
 * - `url`：可能是字符串、`{ type, href }` 对象、或者字符串数组（多清晰度）。
 * - `mediaType` / `mimeType`：字段名不统一。
 * - `name`：图片描述（alt text），可能缺失。
 * - 尺寸：`width` / `height` 可能是数字或字符串。
 *
 * 所以这里把各种形态收敛成一个稳定的结构，供入库与前端渲染使用。
 */

/** 归一化后的附件。字段都做成了可选，因为远程数据经常缺斤少两 */
export interface NoteAttachment {
    /** 资源类型，决定前端用 img / video / audio / 链接 渲染 */
    kind: "image" | "video" | "audio" | "document";
    /** 实际可加载的地址 */
    url: string;
    /** MIME 类型（可能缺失） */
    mediaType?: string;
    /** alt 文本 / 文件名 */
    name?: string;
    width?: number;
    height?: number;
    /** 远程原始 type，便于调试 */
    apType?: string;
    /**
     * 是否敏感内容（需点击才展示）。
     *
     * 来源有两个，取「或」：
     * - 附件自身的 `sensitive`（只有某几张图敏感）
     * - 整条 Note 的 `sensitive`（Mastodon 勾选「包含敏感内容」时所有媒体都敏感）
     */
    sensitive?: boolean;
}

/** 单个帖子最多保留多少附件，防止恶意报文塞入海量条目 */
const MAX_ATTACHMENTS = 8;

/** 只接受 http(s)，挡掉 javascript: / data: 这类不该出现在媒体源里的协议 */
function isSafeUrl(value: unknown): value is string {
    if (typeof value !== "string") return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

/**
 * 从 `url` 字段里取出真正可加载的地址。
 *
 * 支持的形态：
 * - `"https://example.com/a.png"`
 * - `{ type: "Link", href: "https://..." }`
 * - `[{ type: "Link", href: "..." }, ...]`（多清晰度，取第一个可用的）
 * - `{ url: "https://..." }`（个别实现会再套一层）
 */
function pickUrl(value: unknown, depth = 0): string | undefined {
    if (depth > 3) return undefined;

    if (isSafeUrl(value)) return value.trim();

    if (Array.isArray(value)) {
        for (const item of value) {
            const found = pickUrl(item, depth + 1);
            if (found) return found;
        }
        return undefined;
    }

    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        // 常见键：href / url
        for (const key of ["href", "url"]) {
            const found = pickUrl(record[key], depth + 1);
            if (found) return found;
        }
    }

    return undefined;
}

/** 从 mediaType / mimeType 里取 MIME，统一成小写 */
function pickMediaType(record: Record<string, unknown>): string | undefined {
    const raw = record.mediaType ?? record.mimeType;
    if (typeof raw !== "string") return undefined;
    const value = raw.trim().toLowerCase();
    return value || undefined;
}

/** 取正整数尺寸，字符串数字也接受 */
function pickSize(value: unknown): number | undefined {
    const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (!Number.isFinite(num) || num <= 0) return undefined;
    return Math.round(num);
}

/** 把 AP 的 type（可能是字符串或数组）拍平成小写字符串数组 */
function flattenTypes(value: unknown): string[] {
    if (typeof value === "string") return [value.toLowerCase()];
    if (Array.isArray(value)) {
        return value.filter((v): v is string => typeof v === "string").map((v) => v.toLowerCase());
    }
    return [];
}

/**
 * 判定附件类别：优先看 AP type，其次退回 MIME，最后看扩展名。
 * 都判断不出来时归为 document（前端渲染成链接）。
 */
function resolveKind(types: string[], mediaType?: string, url?: string): NoteAttachment["kind"] {
    if (types.includes("image")) return "image";
    if (types.includes("video")) return "video";
    if (types.includes("audio")) return "audio";

    if (mediaType) {
        if (mediaType.startsWith("image/")) return "image";
        if (mediaType.startsWith("video/")) return "video";
        if (mediaType.startsWith("audio/")) return "audio";
    }

    if (url) {
        const path = url.split("?")[0].toLowerCase();
        if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)$/.test(path)) return "image";
        if (/\.(mp4|webm|mov|m4v|ogv)$/.test(path)) return "video";
        if (/\.(mp3|ogg|oga|wav|m4a|flac|aac)$/.test(path)) return "audio";
    }

    return "document";
}

/**
 * 把远程 Note 的 `attachment` 解析成归一化列表。
 *
 * 任何非法条目都会被跳过而不是抛错：一条帖子的附件坏了，
 * 不该导致整条帖子入库失败。
 *
 * @param raw         Note.attachment 原始值
 * @param noteSensitive 整条帖子是否敏感；为 true 时所有附件都标为敏感
 *                      （Mastodon 勾选「包含敏感内容」就是这个语义）
 */
export function parseAttachments(raw: unknown, noteSensitive = false): NoteAttachment[] {
    if (!Array.isArray(raw) || raw.length === 0) return [];

    const result: NoteAttachment[] = [];

    for (const entry of raw) {
        if (result.length >= MAX_ATTACHMENTS) break;
        if (!entry || typeof entry !== "object") continue;

        const record = entry as Record<string, unknown>;
        const url = pickUrl(record.url);
        if (!url) continue;

        const types = flattenTypes(record.type);
        const mediaType = pickMediaType(record);
        const kind = resolveKind(types, mediaType, url);

        // 去重：同一个地址只保留一次（有些实现会重复列同一张图）
        if (result.some((item) => item.url === url)) continue;

        const name = typeof record.name === "string" ? record.name.trim() : undefined;

        // 敏感标记：帖子级优先（true 则全部敏感），否则看附件自身的 sensitive。
        // 远程数据里这个值可能是字符串 "true"、"1"，统一按「明确为真」判定。
        const itemSensitive = noteSensitive || isTruthy(record.sensitive);

        result.push({
            kind,
            url,
            mediaType,
            name: name || undefined,
            width: pickSize(record.width),
            height: pickSize(record.height),
            apType: types[0],
            sensitive: itemSensitive || undefined,
        });
    }

    return result;
}

/**
 * 判定「明确为真」的布尔值。
 *
 * 远程实现常把布尔写成字符串或数字，这里统一收口；
 * 未识别的值一律当 false，避免把正常内容误标成敏感。
 */
function isTruthy(value: unknown): boolean {
    if (value === true) return true;
    if (typeof value === "string") {
        const v = value.trim().toLowerCase();
        return v === "true" || v === "1";
    }
    if (typeof value === "number") return value === 1;
    return false;
}

/**
 * 入库前序列化成 JSON 字符串。
 * 空数组存 `null`，让「没有附件」和「有附件」在库里可区分且不占空间。
 */
export function serializeAttachments(items: NoteAttachment[]): string | null {
    return items.length > 0 ? JSON.stringify(items) : null;
}

/**
 * 从库里读回来。数据是自己写的，但仍做防御性校验：
 * 老数据可能是 null，或列里存了非法 JSON。
 */
export function deserializeAttachments(raw: string | null | undefined): NoteAttachment[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        // 只保留结构完整的条目，避免前端拿到半截数据
        return parsed.filter(
            (item): item is NoteAttachment =>
                !!item &&
                typeof item === "object" &&
                typeof item.url === "string" &&
                isSafeUrl(item.url) &&
                (item.kind === "image" || item.kind === "video" || item.kind === "audio" || item.kind === "document"),
        );
    } catch {
        return [];
    }
}

/** 供类型断言用：APDocument 与归一化结果的对应关系 */
export type { APDocument, APDocumentType };
