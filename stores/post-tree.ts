import type { Post } from "@/lib/types/http";

export function updatePostTree(list: Post[], id: string, fn: (p: Post) => Post): Post[] {
    return list.map((p) => {
        if (p.id === id) return fn(p);
        if (p.replies.length > 0) return { ...p, replies: updatePostTree(p.replies, id, fn) };
        return p;
    });
}

export function findPostInTree(list: Post[], id: string): Post | undefined {
    for (const p of list) {
        if (p.id === id) return p;
        const nested = findPostInTree(p.replies, id);
        if (nested) return nested;
    }
    return undefined;
}

export function findPostPath(list: Post[], id: string): Post[] | null {
    for (const p of list) {
        if (p.id === id) return [p];
        const child = findPostPath(p.replies, id);
        if (child) return [p, ...child];
    }
    return null;
}
