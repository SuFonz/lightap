import { listFollows } from "@/src/lib/follows";

export const dynamic = "force-dynamic";

interface Params {
    username: string,
}

/** 正在关注：GET /api/v1/users/[username]/following */
export async function GET(
    request: Request,
    { params }: { params: Params },
) {
    const url = new URL(request.url);
    const domain = url.searchParams.get("domain") ?? url.host;
    const result = await listFollows({
        username: params.username,
        domain,
        direction: "following",
        limit: Number(url.searchParams.get("limit")) || undefined,
        maxId: Number(url.searchParams.get("maxId")) || undefined,
    });

    if (!result) {
        return Response.json({ error: "User not found." }, { status: 404 });
    }

    return Response.json(result, { status: 200 });
}
