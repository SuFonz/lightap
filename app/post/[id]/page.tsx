"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ComposerField } from "@/components/composer-field";
import { PostCard } from "@/components/post-card";
import { HomeIcon, ReplyIcon } from "@/components/icons";
import { useStore } from "@/components/store";

const MAX_REPLY = 500;

export default function PostDetailPage() {
    const params = useParams<{ id: string }>();
    const id = typeof params?.id === "string" ? params.id : "";
    const { getPostPath, addReply } = useStore();
    const router = useRouter();
    const chain = id ? getPostPath(id) ?? [] : [];

    if (chain.length === 0) {
        return (
            <div className="glass-card mx-auto mt-10 max-w-md px-6 py-16 text-center">
                <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/15 text-brand">
                    <ReplyIcon size={26} />
                </span>
                <h1 className="font-display text-lg font-black text-slate-800">帖子不存在</h1>
                <p className="mt-1 text-sm text-slate-400">这个帖子可能已经被删除了～</p>
                <Link
                    href="/"
                    className="btn-solid mt-6 inline-flex px-5 py-2.5 font-display text-sm font-bold"
                >
                    <HomeIcon size={15} /> 回到首页
                </Link>
            </div>
        );
    }

    const post = chain[chain.length - 1];
    const isThread = chain.length > 1;
    const postId = post.id;
    const replies = [...post.replies].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return (
        <div className="flex flex-col gap-3">
            <section className="glass-card flex items-center gap-3 px-5 py-4">
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="返回"
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] text-slate-500 transition hover:bg-white/80 hover:text-brand-deep active:scale-90"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m12 19-7-7 7-7" />
                        <path d="M19 12H5" />
                    </svg>
                </button>
                <h1 className="font-display text-lg font-black text-slate-800">
                    {isThread ? "回复详情" : "帖子详情"}
                </h1>
                {isThread && (
                    <span className="ml-auto rounded-full bg-magic/15 px-2.5 py-1 text-[11px] font-bold text-magic-deep">
                        上下文线程 · {chain.length} 层
                    </span>
                )}
            </section>

            <section className="glass-card divide-y divide-sky-200/50 overflow-hidden" aria-label="帖子线程">
                {chain.map((item, idx) => (
                    <PostCard
                        key={item.id}
                        post={item}
                        bare
                        variant={idx === chain.length - 1 ? "default" : "context"}
                    />
                ))}
            </section>

            <ComposerField
                label="写回复…"
                title="发表回复"
                placeholder={`回复一下 @${post.authorUsername} 吧～`}
                submitLabel="发表回复"
                showTips={false}
                maxLength={MAX_REPLY}
                onSubmit={(content) => addReply(postId, content)}
            />

            <h2 className="glass-card px-5 py-3 font-display text-sm font-extrabold text-slate-700">
                回复 · {post.replies.length}
            </h2>

            {replies.length === 0 ? (
                <div className="glass-card px-6 py-12 text-center">
                    <p className="font-display font-extrabold text-slate-700">还没有回复</p>
                    <p className="mt-1 text-sm text-slate-400">来抢沙发，说点什么吧～</p>
                </div>
            ) : (
                <section className="glass-card rise-in divide-y divide-sky-200/50 overflow-hidden" aria-label="回复列表">
                    {replies.map((reply) => (
                        <PostCard key={reply.id} post={reply} bare />
                    ))}
                </section>
            )}
        </div>
    );
}
