import { notes, users } from "@/src/db/schema";
import { env } from "cloudflare:workers";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

export const dynamic = "force-dynamic";

interface Params {
    uuid: string,
}

export async function GET(
    request: Request,
    { params }: { params: Params }
) {
    // 根据当前 uuid 查询数据库
    const url = new URL(request.url);
    const db = drizzle(env.DB);
    const note = (await db.select().from(notes).where(eq(notes.uri, `${url.origin}/notes/${params.uuid}`)))[0];
    if (!note) {
        return Response.json({
            error: "Note not found.",
        }, {
            status: 404,
        });
    }

    // 向上追溯父 note，得到 [顶层, ..., 当前] 的线程
    const chain = [note];
    let cursor = note;
    while (cursor.inReplyTo) {
        const parent = (await db.select().from(notes).where(eq(notes.id, cursor.inReplyTo)))[0];
        if (!parent) {
            break;
        }
        chain.unshift(parent);
        cursor = parent;
    }

    // 查询哪个 note 引用了当前 note
    const replies = await db.select().from(notes).where(eq(notes.inReplyTo, note.id));

    // 组装返回（只查本地实例）
    const items = [...chain, ...replies];
    const authors = await db.select().from(users).where(inArray(users.actorUrl, items.map(item => item.actor)));
    const uriById = new Map(chain.map(item => [item.id, item.uri]));
    const nameByActor = new Map(authors.map(user => [user.actorUrl, user.username]));
    const data = items.map(item => ({
        username: nameByActor.get(item.actor) ?? "",
        domain: url.host,
        content: item.content,
        inReplyTo: item.inReplyTo ? uriById.get(item.inReplyTo) ?? null : null,
    }));

    // 返回
    return Response.json({
        chain: data.slice(0, chain.length),
        replies: data.slice(chain.length),
    }, {
        status: 200,
    });
}
