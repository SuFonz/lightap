import type { NoteItem, Post, PostListItem } from "@/web/types";

export interface RememberUserInput {
    username: string;
    domain?: string | null;
    displayName?: string;
    avatarUrl?: string;
}

export type RememberUser = (input: RememberUserInput) => void;

export function makePost(
    id: string,
    authorUsername: string,
    content: string,
    createdAt: string,
    inReplyTo?: string,
): Post {
    return {
        id,
        authorUsername,
        content,
        inReplyTo,
        createdAt,
        replies: [],
        repliesCount: 0,
        likes: 0,
        boosts: 0,
        likedByMe: false,
        boostedByMe: false,
    };
}

/** note uri 形如 https://host/notes/<uuid>，取最后一段作为本地 id（详情按 uuid 查） */
export function idFromUri(uri: string): string {
    return uri.split("/").pop() ?? uri;
}

export function fromListItem(item: PostListItem): Post {
    return {
        ...makePost(
            idFromUri(item.uri),
            item.username,
            item.content,
            new Date(item.createdAt * 1000).toISOString(),
            item.inReplyTo ?? undefined,
        ),
        cursorId: item.id,
        repliesCount: item.repliesCount,
    };
}

export function fromNoteItem(item: NoteItem): Post {
    return {
        ...makePost(
            idFromUri(item.uri),
            item.username,
            item.content,
            new Date(item.createdAt * 1000).toISOString(),
            item.inReplyTo ?? undefined,
        ),
        repliesCount: item.repliesCount,
    };
}

/** 把作者信息记进 directory store，顺便支持增量分页 */
export function rememberAuthors(items: PostListItem[], rememberUser: RememberUser): void {
    for (const item of items) {
        rememberUser({
            username: item.username,
            domain: item.domain,
            displayName: item.displayName,
            avatarUrl: item.avatarUrl,
        });
    }
}

/** 追加去重，按 id 过滤掉已存在的帖子 */
export function appendUnique(posts: Post[], next: Post[]): Post[] {
    if (next.length === 0) return posts;
    const seen = new Set(posts.map((post) => post.id));
    const merged = [...posts];
    for (const post of next) {
        if (seen.has(post.id)) continue;
        seen.add(post.id);
        merged.push(post);
    }
    return merged;
}

export function findPost(posts: Post[], id: string): Post | undefined {
    for (const post of posts) {
        if (post.id === id) return post;
        const nested = findPost(post.replies, id);
        if (nested) return nested;
    }
    return undefined;
}

export function mapPost(posts: Post[], id: string, updater: (post: Post) => Post): Post[] {
    return posts.map((post) => {
        if (post.id === id) return updater(post);
        if (post.replies.length === 0) return post;
        return { ...post, replies: mapPost(post.replies, id, updater) };
    });
}
