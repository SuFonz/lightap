import { getNotesByPreferredUsername } from "@/lib/db/objects";
import { getUserByPreferredUsername } from "@/lib/db/users";
import { htmlToPlainText } from "@/lib/activitypub/tools";
import { HttpError, PostResult } from "@/lib/types/http";

export const dynamic = "force-dynamic";

export async function GET(
    request: Request,
    { params }: { params: { username: string } }
) {
    const username = params.username;

    if (!username) {
        return Response.json({ error: "用户名为空" } satisfies HttpError, { status: 400 });
    }

    try {
        const user = await getUserByPreferredUsername(username);
        if (!user) {
            return Response.json({ error: "用户不存在" } satisfies HttpError, { status: 404 });
        }

        const notes = await getNotesByPreferredUsername(username, 50);

        return Response.json({
            posts: notes.map((note) => {
                return {
                    id: note.url,
                    authorUsername: username,
                    content: htmlToPlainText(note.content),
                    createdAt: note.created_at.toISOString(),
                    likes: 0,
                    likedByMe: false,
                    boosts: 0,
                    boostedByMe: false,
                    replies: [],
                };
            }),
        } satisfies PostResult);
    } catch (e) {
        console.error("get user posts failed:", e);
        return Response.json(
            { error: "获取帖子失败，请稍后重试" } satisfies HttpError,
            { status: 500 }
        );
    }
}
