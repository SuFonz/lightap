import { chatStream, isLLMEnabled } from "@/src/llm";
import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

interface Body {
    /** 要翻译的文本 */
    text: string;
    /** 目标语言，如 `zh` / `en`；不传则用当前实例默认语言 */
    to?: string;
}

/** 语言代码 → 自然语言名，供 prompt 使用 */
const LANGUAGE_NAMES: Record<string, string> = {
    zh: "Simplified Chinese",
    "zh-CN": "Simplified Chinese",
    "zh-TW": "Traditional Chinese",
    en: "English",
    ja: "Japanese",
    ko: "Korean",
    fr: "French",
    de: "German",
    es: "Spanish",
    ru: "Russian",
    pt: "Portuguese",
    it: "Italian",
    ar: "Arabic",
};

/** 单次翻译的字符上限：太长容易超出模型上下文，也拖慢响应 */
const MAX_CHARS = 2000;

/**
 * 翻译接口：POST /api/v1/translate
 *
 * 返回 **SSE 流**，前端边收边显示译文（不用等整段生成完）。
 *
 * 事件格式：
 * - `event: meta`   → `{"to":"..."}`，流开始前先发一次
 * - `event: delta`  → 一段译文（纯文本，不是 JSON，省一次解析）
 * - `event: done`   → 结束标记
 * - `event: error`  → `{"error":"..."}`，出错时发一次然后关闭
 *
 * 为什么用 SSE 而不是 WebSocket：翻译是单向、短生命周期的请求，
 * SSE 更轻，也天然兼容 HTTP 基础设施（CDN、代理都不会拦）。
 */
export async function POST(request: Request) {
    let body: Body;
    try {
        body = await request.json<Body>();
    } catch {
        return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    console.log(body);

    const text = typeof body?.text === "string" ? body.text : "";
    if (!text.trim()) {
        return Response.json({ error: "Text cannot be empty." }, { status: 400 });
    }

    // 目标语言：请求里指定优先，否则用实例默认（与界面语言一致）
    const to = body.to || (env as unknown as { DEFAULT_LOCALE?: string }).DEFAULT_LOCALE || "zh";

    // LLM 未配置：明确告诉前端「这个功能不可用」，而不是让它等一个空流
    if (!isLLMEnabled()) {
        return Response.json({ error: "Translation is not configured." }, { status: 503 });
    }

    // 超长文本截断：宁可翻一半，也不要请求失败
    const input = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (event: string, data: string) => {
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
            };

            try {
                // 先发 meta，前端可以据此显示「正在翻译成 xx」
                send("meta", JSON.stringify({ to }));

                // 流式收集译文：边收边推给前端，同时累积完整文本
                let acc = "";
                for await (const delta of chatStream({
                    messages: [
                        { role: "system", content: buildSystemPrompt(to) },
                        { role: "user", content: input },
                    ],
                    // 翻译是确定性任务，温度给 0 减少随机性
                    temperature: 0,
                    maxTokens: 4096,
                })) {
                    acc += delta;
                    send("delta", delta);
                }

                // 清理模型可能加的引号 / 前缀。
                // 流式已经逐段发完了，这里无法再改前面发出去的内容，
                // 所以只在「清理后与原文不同」时补发一个修正事件，
                // 由前端用它替换掉已累积的内容。
                const cleaned = stripWrapper(acc);
                if (cleaned !== acc) {
                    send("replace", cleaned);
                }

                send("done", "");
            } catch (error: any) {
                send("error", JSON.stringify({ error: error?.message ?? "Translation failed." }));
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        status: 200,
        headers: {
            "content-type": "text/event-stream; charset=utf-8",
            // SSE 必须禁用缓冲，否则会攒一批才发
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
        },
    });
}

/** 把语言代码转成 prompt 里用的名字；未知代码原样使用 */
function languageName(code: string): string {
    return LANGUAGE_NAMES[code] ?? code;
}

/** 构造翻译用的 system prompt */
function buildSystemPrompt(to: string, from?: string): string {
    const sourceHint = from ? ` from ${languageName(from)}` : "";
    return [
        `Translate the following text${sourceHint} to ${languageName(to)}.`,
        "Output ONLY the translation, with no explanation, quotes, or labels.",
        "Preserve line breaks and any @mentions or #hashtags exactly as written.",
    ].join(" ");
}

/**
 * 清理模型输出的包装。
 *
 * 即使 prompt 说了「只输出译文」，模型有时仍会：
 * - 用引号把整段包起来
 * - 加「译文：」/「Translation:」前缀
 * 这些都是噪声，去掉。
 */
function stripWrapper(output: string): string {
    let text = output.trim();

    // 去掉「译文：」「Translation:」这类前缀
    text = text.replace(/^(译文|翻译|translation|translated text)\s*[:：]\s*/i, "");

    // 去掉整体包裹的引号（成对出现才算）
    const pairs: [string, string][] = [
        ['"', '"'],
        ["'", "'"],
        ["「", "」"],
        ["『", "』"],
        ["“", "”"],
    ];
    for (const [open, close] of pairs) {
        if (text.startsWith(open) && text.endsWith(close) && text.length > open.length + close.length) {
            text = text.slice(open.length, -close.length).trim();
            break;
        }
    }

    return text;
}
