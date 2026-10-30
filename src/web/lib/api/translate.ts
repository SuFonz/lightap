/**
 * 翻译接口客户端（SSE 流式）。
 *
 * 为什么不用 `client.ts` 的 `request()`：那个封装假设响应是 JSON，
 * 而这里是 `text/event-stream`，需要逐块读取并解析事件。
 */

export interface TranslateStreamHandlers {
    /** 收到一段译文（可能多次调用） */
    onDelta: (delta: string) => void;
    /**
     * 服务端要求替换已累积的全部内容。
     *
     * 为什么需要：流式是逐段发出去的，服务端无法回溯修改已发送的内容。
     * 翻译结束时若需要清理（比如模型加了引号或「译文：」前缀），
     * 就发这个事件让前端整体替换。
     */
    onReplace?: (text: string) => void;
    /** 流正常结束（含服务端走了降级路径的情况） */
    onDone: () => void;
    /** 出错（HTTP 错误或服务端发来的 error 事件） */
    onError: (message: string) => void;
}

/** 把服务端发来的一行 `data:` 内容取出来 */
function parseEventBlock(block: string): { event: string; data: string } | null {
    let event = "message";
    const dataLines: string[] = [];

    for (const line of block.split("\n")) {
        if (!line) continue;
        // 注意：SSE 规范是 `data: xxx`，冒号后那一个空格要去掉，
        // 但**内容本身的首尾空格不能 trim** —— 否则增量里的空格会丢失，
        // 拼出来的译文就会变成 "Helloworld" 这样连在一起。
        if (line.startsWith("event:")) {
            event = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).replace(/^ /, ""));
        }
    }

    if (dataLines.length === 0 && event === "message") return null;
    return { event, data: dataLines.join("\n") };
}

/**
 * 请求翻译，边收边回调。
 *
 * @returns 中止函数：用户切换「显示原文」时应该中断请求，避免浪费配额
 */
export function streamTranslate(
    body: { text: string; to: string },
    handlers: TranslateStreamHandlers,
): () => void {
    const controller = new AbortController();

    void (async () => {
        try {
            const res = await fetch("/api/v1/translate", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            // 未配置 / 参数错误：响应是 JSON 而不是流
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                handlers.onError(
                    (data as { error?: string } | null)?.error ?? `翻译失败（${res.status}）`,
                );
                return;
            }

            if (!res.body) {
                handlers.onError("翻译服务未返回内容");
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // SSE 事件之间用空行分隔
                    const blocks = buffer.split("\n\n");
                    buffer = blocks.pop() ?? "";

                    for (const block of blocks) {
                        const parsed = parseEventBlock(block);
                        if (!parsed) continue;

                        if (parsed.event === "delta") {
                            // delta 是纯文本，直接回调（省一次 JSON 解析）
                            handlers.onDelta(parsed.data);
                        } else if (parsed.event === "replace") {
                            // 服务端要求整体替换（清理引号/前缀后）
                            handlers.onReplace?.(parsed.data);
                        } else if (parsed.event === "done") {
                            handlers.onDone();
                        } else if (parsed.event === "error") {
                            let msg = "翻译失败";
                            try {
                                msg = (JSON.parse(parsed.data) as { error?: string }).error ?? msg;
                            } catch {
                                // 不是 JSON 就用默认文案
                            }
                            handlers.onError(msg);
                        }
                        // meta 事件暂时不需要（前端已知目标语言）
                    }
                }
            } finally {
                reader.releaseLock();
            }
        } catch (error: any) {
            // 用户主动中止不算错误
            if (error?.name === "AbortError") return;
            handlers.onError("翻译请求失败");
        }
    })();

    return () => controller.abort();
}
