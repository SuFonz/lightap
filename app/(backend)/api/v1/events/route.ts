import { resolveRequestUser } from "@/src/lib/auth";
import { getRealtime } from "@/src/realtime/sse";

export const dynamic = "force-dynamic";

/**
 * SSE 事件流：GET /api/v1/events
 *
 * 可选认证：登录了（cookie 有效）带 userId；未登录按访客处理（userId = null），
 * 访客也能收公共事件。身份由 proxy 中间件从 cookie 解析后注入 x-user-id。
 */
export async function GET(request: Request) {
    const user = await resolveRequestUser(request);
    return getRealtime(user?.id ?? null);
}
