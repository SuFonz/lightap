import { notes, users } from "@/src/db/schema";
import { getDBClient } from "@/src/db";
import { buildNoteWithUri } from "@/src/activitypub/tools";
import { deserializeAttachments } from "@/src/lib/attachments";
import { and, eq, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface Params {
    uuid: string,
}

/**
 * 帖子的 ActivityPub 表示：GET /api/v1/notes/[uuid]/activity
 *
 * `/notes/[uuid]` 的内容协商出口：浏览器走页面，带 `Accept: application/activity+json`
 * 的请求由 proxy 重写到这里（同一路径不能同时有 page.tsx 和 route.ts）。
 */
export async function GET(
    request: Request,
    { params }: { params: Params },
) {
    const db = getDBClient();

    const note = (await db.select().from(notes).where(
        and(
            eq(notes.uuid, params.uuid),
            isNull(notes.deletedAt),
        ),
    ))[0];

    if (!note) {
        return Response.json({
            error: "Note not found.",
        }, {
            status: 404,
        });
    }

    const author = (await db.select().from(users).where(eq(users.actorUrl, note.actor)))[0];

    // 内部 kind 还原成 AP type：优先用原始 apType，没有才按 kind 映射
    const AP_TYPE: Record<string, string> = {
        image: "Image", video: "Video", audio: "Audio", document: "Document",
    };
    const attachments = deserializeAttachments(note.attachment).map(item => ({
        type: item.apType ?? AP_TYPE[item.kind] ?? "Document",
        url: item.url,
        mediaType: item.mediaType,
        name: item.name,
        width: item.width,
        height: item.height,
        sensitive: item.sensitive || undefined,
    }));

    return Response.json({
        ...buildNoteWithUri({
            uri: note.uri,
            content: note.content,
            inReplyTo: note.inReplyTo ?? undefined,
            cc: author ? [`${author.actorUrl}/followers`] : [],
        }),
        attributedTo: note.actor,
        published: new Date(note.createdAt * 1000).toISOString(),
        attachment: attachments,
    }, {
        status: 200,
        headers: {
            "Content-Type": "application/activity+json",
            "Cache-Control": "public, max-age=60",
        },
    });
}
