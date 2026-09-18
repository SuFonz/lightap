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
    // 获取 Actor

    // 验证签名

    // 签名通过则接收

    // 根据类型进行处理

    // 存入数据库
}
