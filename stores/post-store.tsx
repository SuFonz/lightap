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

export type FeedType = api.FeedType;

interface PostStoreValue {
    posts: Post[];
    loading: boolean;
    getPost: (postId: string) => Post | undefined;
    getPostPath: (postId: string) => Post[] | null;
    loadFeed: (type: FeedType) => Promise<void>;
    addPost: (content: string) => Promise<void>;
}

const PostStoreContext = createContext<PostStoreValue | null>(null);

export function PostStoreProvider({ children }: { children: ReactNode }) {
    const { token } = useAuthStore();
    const { currentUser, loadProfile, incrementPostsCount } = useUserStore();
    const [posts, setPosts] = useState<Post[]>(() => []);
    const [loading, setLoading] = useState(false);

    const getPost = useCallback(
        (postId: string) => findPostInTree(posts, postId),
        [posts],
    );

    const getPostPath = useCallback(
        (postId: string) => findPostPath(posts, postId),
        [posts],
    );

    const loadFeed = useCallback(
        async (type: FeedType) => {
            setLoading(true);
            try {
                const list = await api.fetchFeed(type, token);
                setPosts(list);
                // 让 PostCard 能通过 getUser 拿到作者资料
                const authors = [...new Set(list.map((p) => p.authorUsername))];
                await Promise.all(authors.map((name) => loadProfile(name)));
            } finally {
                setLoading(false);
            }
        },
        [token, loadProfile],
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
            loading,
            getPost,
            getPostPath,
            loadFeed,
            addPost,
        }),
        [posts, loading, getPost, getPostPath, loadFeed, addPost],
    );

    return <PostStoreContext.Provider value={value}>{children}</PostStoreContext.Provider>;
}

export function usePostStore() {
    const ctx = useContext(PostStoreContext);
    if (!ctx) throw new Error("usePostStore must be used within PostStoreProvider");
    return ctx;
}
