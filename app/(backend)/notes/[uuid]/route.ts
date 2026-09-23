import { AP_CONTEXT_PUBLIC } from "@/src/activitypub/ap";
import { buildNoteWithUri, buildTombstone } from "@/src/activitypub/tools";
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
    // 浏览器直接访问对象地址（Accept 带 text/html）时跳到人类可读页面；
    // ActivityPub 客户端带 activity+json/ld+json，仍返回 JSON 对象。
    const accept = request.headers.get("accept") ?? "";
    const wantsHtml = accept.includes("text/html")
        && !accept.includes("application/activity+json")
        && !accept.includes("application/ld+json");
    if (wantsHtml) {
        return Response.redirect(`${new URL(request.url).origin}/post/${params.uuid}`, 302);
    }

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

    // 已删除：返回 410 Gone + Tombstone（id 与原对象 uri 相同）
    if (note.deletedAt) {
        const tombstone = buildTombstone({
            id: note.uri,
            formerType: "Note",
        });
        return Response.json(tombstone, {
            status: 410,
            headers: {
                "Content-Type": "application/activity+json",
            },
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
