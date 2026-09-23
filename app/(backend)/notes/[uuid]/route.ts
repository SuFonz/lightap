import { AP_CONTEXT_PUBLIC } from "@/src/activitypub/ap";
import { buildNoteWithUri } from "@/src/activitypub/tools";
import { getDBClient } from "@/src/db";
import { notes } from "@/src/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface Params {
    uuid: string,
}

// 笔记对象端点：/notes/[uuid]，返回 ActivityPub Note（不是 Collection）
export async function GET(
    request: Request,
    { params }: { params: Params },
) {
    // 根据 uuid 查询数据库
    const db = getDBClient();
    const note = (await db.select().from(notes).where(eq(notes.uuid, params.uuid)))[0];
    if (!note) {
        return Response.json({
            error: "Note not found.",
        }, {
            status: 404,
        });
    }

    // 用 note.uri 作为 id（本地帖即当前请求地址），补齐对象字段
    const data = {
        ...buildNoteWithUri({
            uri: note.uri,
            content: note.content,
            inReplyTo: note.inReplyTo ?? undefined,
        }),
        attributedTo: note.actor,
        published: new Date(note.createdAt * 1000).toISOString(),
        to: [AP_CONTEXT_PUBLIC],
    };

    // 返回
    return Response.json(data, {
        status: 200,
        headers: {
            "Content-Type": "application/activity+json",
        },
    });
}
