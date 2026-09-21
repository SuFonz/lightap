import { notes, users } from "@/src/db/schema";
import { env } from "cloudflare:workers";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

const MAX_LIMIT = 50;

interface Item {
    uri: string,
    username: string,
    domain: string,
    content: string,
    inReplyTo: string | null,
    createdAt: number,
}

interface Params {
    id: string,
}

/**
 * TODO: 
 * 目前回复的话只是查询数据库里有的，
 * 未来打算查询远程服务器的，
 * 获取远程服务器的回复之后就存到数据库 
 */
export async function GET(
    request: Request,
    { params }: { params: Params },
) {
    // 根据当前 id 查询数据库
    const url = new URL(request.url);
    const db = drizzle(env.DB);
    const note = (await db.select().from(notes).where(eq(notes.uri, `${url.origin}/notes/${params.id}`)))[0];
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
        const parent = (await db.select().from(notes).where(eq(notes.uri, cursor.inReplyTo)))[0];
        if (!parent) {
            break;
        }
        chain.unshift(parent);
        cursor = parent;
    }

    // 查询哪个 note 引用了当前 note
    const replies = await db.select().from(notes).where(eq(notes.inReplyTo, note.uri));

    // 组装返回（只查本地实例）
    const items = [...chain, ...replies];
    const authors = await db.select().from(users).where(inArray(users.actorUrl, items.map(item => item.actor)));
    const nameByActor = new Map(authors.map(user => [user.actorUrl, user.username]));
    const data: Item[] = items.map(item => ({
        uri: item.uri,
        username: nameByActor.get(item.actor) ?? "",
        domain: url.host,
        content: item.content,
        inReplyTo: item.inReplyTo ?? null,
        createdAt: item.createdAt,
    }));

    // 返回
    return Response.json({
        chain: data.slice(0, chain.length),
        replies: data.slice(chain.length),
    }, {
        status: 200,
    });
}
