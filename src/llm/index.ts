import { env } from "cloudflare:workers";

/**
 * LLM 封装（OpenAI 兼容接口）。
 *
 * 只依赖三个配置，换厂商**只改环境变量、不动代码**：
 * - `LLM_BASE_URL`：接口地址，如 `https://api.openai.com/v1`
 * - `LLM_API_KEY`：密钥
 * - `LLM_MODEL`：默认模型，如 `gpt-4o-mini`
 *
 * 常见的兼容厂商（填对应的 baseUrl 即可）：
 * - OpenAI          `https://api.openai.com/v1`
 * - DeepSeek        `https://api.deepseek.com/v1`
 * - Groq            `https://api.groq.com/openai/v1`
 * - OpenRouter      `https://openrouter.ai/api/v1`
 * - Workers AI      `https://api.cloudflare.com/client/v4/accounts/<account_id>/ai/v1`
 *
 * 与 `src/bot-detection` 一样是**可选功能**：没配置时 `isLLMEnabled()` 返回 false，
 * 调用方据此跳过（例如翻译退回原文），不影响主流程。
 */

/** 默认模型（只在没配 LLM_MODEL 时用） */
const DEFAULT_MODEL = "gpt-4o-mini";

/** 默认超时：LLM 响应慢，但也不能无限等 */
const DEFAULT_TIMEOUT_MS = 30_000;

// ── 类型 ────────────────────────────────────────────────────

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
    role: ChatRole;
    content: string;
}

export interface ChatOptions {
    /** 模型名，默认取 `LLM_MODEL` */
    model?: string;
    messages: ChatMessage[];
    /** 采样温度，翻译这类确定性任务建议 0~0.3 */
    temperature?: number;
    /** 最大输出 token 数 */
    maxTokens?: number;
    /** 自定义超时（毫秒），默认 30s */
    timeoutMs?: number;
}

export interface ChatResult {
    /** 模型返回的正文（已去掉首尾空白） */
    text: string;
    /** 实际使用的模型名 */
    model: string;
}

/** LLM 调用失败时抛出的错误 */
export class LLMError extends Error {
    /** 失败阶段：config（未配置）/ request（网络或超时）/ response（上游返回异常） */
    readonly stage: "config" | "request" | "response";

    constructor(message: string, stage: LLMError["stage"]) {
        super(message);
        this.name = "LLMError";
        this.stage = stage;
    }
}

// ── 配置 ────────────────────────────────────────────────────

/**
 * 读取配置。
 *
 * `env` 的静态类型来自 wrangler 自动生成的 `Cloudflare.Env`，
 * 通过 secret / vars 配置的普通变量不在里面，所以这里收窄一次。
 */
function llmConfig(): {
    baseUrl: string;
    apiKey: string;
    model: string;
} {
    const raw = env as unknown as {
        LLM_BASE_URL?: string;
        LLM_API_KEY?: string;
        LLM_MODEL?: string;
    };
    return {
        // 去掉结尾斜杠，避免拼出 `//chat/completions`
        baseUrl: (raw.LLM_BASE_URL ?? "").trim().replace(/\/+$/, ""),
        apiKey: (raw.LLM_API_KEY ?? "").trim(),
        model: (raw.LLM_MODEL ?? "").trim() || DEFAULT_MODEL,
    };
}

/** LLM 功能是否可用（baseUrl 与 apiKey 都配了才算） */
export function isLLMEnabled(): boolean {
    const { baseUrl, apiKey } = llmConfig();
    return Boolean(baseUrl && apiKey && env.CF_AIG_GATEWAY_ID);
}

// ── 内部工具 ────────────────────────────────────────────────

/** 构造请求体（非流式与流式只差 stream 标志） */
function buildBody(options: ChatOptions, model: string, stream: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
        model,
        messages: options.messages.map(m => ({ role: m.role, content: m.content })),
        ...(stream ? { stream: true } : {}),
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    return body;
}

/** 发起请求，统一处理超时 */
async function request(
    path: string,
    body: unknown,
    timeoutMs?: number,
): Promise<Response> {
    const { baseUrl, apiKey } = llmConfig();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
        return await fetch(`${baseUrl}${path}`, {
            method: "POST",
            headers: {
                "cf-aig-gateway-id": env.CF_AIG_GATEWAY_ID,
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
    } catch (error: any) {
        // AbortError 说明超时，其余是网络问题
        throw new LLMError(
            error?.name === "AbortError" ? "LLM 请求超时" : "LLM 请求失败",
            "request",
        );
    } finally {
        clearTimeout(timer);
    }
}

/** OpenAI 兼容响应里用到的字段 */
interface CompletionResponse {
    model?: string;
    choices?: {
        message?: { content?: string | null };
        delta?: { content?: string | null };
    }[];
    error?: { message?: string } | string;
}

/**
 * 从非流式响应里取正文。
 * 兼容 `choices[0].message.content`，个别厂商会多包一层 `{ data: ... }`。
 */
function extractText(body: unknown): string | undefined {
    if (!body || typeof body !== "object") return undefined;
    const rec = body as CompletionResponse & { data?: CompletionResponse };

    const content = rec.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;

    // 少数厂商会包一层 data
    const nested = rec.data?.choices?.[0]?.message?.content;
    if (typeof nested === "string") return nested;

    return undefined;
}

/** 从单行 SSE JSON 里取增量文本 */
function extractDelta(payload: unknown): string | undefined {
    if (!payload || typeof payload !== "object") return undefined;
    const delta = (payload as CompletionResponse).choices?.[0]?.delta?.content;
    return typeof delta === "string" ? delta : undefined;
}

/** 把上游错误体转成一句话 */
function describeError(body: unknown): string | undefined {
    if (!body || typeof body !== "object") return undefined;
    const err = (body as CompletionResponse).error;
    if (typeof err === "string") return err.slice(0, 200);
    if (err && typeof err === "object" && typeof err.message === "string") {
        return err.message.slice(0, 200);
    }
    return undefined;
}

/**
 * 解析 SSE 流，产出增量文本。
 *
 * 各家兼容接口的流式格式都是 SSE，只是每行 JSON 结构可能有差异。
 * 这里把「切行 / 解码 / 跳过 [DONE]」的公共部分收好。
 */
async function* parseStream(stream: ReadableStream): AsyncGenerator<string, void, unknown> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // 按行切分：保留最后一段（可能是不完整的行）
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data:")) continue;

                const payload = trimmed.slice(5).trim();
                if (!payload || payload === "[DONE]") continue;

                let parsed: unknown;
                try {
                    parsed = JSON.parse(payload);
                } catch {
                    // 不是 JSON 的行（注释、心跳）跳过
                    continue;
                }

                const delta = extractDelta(parsed);
                if (delta) yield delta;
            }
        }
    } finally {
        reader.releaseLock();
    }
}

// ── 对外入口 ────────────────────────────────────────────────

/**
 * 调用 LLM（非流式），返回完整文本。
 *
 * 未配置时**抛错**而不是静默返回空串：
 * 调用方应该能区分「没启用」和「调用失败」。
 * 如果希望「未启用就静默降级」，先调 `isLLMEnabled()` 判断。
 */
export async function chat(options: ChatOptions): Promise<ChatResult> {
    if (!isLLMEnabled()) {
        throw new LLMError("LLM 未配置（缺少 LLM_BASE_URL 或 LLM_API_KEY）", "config");
    }

    const { model: defaultModel } = llmConfig();
    const model = options.model ?? defaultModel;

    const res = await request(
        "/chat/completions", 
        buildBody(options, model, false), options.timeoutMs,
    );

    const raw = await res.text();
    let body: unknown = null;
    try {
        body = raw ? JSON.parse(raw) : null;
    } catch {
        // 不是 JSON（比如网关返回 HTML 错误页），下面按状态码报错
    }

    if (!res.ok) {
        throw new LLMError(
            `LLM 调用失败（HTTP ${res.status}${describeError(body) ? `：${describeError(body)}` : ""}）`,
            "response",
        );
    }

    const text = extractText(body);
    if (!text) {
        throw new LLMError("LLM 返回空内容", "response");
    }

    return {
        text: text.trim(),
        model: (body as CompletionResponse)?.model ?? model,
    };
}

/**
 * 调用 LLM（流式），返回增量文本的异步迭代器。
 *
 * ```ts
 * for await (const delta of chatStream({ messages })) {
 *     // 每收到一段文本
 * }
 * ```
 *
 * 需要透传给前端（SSE）时用 `onToken` 边收边转发：
 * ```ts
 * await chatStream({ messages, onToken: (t) => controller.enqueue(...) });
 * ```
 */
export async function* chatStream(
    options: ChatOptions & {
        /** 每收到一段增量文本就回调（用于 SSE 透传） */
        onToken?: (delta: string) => void;
    },
): AsyncGenerator<string, void, unknown> {
    if (!isLLMEnabled()) {
        throw new LLMError("LLM 未配置（缺少 LLM_BASE_URL 或 LLM_API_KEY）", "config");
    }

    const { model: defaultModel } = llmConfig();
    const model = options.model ?? defaultModel;

    const res = await request("/chat/completions", buildBody(options, model, true), options.timeoutMs);

    if (!res.ok) {
        // 流式失败时上游通常仍返回 JSON 错误体
        const raw = await res.text().catch(() => "");
        let detail: string | undefined;
        try {
            detail = describeError(JSON.parse(raw));
        } catch {
            detail = raw.slice(0, 200) || undefined;
        }
        throw new LLMError(
            `LLM 流式调用失败（HTTP ${res.status}${detail ? `：${detail}` : ""}）`,
            "response",
        );
    }

    if (!res.body) {
        throw new LLMError("LLM 未返回流式响应", "response");
    }

    for await (const delta of parseStream(res.body)) {
        options.onToken?.(delta);
        console.log(delta);
        yield delta;
    }
}
