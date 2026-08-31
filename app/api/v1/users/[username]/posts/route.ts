import { getNotesByPreferredUsername } from "@/lib/db/objects";
import { getUserByPreferredUsername } from "@/lib/db/users";

export const dynamic = "force-dynamic";

// AP Note 的 content 可能是 HTML，转成纯文本供前端直接渲染
function toPlainText(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .trim();
}

export async function GET(
    request: Request,
    { params }: { params: { username: string } }
) {
    const username = params.username;

    if (!username) {
        return Response.json({ error: "用户名为空" }, { status: 400 });
    }

    try {
        const user = await getUserByPreferredUsername(username);
        if (!user) {
            return Response.json({ error: "用户不存在" }, { status: 404 });
        }

        const notes = await getNotesByPreferredUsername(username, 50);

        return Response.json({
            posts: notes.map((note) => {
                const id = note.id.split("/").pop() ?? note.id;
                return {
                    id,
                    authorUsername: username,
                    content: toPlainText(note.content),
                    createdAt: note.created_at.toISOString(),
                    likes: 0,
                    likedByMe: false,
                    boosts: 0,
                    boostedByMe: false,
                    replies: [],
                };
            }),
        });
    } catch (e) {
        console.error("get user posts failed:", e);
        return Response.json(
            { error: "获取帖子失败，请稍后重试" },
            { status: 500 }
        );
    }
}
