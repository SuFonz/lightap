/**
 * 远端 ActivityPub 内容通常是 HTML（例如 `<p>hai!</p>`），
 * 而本站发帖存的是纯文本。这里把远端 HTML 归一化成纯文本，
 * 让两种来源在前端走同一套渲染（React 转义，天然安全，不用 dangerouslySetInnerHTML）。
 *
 * 只在“看起来像 HTML”时才处理，避免破坏本地纯文本里的 `<` 字符。
 */

const NAMED_ENTITIES: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
};

function decodeEntities(text: string): string {
    return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code: string) => {
        if (code[0] === "#") {
            const isHex = code[1] === "x" || code[1] === "X";
            const value = parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
            if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) return match;
            return String.fromCodePoint(value);
        }
        return NAMED_ENTITIES[code.toLowerCase()] ?? match;
    });
}

/** 是否包含 HTML 标签（保守判断：`<` 后紧跟字母才算标签名）。 */
export function looksLikeHtml(value: string): boolean {
    return /<\/?[a-zA-Z][^>]*>/.test(value);
}

/** 把 HTML 转成纯文本：块级标签转换行、去标签、解实体、压缩空行。 */
export function htmlToText(html: string): string {
    return decodeEntities(
        html
            .replace(/<\s*br\s*\/?\s*>/gi, "\n")
            .replace(/<\s*\/\s*(p|div|li|ul|ol|blockquote|h[1-6])\s*>/gi, "\n")
            .replace(/<\s*li[^>]*>/gi, "• ")
            .replace(/<[^>]*>/g, ""),
    )
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/** 帖子内容归一化：远端 HTML 转纯文本，本地纯文本原样返回。 */
export function normalizeNoteContent(content: string): string {
    return looksLikeHtml(content) ? htmlToText(content) : content;
}
