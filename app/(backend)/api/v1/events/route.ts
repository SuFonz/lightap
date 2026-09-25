import { resolveRequestUser } from "@/src/lib/auth";
import { getRealtime } from "@/src/realtime/sse";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const user = await resolveRequestUser(request);
    if (!user) {
        return Response.json({
            error: "Unauthorized.",
        }, {
            status: 401,
        });
    }

    return getRealtime(user.id);
}
