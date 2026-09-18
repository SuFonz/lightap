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

export async function POST(request: Request) {
    // （当前实例）用户认证

    // 认证通过则递送

    // 存入数据库
}
