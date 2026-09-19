import { APOrderedCollection } from "@/src/activitypub/ap";

export const dynamic = "force-dynamic";

interface Params {
    username: string
}

export async function GET(request: Request) {
    // 返回占位符
    const data: APOrderedCollection = {
        id: "",
        summary: "",
        type: "OrderedCollection",
        totalItems: 0,
        orderedItems: [],
    };

    return Response.json(data, {
        status: 200
    });
}

// 不实现 POST /users/[username]/outbox
export async function POST(request: Request) {
    return new Response(null, {
        status: 501,
    });
}
