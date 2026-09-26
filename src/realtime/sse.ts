import { DurableObject, env } from "cloudflare:workers";


export interface RealtimeEvent<T = unknown> {
    type: string,
    data: T,
};

/**
 * 广播的接收对象：
 * - user：只发给某个登录用户
 * - authenticated：所有登录用户
 * - guests：所有访客（未登录）
 * - all：所有人（用户 + 访客）
 */
export type RealtimeAudience =
    | { type: "user"; userId: number }
    | { type: "users"; userIds: number[] }
    | { type: "authenticated" }
    | { type: "guests" }
    | { type: "all" };

/**
 * 所有连接共用一个 DO 实例（单例 hub）。
 *
 * SSE 是长连接，只要连着 DO 就没法休眠、会一直计 duration；
 * 免费版额度有限，所以不要按用户拆成多个实例。
 */
const HUB = "realtime-hub";

/** 单个 SSE 订阅者；userId 为 null 表示访客 */
type Subscriber = {
    userId: number | null,
    write: (chunk: string) => void,
};

/**
 * 打开 SSE 事件流，返回可直接 `return` 的 Response。
 *
 * @param userId 登录用户 id；`null` 表示访客。
 */
export async function getRealtime(userId: number | null): Promise<Response> {
    const stub = env.SSE_DO.get(env.SSE_DO.idFromName(HUB));
    const url = new URL("https://realtime/subscribe");
    if (userId !== null) {
        url.searchParams.set("userId", String(userId));
    }
    return stub.fetch(url.toString());
}

/**
 * 广播一条事件给指定受众。
 *
 * @example
 * publishEvent({ type: "notification.created", data }, { type: "user", userId });
 * publishEvent({ type: "note.created", data }, { type: "all" });
 */
export async function publishEvent<T>(event: RealtimeEvent<T>, audience: RealtimeAudience): Promise<void> {
    const stub = env.SSE_DO.get(env.SSE_DO.idFromName(HUB));
    await stub.fetch("https://realtime/broadcast", {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify({ audience, event }),
    });
}

/** 判断某个订阅者是否属于该受众 */
function matches(subscriber: Subscriber, audience: RealtimeAudience): boolean {
    switch (audience.type) {
        case "user":
            return subscriber.userId === audience.userId;
        case "users":
            return subscriber.userId !== null && audience.userIds.includes(subscriber.userId);
        case "authenticated":
            return subscriber.userId !== null;
        case "guests":
            return subscriber.userId === null;
        case "all":
            return true;
    }
}

export class SSEDurableObject extends DurableObject {
    private subscribers = new Set<Subscriber>();

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // 内部广播：POST https://realtime/broadcast { audience, event }
        if (url.pathname === "/broadcast") {
            const { audience, event } = await request.json<{ audience: RealtimeAudience, event: RealtimeEvent }>();
            this.broadcast(event, audience);
            return Response.json({ ok: true });
        }

        // 内部订阅：GET https://realtime/subscribe（登录用户带 ?userId=xxx，访客不带）
        if (url.pathname === "/subscribe") {
            const raw = url.searchParams.get("userId");
            const parsed = raw ? Number(raw) : NaN;
            const userId = Number.isInteger(parsed) ? parsed : null;
            return this.subscribe(userId);
        }

        return new Response("Not found", {
            status: 404,
        });
    }

    private subscribe(userId: number | null): Response {
        const encoder = new TextEncoder();
        const subscriber: Subscriber = {
            userId,
            write: () => {},
        };

        const stream = new ReadableStream<Uint8Array>({
            start: (controller) => {
                subscriber.write = (chunk) => controller.enqueue(encoder.encode(chunk));
                this.subscribers.add(subscriber);
                controller.enqueue(encoder.encode(": connected\n\n"));
            },
            cancel: () => {
                this.subscribers.delete(subscriber);
            },
        });

        return new Response(stream, {
            headers: {
                "content-type": "text/event-stream; charset=utf-8",
                "cache-control": "no-cache, no-transform",
                "x-accel-buffering": "no",
            },
        });
    }

    private broadcast(event: RealtimeEvent, audience: RealtimeAudience): void {
        const chunk = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
        for (const subscriber of this.subscribers) {
            if (!matches(subscriber, audience)) continue;
            try {
                subscriber.write(chunk);
            } catch {
                this.subscribers.delete(subscriber);
            }
        }
    }
}
