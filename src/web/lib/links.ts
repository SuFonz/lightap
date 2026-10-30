/**
 * 帖子正文里的链接解析。
 *
 * 为什么要单独抽出来：正文来源有两种，形态不同但都要能点：
 * - **本地帖子**：纯文本，用户可能直接写了 `https://example.com`
 * - **远程帖子**：原本是 HTML，进来时被 `htmlToText` 转成了纯文本，
 *   所以 `<a href>` 标签已经没了，只剩下裸露的 URL
 *
 * 因此这里只处理**裸 URL**：从纯文本里识别出可点击的链接。
 * 识别结果交给渲染层，由它决定「站内链接直接跳 / 站外链接先弹提示」。
 */

/** 一段正文被切成的片段 */
export type ContentToken =
    | { type: "text"; value: string }
    | { type: "hashtag"; value: string }
    | { type: "mention"; value: string }
    | { type: "link"; value: string; href: string };

/**
 * URL 匹配规则。
 *
 * 设计取舍：
 * - 只认 `http://` / `https://` 开头的**完整** URL。
 *   不认 `www.example.com` 这种省略协议的写法 —— 它会和普通句子里的
 *   点号混在一起（比如「版本 1.2.3」），误判代价比漏判大。
 * - 结尾的标点要从链接里剔除：`https://a.com。` 里的中文句号不属于链接。
 * - 允许路径 / 查询 / 锚点里的常见字符，但不吃到空白和尖括号。
 */
const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;

/**
 * 链接结尾常见的「不属于 URL」的字符。
 *
 * 比如 `看看这个 https://example.com/page。` 或 `(https://example.com)`，
 * 结尾的句号 / 右括号是句子的一部分，不能算进链接。
 *
 * 注意要同时包含半角与全角括号：中英文混排时两种都会出现。
 */
const TRAILING_PUNCTUATION = /[.,;:!?()\[\]{}，。；：！？、（）【】《》「」『』…]+$/;

/**
 * 从匹配到的原始串里剔除尾部标点，返回干净的 URL。
 * 若剔除后不再是合法 http(s) 地址，返回 undefined。
 */
function cleanUrl(raw: string): string | undefined {
    const trimmed = raw.replace(TRAILING_PUNCTUATION, "");
    if (!trimmed) return undefined;
    try {
        const parsed = new URL(trimmed);
        // 只接受 http(s)：挡掉 javascript: / data: 这类危险协议
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
        // 必须有主机名，`https://` 单独出现不算链接
        if (!parsed.hostname) return undefined;
        return trimmed;
    } catch {
        return undefined;
    }
}

/**
 * 判断链接是否指向本站。
 *
 * 同时接受 http 与 https：本地开发是 http，生产是 https，
 * 而「是不是外链」的判断依据是**主机名**，协议不影响。
 *
 * @param href    待判断的链接
 * @param selfHost 当前站点主机名（含端口，如 localhost:3000）
 */
export function isInternalLink(href: string, selfHost: string): boolean {
    try {
        const parsed = new URL(href);
        return parsed.host === selfHost;
    } catch {
        return false;
    }
}

/**
 * 把正文切成「文本 / 话题 / 提及 / 链接」片段。
 *
 * 与旧实现的区别：旧版用单个正则 split 处理话题和提及，
 * 现在多了链接，三种标记混在一起用 split 会互相干扰
 * （比如 `@user` 后面的链接会被误切），所以改成一次扫描。
 */
export function tokenizeContent(content: string): ContentToken[] {
    const tokens: ContentToken[] = [];

    // 先按 URL 切开，再对每一段非链接文本处理话题 / 提及
    let cursor = 0;
    const matches = [...content.matchAll(URL_PATTERN)];

    const pushText = (text: string) => {
        if (!text) return;
        // 话题 / 提及的切分沿用旧规则
        const parts = text.split(/(#[^\s#]+|@[^\s@]+)/g);
        for (const part of parts) {
            if (!part) continue;
            if (/^#[^\s#]+/.test(part)) {
                tokens.push({ type: "hashtag", value: part });
            } else if (/^@[^\s@]+/.test(part)) {
                tokens.push({ type: "mention", value: part });
            } else {
                tokens.push({ type: "text", value: part });
            }
        }
    };

    for (const match of matches) {
        const raw = match[0];
        const start = match.index ?? 0;
        const href = cleanUrl(raw);
        if (!href) continue;

        // 链接前面的普通文本
        pushText(content.slice(cursor, start));
        // value 用清理后的 href，而不是原始串：
        // 否则显示文本会带着尾部标点（`https://a.com。`），看起来像链接的一部分。
        tokens.push({ type: "link", value: href, href });
        // 尾部被剔除的标点要补回文本，否则会丢字
        cursor = start + href.length;
    }

    pushText(content.slice(cursor));
    return tokens;
}
