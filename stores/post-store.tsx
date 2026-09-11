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
import { findPostInTree, findPostPath } from "./post-tree";
import { useAuthStore } from "./auth-store";
import { useUserStore } from "./user-store";

interface PostStoreValue {
    posts: Post[];
    getPost: (postId: string) => Post | undefined;
    getPostPath: (postId: string) => Post[] | null;
    addPost: (content: string) => Promise<void>;
}

const PostStoreContext = createContext<PostStoreValue | null>(null);

export function PostStoreProvider({ children }: { children: ReactNode }) {
    const { token } = useAuthStore();
    const { currentUser, incrementPostsCount } = useUserStore();
    const [posts] = useState<Post[]>(() => []);

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
            if (!token) throw new Error("请先登录");
            await api.sendCreateNoteActivity(currentUser.username, content, token);
            incrementPostsCount(currentUser.username, 1);
        },
        [currentUser.username, token, incrementPostsCount],
    );

    const value = useMemo<PostStoreValue>(
        () => ({
            posts,
            getPost,
            getPostPath,
            addPost,
        }),
        [posts, getPost, getPostPath, addPost],
    );

    return <PostStoreContext.Provider value={value}>{children}</PostStoreContext.Provider>;
}

export function usePostStore() {
    const ctx = useContext(PostStoreContext);
    if (!ctx) throw new Error("usePostStore must be used within PostStoreProvider");
    return ctx;
}
