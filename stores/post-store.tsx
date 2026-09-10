"use client";

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import * as api from "@/lib/client/api";
import type { Post } from "@/lib/types/http";
import { findPostInTree, findPostPath, updatePostTree } from "./post-tree";
import { useUserStore } from "./user-store";

interface PostStoreValue {
    posts: Post[];
    getPost: (postId: string) => Post | undefined;
    getPostPath: (postId: string) => Post[] | null;
    addPost: (content: string) => Promise<void>;
    addReply: (postId: string, content: string) => Promise<void>;
    toggleLike: (postId: string) => Promise<void>;
    toggleBoost: (postId: string) => Promise<void>;
}

const PostStoreContext = createContext<PostStoreValue | null>(null);

export function PostStoreProvider({ children }: { children: ReactNode }) {
    const { currentUser, incrementPostsCount } = useUserStore();
    const [posts, setPosts] = useState<Post[]>([]);

    const getPost = useCallback(
        (postId: string) => findPostInTree(posts, postId),
        [posts],
    );

    const getPostPath = useCallback(
        (postId: string) => findPostPath(posts, postId),
        [posts],
    );

    const addPost = useCallback(
        async (content: string) => {
            const post = await api.createPost(currentUser.username, content);
            setPosts((prev) => [post, ...prev]);
            incrementPostsCount(currentUser.username, 1);
        },
        [currentUser.username, incrementPostsCount],
    );

    const addReply = useCallback(
        async (postId: string, content: string) => {
            const reply = await api.createReply(postId, currentUser.username, content);
            setPosts((prev) =>
                updatePostTree(prev, postId, (p) => ({ ...p, replies: [...p.replies, reply] })),
            );
        },
        [currentUser.username],
    );

    const toggleLike = useCallback(
        async (postId: string) => {
            setPosts((prev) =>
                updatePostTree(prev, postId, (p) => {
                    if (p.authorUsername === currentUser.username) return p;
                    const liked = !p.likedByMe;
                    void api.toggleLike(postId, liked);
                    return { ...p, likedByMe: liked, likes: p.likes + (liked ? 1 : -1) };
                }),
            );
        },
        [currentUser.username],
    );

    const toggleBoost = useCallback(
        async (postId: string) => {
            setPosts((prev) =>
                updatePostTree(prev, postId, (p) => {
                    if (p.authorUsername === currentUser.username) return p;
                    const boosted = !p.boostedByMe;
                    void api.toggleBoost(postId, boosted);
                    return { ...p, boostedByMe: boosted, boosts: p.boosts + (boosted ? 1 : -1) };
                }),
            );
        },
        [currentUser.username],
    );

    const value = useMemo<PostStoreValue>(
        () => ({
            posts,
            getPost,
            getPostPath,
            addPost,
            addReply,
            toggleLike,
            toggleBoost,
        }),
        [posts, getPost, getPostPath, addPost, addReply, toggleLike, toggleBoost],
    );

    return <PostStoreContext.Provider value={value}>{children}</PostStoreContext.Provider>;
}

export function usePostStore() {
    const ctx = useContext(PostStoreContext);
    if (!ctx) throw new Error("usePostStore must be used within PostStoreProvider");
    return ctx;
}
