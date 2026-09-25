import { DurableObject, env } from "cloudflare:workers";


export interface RealtimeEvent<T = unknown> {
    type: string,
    data: T,
};

/**
 * 所有连接共用一个 DO 实例（单例 hub）。
 *
 * SSE 是长连接，只要连着 DO 就没法休眠、会一直计 duration；
 * 免费版额度有限，所以不要按用户拆成多个实例。
 */
const HUB = "realtime-hub";

/** 单个 SSE 订阅者 */
type Subscriber = {
    userId: number,
    write: (chunk: string) => void,
};

/**
 * 打开某个用户的 SSE 事件流，返回可直接 `return` 的 Response。
 *
 * vinext 侧（events 路由）只调用这个函数，不接触任何 Cloudflare API。
 */
export async function getRealtime(userId: number): Promise<Response> {
    const stub = env.SSO_DO.get(env.SSO_DO.idFromName(HUB));
    const url = new URL("https://realtime/subscribe");
    url.searchParams.set("userId", String(userId));
    return stub.fetch(url.toString());
}

/** 给某个用户推一条事件（业务代码调用，例如写通知之后） */
export async function publishEvent<T>(userId: number, event: RealtimeEvent<T>): Promise<void> {
    const stub = env.SSO_DO.get(env.SSO_DO.idFromName(HUB));
    await stub.fetch("https://realtime/broadcast", {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify({ userId, event }),
    });
}

export class SSODurableObject extends DurableObject {
    private subscribers = new Set<Subscriber>();

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // 内部广播：POST https://realtime/broadcast { userId, event }
        if (url.pathname === "/broadcast") {
            const { userId, event } = await request.json<{ userId: number, event: RealtimeEvent }>();
            this.broadcast(userId, event);
            return Response.json({ ok: true });
        }

        // 内部订阅：GET https://realtime/subscribe?userId=xxx
        if (url.pathname === "/subscribe") {
            return this.subscribe(Number(url.searchParams.get("userId")));
        }

        return new Response("Not found", {
            status: 404,
        });
    }

    private subscribe(userId: number): Response {
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

    private broadcast(userId: number, event: RealtimeEvent): void {
        const chunk = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
        for (const sub of this.subscribers) {
            if (sub.userId !== userId) continue;
            try {
                sub.write(chunk);
            } catch {
                this.subscribers.delete(sub);
            }
        }
    }
}
